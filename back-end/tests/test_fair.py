from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, func, select, update

from app.db.database import SessionLocal
from app.fair.model import FareMatrixRow, FareMatrixVersion, SavedFare
from app.fair.services import compute_fare, current_version_id
from app.main import app
from app.stops.model import RouteStop
from tests.conftest import ADMIN_HEADERS

client = TestClient(app, headers=ADMIN_HEADERS)

NON_EXISTENT_ID = "00000000-0000-0000-0000-000000000001"
JEEP, MODERN = "traditional_jeepney", "modern_jeepney"


@pytest.fixture
def network():
    """
    Throwaway stops and routes (deleted after the test):
    Fair 1: A -> B -> C -> D -> E, Fair 2: D -> X -> B (shares B and D, reversed), Fair 3: B -> Y,
    Fair Modern (modern jeepney): B -> D
    """
    stops = {n: client.post("/v1/admin/stops", json={"name": f"Fair {n}", "latitude": 14.65, "longitude": 121.10}).json()["id"]
             for n in "ABCDEXY"}
    layout = {"Fair 1": (JEEP, "ABCDE"), "Fair 2": (JEEP, "DXB"), "Fair 3": (JEEP, "BY"), "Fair Modern": (MODERN, "BD")}
    routes = {}
    for name, (puv_type, path) in layout.items():
        routes[name] = client.post("/v1/admin/routes", json={"route_name": name, "puv_type": puv_type}).json()["id"]
        client.put(f"/v1/admin/routes/{routes[name]}/stops", json={"stop_ids": [stops[n] for n in path]})
    yield stops, routes
    for route_id in routes.values():
        client.delete(f"/v1/admin/routes/{route_id}")
    for stop_id in stops.values():
        client.delete(f"/v1/admin/stops/{stop_id}")


@pytest.fixture
def modern_matrix():
    """A published modern jeepney matrix in effect today (removed after the test)."""
    created = []

    def publish(regular, effective_from=None):
        with SessionLocal() as db:
            version = FareMatrixVersion(
                puv_type=MODERN, status="published", source_name="Test", published_at=datetime.now(),
                effective_from=effective_from or date.today() - timedelta(days=1),
            )
            db.add(version)
            db.flush()
            db.add_all(FareMatrixRow(version_id=version.id, distance_km=km, regular_fare=regular,
                                     discounted_fare=regular - 2) for km in range(1, 26))
            db.commit()
            created.append(version.id)
            return version.id

    yield publish
    with SessionLocal() as db:
        db.execute(delete(FareMatrixVersion).where(FareMatrixVersion.id.in_(created)))
        db.commit()


def search(origin, destination, puv_type=JEEP):
    return client.get("/v1/fares/estimate", params={
        "origin_stop_id": origin, "destination_stop_id": destination, "puv_type": puv_type})


def summary(response):
    return [(r["route_name"], [s["name"].removeprefix("Fair ") for s in r["stops"]]) for r in response.json()["routes"]]


def set_distances(route_id, km):
    with SessionLocal() as db:
        db.execute(update(RouteStop).where(RouteStop.route_id == route_id, RouteStop.stop_sequence > 1)
                   .values(distance_from_previous_km=km))
        db.commit()


def saved(origin, destination, puv_type=JEEP):
    with SessionLocal() as db:
        return db.execute(select(SavedFare).where(
            SavedFare.origin_stop_id == origin, SavedFare.destination_stop_id == destination,
            SavedFare.puv_type == puv_type).order_by(SavedFare.created_at)).scalars().all()


def test_forward_and_reverse_routes(network):
    stops, _ = network
    assert summary(search(stops["B"], stops["D"])) == [("Fair 1", ["B", "C", "D"]), ("Fair 2", ["B", "X", "D"])]
    assert summary(search(stops["D"], stops["B"])) == [("Fair 1", ["D", "C", "B"]), ("Fair 2", ["D", "X", "B"])]


def test_only_routes_of_the_requested_puv_type(network):
    stops, _ = network
    assert summary(search(stops["B"], stops["D"], MODERN)) == [("Fair Modern", ["B", "D"])]


def test_no_route_contains_both(network):
    stops, _ = network
    response = search(stops["Y"], stops["E"])
    assert response.status_code == 200
    assert response.json()["routes"] == []


def test_bad_requests(network):
    stops, _ = network
    assert search(stops["B"], stops["B"]).status_code == 400
    assert search(stops["B"], NON_EXISTENT_ID).status_code == 404
    assert search(stops["B"], stops["D"], "spaceship").status_code == 404
    assert search("invalid", NON_EXISTENT_ID).status_code == 422


def test_imported_matrix_follows_fare_guide_pattern():
    # Guards the migrated jeepney matrix: P14 for the first 4 km, +P2 per km after,
    # discounted = 80% of regular rounded to the nearest 25 centavos
    with SessionLocal() as db:
        version_id = current_version_id(db, JEEP)
        rows = db.execute(select(FareMatrixRow).where(FareMatrixRow.version_id == version_id)
                          .order_by(FareMatrixRow.distance_km)).scalars().all()

    assert [r.distance_km for r in rows] == list(range(1, 26))
    for row in rows:
        regular = 14 + 2 * max(0, row.distance_km - 4)
        assert row.regular_fare == regular, row.distance_km
        assert row.discounted_fare == round(regular * 0.8 * 4) / 4, row.distance_km


