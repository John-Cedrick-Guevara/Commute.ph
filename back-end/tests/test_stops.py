from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update

from app.db.database import SessionLocal
from app.main import app
from app.stops.model import RouteStop
from tests.conftest import ADMIN_HEADERS

client = TestClient(app, headers=ADMIN_HEADERS)

NON_EXISTENT_ID = "00000000-0000-0000-0000-000000000001"


def stop(name, **overrides):
    return {"name": name, "latitude": 14.65, "longitude": 121.10, **overrides}


@pytest.fixture
def stops():
    """Three throwaway stops and a route through them (deleted after the test)."""
    ids = [client.post("/stops/", json=stop(f"Test Stop {n}")).json()["id"] for n in "ABC"]
    route_id = client.post("/routes/", json={"route_name": "Test Stops Route", "puv_type": "traditional_jeepney"}).json()["id"]
    yield ids, route_id
    client.delete(f"/routes/{route_id}")
    for stop_id in ids:
        client.delete(f"/stops/{stop_id}")


def set_distances(route_id, km):
    with SessionLocal() as db:
        db.execute(update(RouteStop).where(RouteStop.route_id == route_id, RouteStop.stop_sequence > 1)
                   .values(distance_from_previous_km=km))
        db.commit()


def distances(route_id):
    return [s["distance_from_previous_km"] for s in client.get(f"/routes/{route_id}").json()["stops"]]


def test_list_stops_is_public_and_sorted(stops):
    names = [s["name"] for s in TestClient(app).get("/stops/").json()]
    assert names == sorted(names)
    assert {"Test Stop A", "Test Stop B", "Test Stop C"} <= set(names)


def test_duplicate_name_conflicts(stops):
    assert client.post("/stops/", json=stop("Test Stop A")).status_code == 409


def test_invalid_coordinates():
    assert client.post("/stops/", json=stop("Test Bad", latitude=91)).status_code == 422


def test_update_and_delete_not_found():
    assert client.put(f"/stops/{NON_EXISTENT_ID}", json=stop("X")).status_code == 404
    assert client.delete(f"/stops/{NON_EXISTENT_ID}").status_code == 404


def test_set_route_stops_orders_them(stops):
    (a, b, c), route_id = stops
    response = client.put(f"/routes/{route_id}/stops", json={"stop_ids": [c, a, b]})
    assert response.status_code == 200
    assert [s["name"] for s in response.json()["stops"]] == ["Test Stop C", "Test Stop A", "Test Stop B"]
    assert [s["stop_sequence"] for s in response.json()["stops"]] == [1, 2, 3]


def test_set_route_stops_unknown_stop(stops):
    (a, _, _), route_id = stops
    assert client.put(f"/routes/{route_id}/stops", json={"stop_ids": [a, NON_EXISTENT_ID]}).status_code == 404


def test_reorder_keeps_distances_of_unchanged_segments(stops):
    (a, b, c), route_id = stops
    client.put(f"/routes/{route_id}/stops", json={"stop_ids": [a, b, c]})
    set_distances(route_id, Decimal("1.5"))

    # A -> B is kept, C is dropped
    client.put(f"/routes/{route_id}/stops", json={"stop_ids": [a, b]})
    assert distances(route_id) == [None, 1.5]

    # Reversed: B -> A is a different segment, so its distance is unknown
    client.put(f"/routes/{route_id}/stops", json={"stop_ids": [b, a]})
    assert distances(route_id) == [None, None]


def test_moving_a_stop_clears_distances_around_it(stops):
    (a, b, c), route_id = stops
    client.put(f"/routes/{route_id}/stops", json={"stop_ids": [a, b, c]})
    set_distances(route_id, Decimal("1.5"))

    # Renaming keeps distances; moving C clears only B -> C
    client.put(f"/stops/{c}", json=stop("Test Stop C", aliases=["See"]))
    assert distances(route_id) == [None, 1.5, 1.5]
    client.put(f"/stops/{c}", json=stop("Test Stop C", latitude=14.66))
    assert distances(route_id) == [None, 1.5, None]


def test_stop_used_by_a_route_cannot_be_deleted(stops):
    (a, b, _), route_id = stops
    client.put(f"/routes/{route_id}/stops", json={"stop_ids": [a, b]})
    assert client.delete(f"/stops/{a}").status_code == 409
