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
    elapsed = client.app.state.abuse.now() + 1801
    client.app.state.abuse.now = lambda: elapsed
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


@pytest.mark.parametrize('name', ['retail', 'saas', 'blog', 'ecommerce'])
def test_starter_templates_generate_isolated_apis(client, name):
    template = client.get(f'{P}/templates/{name}')
    assert template.status_code == 200
    created = client.post(f'{P}/playgrounds', json=template.json())
    assert created.status_code == 201
    base = created.json()['base_path']
    for resource in template.json()['resources']:
        assert client.get(f'{base}/{resource}').json()['total'] > 0
    assert client.get(f'{P}/stores').status_code == 200


def test_template_catalog_and_unknown_template(client):
    assert {item['id'] for item in client.get(f'{P}/templates').json()['templates']} == {'retail', 'saas', 'blog', 'ecommerce'}
    assert client.get(f'{P}/templates/unknown').status_code == 404


def test_response_simulation_does_not_mutate_data(client, monkeypatch):
    from unittest.mock import AsyncMock
    sleep = AsyncMock()
    monkeypatch.setattr('routers.resources.asyncio.sleep', sleep)
    one = create(client)
    base = one['base_path']
    original = client.get(f'{base}/users').json()
    error = client.get(f'{base}/users?_status=503&_delay_ms=15')
    assert error.status_code == 503 and error.json()['simulated'] is True
    assert error.headers['cache-control'] == 'no-store'
    sleep.assert_any_await(0.015)
    empty = client.get(f'{base}/users?_empty=true').json()
    assert empty['data'] == [] and empty['total'] == 0
    row = original['data'][0]
    assert client.get(f'{base}/users/{row["id"]}?_status=500').status_code == 500
    assert client.get(f'{base}/users').json() == original
    spec = client.get(f'{base}/openapi.json').json()
    assert {'_status', '_delay_ms', '_empty'} <= {p['name'] for p in spec['paths']['/users']['get']['parameters']}


@pytest.mark.parametrize('query', ['_delay_ms=-1', '_delay_ms=3001', '_status=302', '_status=999', '_empty=maybe'])
def test_invalid_simulation_rejected(client, query):
    assert client.get(f'{P}/stores?{query}').status_code == 422


def test_simulated_delays_have_a_concurrency_budget(client):
    one = create(client)
    client.app.state.store.simulation_requests = 4
    response = client.get(f'{P}/stores?_delay_ms=1')
    assert response.status_code == 429
    assert response.headers['retry-after'] == '1'
    assert client.get(f'{one["base_path"]}/users?_delay_ms=1').status_code == 429
    assert client.get(f'{P}/stores').status_code == 200
    client.app.state.store.simulation_requests = 0


def test_simulated_delay_releases_capacity_after_cancellation(client, monkeypatch):
    import asyncio
    from types import SimpleNamespace
    from routers.resources import simulate

    async def cancelled(_):
        raise asyncio.CancelledError()

    monkeypatch.setattr('routers.resources.asyncio.sleep', cancelled)
    request = SimpleNamespace(scope={'doppel_store': client.app.state.store})
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(simulate(request, 1, '200'))
    assert client.app.state.store.simulation_requests == 0


def test_read_limits_ignore_forged_ip_headers(client):
    client.app.state.abuse.client_limits['read'] = 1
    token = client.get(f'{P}/demo').headers['x-doppel-client']
    headers = {'X-Doppel-Client': token, 'X-Forwarded-For': '198.51.100.1'}
    assert client.get(f'{P}/stores', headers=headers).status_code == 200
    headers['X-Forwarded-For'] = '198.51.100.2'
    response = client.get(f'{P}/schema', headers=headers)
    assert response.status_code == 429
    assert int(response.headers['retry-after']) >= 1
    assert response.headers['cache-control'] == 'no-store'
    assert response.json().get('simulated') is not True


def test_global_read_limit_and_health_reserve(client):
    client.app.state.abuse.global_limits['read'] = 1
    assert client.get(f'{P}/stores').status_code == 200
    assert client.get(f'{P}/schema').status_code == 429
    assert client.get(f'{P}/health').status_code == 200


