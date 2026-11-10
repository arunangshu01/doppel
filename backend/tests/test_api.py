import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from utility.settings import API_PREFIX

P = API_PREFIX
SCHEMA = {"seed": 12, "resources": {"users": {"count": 8, "fields": {
    "id": "uuid", "name": "person", "age": "int", "active": "bool"
}}}}


@pytest.fixture
def client():
    with TestClient(create_app(admin_token="test-admin-token")) as client:
        yield client


def create(client, seed=12):
    response = client.post(f"{P}/playgrounds", json={**SCHEMA, "seed": seed})
    assert response.status_code == 201, response.text
    return response.json()


def test_startup_and_prefixed_docs(client):
    assert client.get(f"{P}/health").json() == {"status": "ok"}
    assert client.get(f"{P}/stores").status_code == 200
    docs = client.get(f"{P}/docs")
    assert docs.status_code == 200
    assert f"{P}/openapi.json" in docs.text
    spec = client.get(f"{P}/openapi.json").json()
    assert "/transactions" in spec["paths"]
    assert {"url": P} in spec["servers"]
    assert client.get(f"{P}/templates/retail").json()["resources"]["stores"]
    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404


def test_sessions_isolated_from_demo_and_each_other(client):
    original = client.get(f"{P}/stores").json()
    one, two = create(client), create(client, 99)
    assert one["id"] != two["id"]
    assert len(one["id"]) >= 32
    base = one["base_path"]
    rows = client.get(f"{base}/users").json()
    assert rows["total"] == 8
    assert rows != client.get(f'{two["base_path"]}/users').json()
    assert client.get(f"{P}/stores").json() == original
    assert client.get(f"{base}/stores").status_code == 404
    assert client.get(f"{base}/schema").json()["seed"] == 12
    assert one["resources"][0]["endpoint"] == f"{base}/users"
    assert f"{base}/openapi.json" in client.get(f"{base}/docs").text
    assert {"url": base} in client.get(f"{base}/openapi.json").json()["servers"]


def test_queries_and_update(client):
    one = create(client)
    base = one["base_path"]
    rows = client.get(f"{base}/users").json()
    assert len(client.get(f"{base}/users?page=2&limit=3").json()["data"]) == 3
    row = rows["data"][0]
    assert client.get(f'{base}/users/{row["id"]}').json() == row
    filtered = client.get(f"{base}/users", params={"age": row["age"], "active": str(row["active"]).lower()}).json()
    assert row in filtered["data"]
    ages = [r["age"] for r in client.get(f"{base}/users?sort=age&order=desc").json()["data"]]
    assert ages == sorted(ages, reverse=True)
    updated = client.put(base, json=SCHEMA)
    assert updated.status_code == 200
    assert updated.json()["expires_at"] == one["expires_at"]
    assert client.get(f"{base}/users").json() == rows
    assert client.put(base, json={"resources": {}}).status_code == 422
    assert client.get(f"{base}/users").json() == rows


@pytest.mark.parametrize("path,status", [
    ("/missing", 404), ("/stores/missing", 404), ("/stores?page=0", 422),
    ("/stores?limit=1001", 422), ("/stores?sort=missing", 400),
    ("/stores?order=nope", 422), ("/stores?missing=x", 400)
])
def test_query_errors(client, path, status):
    assert client.get(f"{P}{path}").status_code == status


def test_admin_auth_and_shared_demo(client):
    before = client.get(f"{P}/stores").json()
    for headers in [{}, {"Authorization": "Bearer wrong"}]:
        assert client.post(f"{P}/schema", json=SCHEMA, headers=headers).status_code == 401
    assert client.get(f"{P}/stores").json() == before
    response = client.post(f"{P}/schema", json=SCHEMA, headers={"Authorization": "Bearer test-admin-token"})
    assert response.status_code == 200
    assert client.get(f"{P}/users").status_code == 200
    assert client.get(f"{P}/stores").status_code == 404
    assert "/users" in client.get(f"{P}/openapi.json").json()["paths"]
    assert "/stores" not in client.get(f"{P}/openapi.json").json()["paths"]


def test_missing_admin_secret_disables_publishing():
    with TestClient(create_app(admin_token="")) as client:
        assert client.post(f"{P}/schema", json=SCHEMA).status_code == 503
        assert client.post(f"{P}/playgrounds", json=SCHEMA).status_code == 201


def test_expiration_and_capacity(client):
    store = client.app.state.store
    store.max_sessions = 1
    one = create(client)
    assert client.post(f"{P}/playgrounds", json=SCHEMA).status_code == 503
    store.sessions[one["id"]].deadline = 0
    assert client.get(f'{one["base_path"]}/users').status_code == 404
    assert client.put(one["base_path"], json=SCHEMA).status_code == 404
    assert client.get(one["base_path"]).status_code == 404
    assert create(client)["id"] != one["id"]


def test_cell_limits(client):
    store = client.app.state.store
    store.max_cells = 20
    assert client.post(f"{P}/playgrounds", json=SCHEMA).status_code == 503
    large = {"resources": {"users": {"count": 1000, "fields": {"id": "uuid", **{f"field_{i}": "word" for i in range(21)}}}}}
    assert client.post(f"{P}/playgrounds", json=large).status_code == 422


def test_body_limit_and_no_cache(client):
    assert client.post(f"{P}/playgrounds", content=b"x" * 131073).status_code == 413
    def chunks():
        yield b"x" * 70000
        yield b"x" * 70000
    assert client.post(f"{P}/playgrounds", content=chunks()).status_code == 413
    response = client.get(f"{P}/schema")
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert "admin_token" not in response.text


def test_global_generation_budget(client):
    client.app.state.store.max_generations = 1
    create(client)
    response = client.post(f"{P}/playgrounds", json=SCHEMA)
    assert response.status_code == 429
    assert "retry-after" in response.headers


def test_unknown_session_does_not_expose_demo(client):
    assert client.get(f"{P}/playgrounds/unknown/stores").status_code == 404
