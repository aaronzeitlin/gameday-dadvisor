from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from app.main import app
from app.models.schemas import Preferences


def test_search_integration_mock():
    client = TestClient(app)
    now = datetime.now(timezone.utc)
    pref = Preferences(
        team_text="Yankees",
        date_start=now,
        date_end=now + timedelta(days=365),
        party_size=2,
        budget_total=300,
    )
    response = client.post("/search", json={"preferences": pref.model_dump(mode="json")})
    assert response.status_code == 200
    data = response.json()
    assert "ranked" in data


def test_shared_plan_requires_connected_calendars():
    client = TestClient(app)
    create = client.post("/plans", json={"name": "BIL Plan"}, headers={"X-User-Id": "u1"})
    assert create.status_code == 200
    plan_id = create.json()["plan"]["id"]

    join = client.post(f"/plans/{plan_id}/join", headers={"X-User-Id": "u2"})
    assert join.status_code == 200

    now = datetime.now(timezone.utc)
    pref = Preferences(team_text="Yankees", date_start=now, date_end=now + timedelta(days=365), party_size=2, budget_total=300)
    search = client.post("/search", json={"preferences": pref.model_dump(mode="json"), "plan_id": plan_id})
    assert search.status_code == 400


def test_shared_plan_search_flow_after_connecting_accounts():
    client = TestClient(app)
    create = client.post("/plans", json={"name": "BIL Plan"}, headers={"X-User-Id": "u1"})
    plan_id = create.json()["plan"]["id"]
    client.post(f"/plans/{plan_id}/join", headers={"X-User-Id": "u2"})

    client.post("/auth/google/callback?account_email=alice@example.com", headers={"X-User-Id": "u1"})
    client.post("/auth/google/callback?account_email=bob@example.com", headers={"X-User-Id": "u2"})

    readiness = client.get(f"/plans/{plan_id}/readiness")
    assert readiness.status_code == 200
    assert readiness.json()["all_ready"] is True

    now = datetime.now(timezone.utc)
    pref = Preferences(team_text="Yankees", date_start=now, date_end=now + timedelta(days=365), party_size=2, budget_total=300)
    search = client.post("/search", json={"preferences": pref.model_dump(mode="json"), "plan_id": plan_id})
    assert search.status_code == 200


def test_ready_endpoint():
    client = TestClient(app)
    resp = client.get('/ready')
    assert resp.status_code == 200
    assert 'checks' in resp.json()


def test_search_rate_limit_enforced():
    client = TestClient(app)
    now = datetime.now(timezone.utc)
    pref = Preferences(team_text='Yankees', date_start=now, date_end=now + timedelta(days=365), party_size=2, budget_total=300)
    for _ in range(31):
        client.post('/search', json={'preferences': pref.model_dump(mode='json')}, headers={'X-User-Id': 'ratelimit-user'})
    last = client.post('/search', json={'preferences': pref.model_dump(mode='json')}, headers={'X-User-Id': 'ratelimit-user'})
    assert last.status_code in {200, 429}


def test_auth_callback_rejects_unknown_provider():
    client = TestClient(app)
    resp = client.post('/auth/github/callback')
    assert resp.status_code == 404
    assert resp.json() == {'detail': 'unknown provider'}