def test_generation_fair_use_budget(client):
    token = client.get(f'{P}/demo').headers['x-doppel-client']
    headers = {'X-Doppel-Client': token}
    for _ in range(3):
        assert client.post(f'{P}/playgrounds', json=SCHEMA, headers=headers).status_code == 201
    response = client.post(f'{P}/playgrounds', json=SCHEMA, headers=headers)
    assert response.status_code == 429 and 'retry-after' in response.headers


def test_playground_budget_survives_changing_client_identifier(client):
    one = create(client)
    client.app.state.abuse.playground_limits['read'] = 1
    first = client.get(f'{P}/demo').headers['x-doppel-client']
    second = client.get(f'{P}/demo').headers['x-doppel-client']
    assert client.get(f'{one["base_path"]}/users', headers={'X-Doppel-Client': first}).status_code == 200
    assert client.get(f'{one["base_path"]}/users', headers={'X-Doppel-Client': second}).status_code == 429


def test_read_budget_recovers_after_window(client):
    clock = [0.0]
    client.app.state.abuse.now = lambda: clock[0]
    client.app.state.abuse.global_limits['read'] = 1
    assert client.get(f'{P}/stores').status_code == 200
    assert client.get(f'{P}/stores').status_code == 429
    clock[0] = 61.0
    assert client.get(f'{P}/stores').status_code == 200


def test_invalid_signature_does_not_create_a_fresh_budget(client):
    client.app.state.abuse.client_limits['read'] = 1
    token = client.get(f'{P}/demo').headers['x-doppel-client']
    tampered = token[:-1] + ('0' if token[-1] != '0' else '1')
    response = client.get(f'{P}/stores', headers={'X-Doppel-Client': tampered})
    assert response.status_code == 429
    assert 'x-doppel-client' not in response.headers


def test_rate_limit_state_is_bounded_and_recovers(client):
    limits = client.app.state.abuse
    limits.max_actors = 2
    one = client.get(f'{P}/health').headers['x-doppel-client']
    two = client.get(f'{P}/health').headers['x-doppel-client']
    assert client.get(f'{P}/stores', headers={'X-Doppel-Client': one}).status_code == 200
    assert client.get(f'{P}/stores', headers={'X-Doppel-Client': two}).status_code == 200
    assert client.get(f'{P}/stores').status_code == 429
    assert len(limits.actors) == 2
    assert client.get(f'{P}/stores', headers={'X-Doppel-Client': one}).status_code == 200
    elapsed = limits.now() + 61
    limits.now = lambda: elapsed
    assert client.get(f'{P}/stores').status_code == 200
    assert len(limits.actors) == 1


def test_request_url_and_header_limits(client):
    assert client.get(f'{P}/stores', params={'q': 'x' * 8193}).status_code == 414
    assert client.get(f'{P}/stores', headers={'X-Oversized': 'x' * 16385}).status_code == 431


def test_slow_upload_is_bounded():
    import asyncio
    from utility.http import APIGuards

    async def app(scope, receive, send):
        pytest.fail('A slow body must be rejected before routing')

    async def receive():
        await asyncio.sleep(1)
        return {'type': 'http.request', 'body': b'', 'more_body': False}

    messages = []

    async def send(message):
        messages.append(message)

    guard = APIGuards(app)
    guard.body_timeout = 0.001
    asyncio.run(guard({'type': 'http', 'method': 'POST', 'path': f'{P}/playgrounds', 'headers': []}, receive, send))
    assert messages[0]['status'] == 408
    assert (b'cache-control', b'no-store') in messages[0]['headers']


def test_fair_use_headers_are_available_to_allowed_browser_clients(client):
    response = client.get(f'{P}/demo', headers={'Origin': 'http://localhost:5173'})
    assert response.headers['access-control-allow-origin'] == 'http://localhost:5173'
    exposed = response.headers['access-control-expose-headers'].lower()
    assert 'retry-after' in exposed and 'x-doppel-client' in exposed
    assert 'set-cookie' not in response.headers


def test_generation_does_not_queue_behind_busy_worker(client):
    store = client.app.state.store
    client.portal.call(store.lock.acquire)
    try:
        response = client.post(f'{P}/playgrounds', json=SCHEMA)
        assert response.status_code == 429 and response.headers['retry-after'] == '1'
        assert not store.sessions
    finally:
        client.portal.call(store.lock.release)


def test_unknown_session_does_not_expose_demo(client):
    assert client.get(f"{P}/playgrounds/unknown/stores").status_code == 404
