from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select, update

from app.db.database import SessionLocal
from app.fair.model import FareMatrixVersion, SavedFare
from app.fare_matrices.parser import parse_fare_rows
from app.main import app
from app.stops.model import RouteStop
from tests.conftest import ADMIN_HEADERS, make_token
from tests.pdf_helper import make_pdf

client = TestClient(app, headers=ADMIN_HEADERS)
BASE = "/v1/admin/fare-matrices"
MODERN = "modern_jeepney"  # no real matrix or routes, so these tests don't touch live fares


def rows(n=5, start=14):
    """A valid matrix: start fare for 4 km, +2 per km after, 20% off rounded to 25 centavos."""
    out = []
    for km in range(1, n + 1):
        regular = start + 2 * max(0, km - 4)
        out.append({"distance_km": km, "regular_fare": regular, "discounted_fare": round(regular * 0.8 * 4) / 4})
    return out


def draft_body(**overrides):
    return {"effective_from": str(date.today() - timedelta(days=1)), "source_name": "Test circular",
            "rows": rows(), **overrides}


@pytest.fixture
def created():
    """Track versions made by a test and delete them afterwards (cascades their saved fares)."""
    ids = []

    def new_draft(puv_type=MODERN):
        body = client.post(BASE, json={"puv_type": puv_type}).json()
        ids.append(body["id"])
        return body["id"]

    yield new_draft
    with SessionLocal() as db:
        db.execute(delete(FareMatrixVersion).where(FareMatrixVersion.id.in_(ids)))
        db.commit()


# ---------------------------------------------------------------- Parser

def test_parser_reads_common_row_formats():
    parsed, warnings = parse_fare_rows("\n".join([
        "LTFRB Memorandum Circular 2023-012",
        "2023 12 1",                       # a year, not a 202 km row
        "Distance (km)  Regular  Discounted",
        "1  14.00  11.25",
        "2 km  P14.00  P11.25",
        "3 | ₱16.00 | ₱12.75 | note",
        "3  99  99",
    ]))
    assert [(r["distance_km"], str(r["regular_fare"]), str(r["discounted_fare"])) for r in parsed] == [
        (1, "14.00", "11.25"), (2, "14.00", "11.25"), (3, "16.00", "12.75")]
    assert warnings == ["3 km appears more than once; kept the first (16.00)."]


def test_upload_pdf_fills_the_draft_for_review(created):
    draft = created()
    pdf = make_pdf(["Fare Matrix", "1 P14.00 P11.25", "2 P14.00 P11.25", "4 P14.00 P11.25"])
    body = client.post(f"{BASE}/{draft}/source", files={"file": ("matrix.pdf", pdf, "application/pdf")}).json()

    assert [r["distance_km"] for r in body["rows"]] == [1, 2, 4]
    assert body["source_file_name"] == "matrix.pdf"
    assert "Missing distances before: 4 km." in body["issues"]["errors"]  # the admin fixes it before publishing

    downloaded = client.get(f"{BASE}/{draft}/source")
    assert downloaded.content == pdf and downloaded.headers["content-type"] == "application/pdf"


def test_upload_rejects_non_pdf_and_unreadable_pdf_keeps_rows(created):
    draft = created()
    assert client.post(f"{BASE}/{draft}/source", files={"file": ("x.pdf", b"hello", "application/pdf")}).status_code == 422

    client.put(f"{BASE}/{draft}", json=draft_body())
    body = client.post(f"{BASE}/{draft}/source", files={"file": ("x.pdf", b"%PDF-1.4 broken", "application/pdf")}).json()
    assert len(body["rows"]) == 5  # nothing parsed, so the existing rows stay
    assert "could not be read" in body["parse_warnings"][0]


# ---------------------------------------------------------------- Drafts and validation

def test_validation_errors_and_warnings(created):
    draft = created()
    bad = rows()
    bad[2]["regular_fare"] = 12           # lower than the previous km
    bad[2]["discounted_fare"] = 9.5
    bad[4]["discounted_fare"] = 10        # not ~20% off
    issues = client.put(f"{BASE}/{draft}", json=draft_body(rows=bad, source_name=None)).json()["issues"]

    assert "Name the source (e.g. the LTFRB memorandum circular)." in issues["errors"]
    assert "3 km: the regular fare is lower than at 2 km." in issues["errors"]
    assert any(w.startswith("5 km: the discount isn't about 20%") for w in issues["warnings"])
    assert client.post(f"{BASE}/{draft}/publish").status_code == 422


def test_duplicate_distances_and_inverted_discount_rejected(created):
    draft = created()
    assert client.put(f"{BASE}/{draft}", json=draft_body(rows=rows(2) + rows(1))).status_code == 422
    inverted = rows()
    inverted[3]["discounted_fare"] = 100
    response = client.put(f"{BASE}/{draft}", json=draft_body(rows=inverted))
    assert response.status_code == 422 and "4 km" in response.json()["detail"]


def test_pdf_rows_with_swapped_columns_are_skipped(created):
    draft = created()
    pdf = make_pdf(["1 14.00 11.25", "2 11.25 14.00"])
    body = client.post(f"{BASE}/{draft}/source", files={"file": ("m.pdf", pdf, "application/pdf")}).json()
    assert [r["distance_km"] for r in body["rows"]] == [1]
    assert "column order" in body["parse_warnings"][-1]


