from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import ADMIN_HEADERS

client = TestClient(app, headers=ADMIN_HEADERS)

NON_EXISTENT_ID = "00000000-0000-0000-0000-000000000001"
JEEP = "traditional_jeepney"


def route(**overrides):
    return {"route_name": "Test Route", "puv_type": JEEP, **overrides}


def test_create_missing_name():
    assert client.post("/routes/", json=route(route_name="")).status_code == 422


def test_create_unknown_puv_type():
    assert client.post("/routes/", json=route(puv_type="spaceship")).status_code == 422


def test_edit_route_missing_name():
    assert client.put(f"/routes/{NON_EXISTENT_ID}", json=route(route_name="")).status_code == 422


def test_delete_route_missing_id():
    assert client.delete("/routes/").status_code == 405


def test_update_route_id_not_found():
    assert client.put(f"/routes/{NON_EXISTENT_ID}", json=route()).status_code == 404


def test_delete_route_id_not_found():
    assert client.delete(f"/routes/{NON_EXISTENT_ID}").status_code == 404


def test_delete_route_invalid_id():
    assert client.delete("/routes/invalid_route_id").status_code == 422


def test_update_route_invalid_id():
    assert client.put("/routes/invalid_route_id", json=route()).status_code == 422


def test_create_and_update_route():
    created = client.post("/routes/", json=route())
    assert created.status_code == 201
    route_id = created.json()["id"]
    try:
        assert created.json()["puv_type"] == JEEP
        updated = client.put(f"/routes/{route_id}", json=route(route_name="Renamed", puv_type="modern_jeepney"))
        assert (updated.json()["route_name"], updated.json()["puv_type"]) == ("Renamed", "modern_jeepney")
    finally:
        client.delete(f"/routes/{route_id}")