def test_compute_fare_rounds_up_and_never_invents():
    with SessionLocal() as db:
        version_id = current_version_id(db, JEEP)
        fares = {r.distance_km: r for r in db.execute(
            select(FareMatrixRow).where(FareMatrixRow.version_id == version_id)).scalars()}

    assert compute_fare(Decimal("0.4"), fares) == (14, Decimal("11.25"))  # under 1 km -> 1 km
    assert compute_fare(Decimal("4.0"), fares) == (14, Decimal("11.25"))  # exact km stays
    assert compute_fare(Decimal("4.01"), fares) == (16, Decimal("12.75"))
    assert compute_fare(Decimal("25.0"), fares) == (56, Decimal("44.75"))
    assert compute_fare(Decimal("25.1"), fares) is None  # past the matrix: no fare


def test_fare_in_search(network):
    stops, routes = network
    set_distances(routes["Fair 1"], "1.7")

    for origin, destination in (("B", "D"), ("D", "B")):
        fair_1 = next(r for r in search(stops[origin], stops[destination]).json()["routes"] if r["route_name"] == "Fair 1")
        assert fair_1["distance_km"] == 3.4
        assert (fair_1["regular_fare"], fair_1["discounted_fare"]) == (14, 11.25)
        assert fair_1["fare_matrix_version_id"] is not None

    # Fair 2 has no distances yet, so no fare instead of a wrong one
    fair_2 = next(r for r in search(stops["B"], stops["D"]).json()["routes"] if r["route_name"] == "Fair 2")
    assert (fair_2["distance_km"], fair_2["regular_fare"], fair_2["discounted_fare"]) == (None, None, None)


def test_complete_result_is_saved_and_reused(network):
    stops, routes = network
    set_distances(routes["Fair 1"], "1.7")
    first = search(stops["C"], stops["E"]).json()["routes"]  # Fair 1 only, so every route has a fare
    [row] = saved(stops["C"], stops["E"])
    assert row.routes == first and row.deleted_at is None

    # A hit returns the saved row without searching: prove it by tampering with the row
    with SessionLocal() as db:
        db.execute(update(SavedFare).where(SavedFare.id == row.id).values(routes=[]))
        db.commit()
    assert search(stops["C"], stops["E"]).json()["routes"] == []


def test_result_missing_a_fare_is_not_saved(network):
    stops, routes = network
    set_distances(routes["Fair 1"], "1.7")  # Fair 2 also connects B and D but has no distances
    search(stops["B"], stops["D"])
    assert saved(stops["B"], stops["D"]) == []


def test_editing_routes_clears_saved_fares(network):
    stops, routes = network
    set_distances(routes["Fair 1"], "1.7")
    search(stops["D"], stops["E"])
    assert saved(stops["D"], stops["E"])

    client.put(f"/v1/admin/routes/{routes['Fair 3']}", json={"route_name": "Fair 3 renamed", "puv_type": JEEP})
    assert saved(stops["D"], stops["E"]) == []


def test_no_matrix_in_effect_gives_no_fare(network):
    stops, routes = network
    set_distances(routes["Fair Modern"], "1.7")
    [route] = search(stops["B"], stops["D"], MODERN).json()["routes"]
    assert route["distance_km"] == 1.7
    assert (route["regular_fare"], route["fare_matrix_version_id"]) == (None, None)
    assert saved(stops["B"], stops["D"], MODERN) == []


def test_new_matrix_version_retires_old_saved_fares(network, modern_matrix):
    stops, routes = network
    set_distances(routes["Fair Modern"], "1.7")
    v1 = modern_matrix(regular=20)
    assert search(stops["B"], stops["D"], MODERN).json()["routes"][0]["regular_fare"] == 20

    # A version published for later isn't used yet
    modern_matrix(regular=99, effective_from=date.today() + timedelta(days=30))
    assert search(stops["B"], stops["D"], MODERN).json()["routes"][0]["regular_fare"] == 20

    # Once a newer version is in effect, the old saved fare is soft-deleted and recomputed
    v2 = modern_matrix(regular=30)
    assert search(stops["B"], stops["D"], MODERN).json()["routes"][0]["regular_fare"] == 30
    old, new = saved(stops["B"], stops["D"], MODERN)
    assert (old.fare_matrix_version_id, new.fare_matrix_version_id) == (v1, v2)
    assert old.deleted_at is not None and new.deleted_at is None


def test_nightly_job_retires_fares_of_superseded_versions(network, modern_matrix):
    stops, routes = network
    set_distances(routes["Fair Modern"], "1.7")
    modern_matrix(regular=20)
    search(stops["B"], stops["D"], MODERN)

    modern_matrix(regular=30)
    with SessionLocal() as db:
        db.execute(select(func.retire_saved_fares()))
        db.commit()
    [row] = saved(stops["B"], stops["D"], MODERN)
    assert row.deleted_at is not None


def test_estimate_reports_the_matrix_in_effect(network):
    stops, _ = network
    body = search(stops["B"], stops["D"]).json()
    assert body["puv_type"] == JEEP
    assert body["fare_matrix"]["effective_from"] and body["fare_matrix"]["source_name"]
    assert search(stops["B"], stops["D"], MODERN).json()["fare_matrix"] is None


def test_transport_types_and_fare_data_status():
    types = {t["code"]: t for t in TestClient(app).get("/v1/transport-types").json()}
    assert types[JEEP]["has_fare_matrix"] is True
    assert types[MODERN]["has_fare_matrix"] is False  # no Beep Jeep fare source yet

    status = {s["puv_type"]: s for s in TestClient(app).get("/v1/fare-data/status").json()}
    assert status[JEEP]["fare_matrix"]["source_name"]
    assert status[MODERN]["fare_matrix"] is None