def test_published_matrix_is_read_only(created):
    draft = created()
    client.put(f"{BASE}/{draft}", json=draft_body())
    published = client.post(f"{BASE}/{draft}/publish").json()

    assert published["status"] == "published" and published["is_current"]
    assert published["verified_by"] == "admin@test.local"
    assert client.put(f"{BASE}/{draft}", json=draft_body()).status_code == 409
    assert client.delete(f"{BASE}/{draft}").status_code == 409
    pdf = make_pdf(["1 1 1"])
    assert client.post(f"{BASE}/{draft}/source", files={"file": ("m.pdf", pdf, "application/pdf")}).status_code == 409


def test_non_admin_cannot_manage_matrices():
    viewer = TestClient(app, headers={"Authorization": f"Bearer {make_token(role=None)}"})
    assert viewer.get(BASE).status_code == 403
    assert TestClient(app).get(BASE).status_code == 401


# ---------------------------------------------------------------- Publish, notice and retract

@pytest.fixture
def trip():
    """A modern jeepney route B -> D with a distance (deleted after the test)."""
    stop_ids = [
        client.post("/v1/admin/stops", json={"name": f"FM {n}", "latitude": 14.6, "longitude": 121.1}).json()["id"]
        for n in "BD"
    ]
    route_id = client.post("/v1/admin/routes", json={"route_name": "FM Route", "puv_type": MODERN}).json()["id"]
    client.put(f"/v1/admin/routes/{route_id}/stops", json={"stop_ids": stop_ids})
    with SessionLocal() as db:
        db.execute(update(RouteStop).where(RouteStop.route_id == route_id, RouteStop.stop_sequence == 2)
                   .values(distance_from_previous_km=1.5))
        db.commit()
    yield stop_ids
    client.delete(f"/v1/admin/routes/{route_id}")
    for stop_id in stop_ids:
        client.delete(f"/v1/admin/stops/{stop_id}")


def fare(stop_ids):
    params = {"origin_stop_id": stop_ids[0], "destination_stop_id": stop_ids[1], "puv_type": MODERN}
    return client.get("/v1/fares/estimate", params=params).json()["routes"][0]["regular_fare"]


def live_and_deleted(stop_ids):
    with SessionLocal() as db:
        saved = db.execute(select(SavedFare).where(SavedFare.origin_stop_id == stop_ids[0])).scalars().all()
    return sum(r.deleted_at is None for r in saved), sum(r.deleted_at is not None for r in saved)


def test_publish_notice_retire_and_retract_restore(created, trip):
    v1 = created()
    client.put(f"{BASE}/{v1}", json=draft_body(rows=rows(start=20)))
    client.post(f"{BASE}/{v1}/publish")
    assert fare(trip) == 20
    assert live_and_deleted(trip) == (1, 0)

    # The notice before publishing v2 counts the saved fare it will retire
    v2 = created()
    client.put(f"{BASE}/{v2}", json=draft_body(rows=rows(start=30), effective_from=str(date.today())))
    preview = client.get(f"{BASE}/{v2}/publish-preview").json()
    assert (preview["retiring_saved_fares"], preview["takes_effect_now"], preview["issues"]["errors"]) == (1, True, [])

    # Publishing retires it right away (soft delete) and new requests use v2
    client.post(f"{BASE}/{v2}/publish")
    assert live_and_deleted(trip) == (0, 1)
    assert fare(trip) == 30

    # Retracting v2 brings v1 back and restores v1's saved fare
    result = client.post(f"{BASE}/{v2}/retract").json()
    assert (result["retired_saved_fares"], result["restored_saved_fares"]) == (1, 1)
    assert result["version"]["status"] == "retracted"
    assert live_and_deleted(trip) == (1, 1)
    assert fare(trip) == 20


def test_future_matrix_does_not_retire_yet(created, trip):
    v1 = created()
    client.put(f"{BASE}/{v1}", json=draft_body(rows=rows(start=20)))
    client.post(f"{BASE}/{v1}/publish")
    fare(trip)

    later = created()
    client.put(f"{BASE}/{later}", json=draft_body(effective_from=str(date.today() + timedelta(days=7))))
    assert client.get(f"{BASE}/{later}/publish-preview").json()["takes_effect_now"] is False
    client.post(f"{BASE}/{later}/publish")
    assert live_and_deleted(trip) == (1, 0)
    assert fare(trip) == 20


def test_saved_fares_view(created, trip):
    v1 = created()
    client.put(f"{BASE}/{v1}", json=draft_body(rows=rows(start=20)))
    client.post(f"{BASE}/{v1}/publish")
    fare(trip)

    [row] = [r for r in client.get("/v1/admin/saved-fares").json() if r["origin"] == "FM B"]
    assert (row["destination"], row["puv_type"], row["cheapest_regular_fare"], row["deleted_at"]) == (
        "FM D", MODERN, 20, None)


def test_admin_lists_routes_and_versions(created):
    created()
    statuses = {(v["puv_type"], v["status"]) for v in client.get(BASE).json()}
    assert ("traditional_jeepney", "published") in statuses and (MODERN, "draft") in statuses
    assert all("stop_count" in r for r in client.get("/v1/admin/routes").json())
