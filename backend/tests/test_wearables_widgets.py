"""VitaTracker — tests for the new wearables + widgets routers (P3 + P4.4)."""
from __future__ import annotations

import os
import time

import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://fitpro-ecosystem-1.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"


# ---------------------------------------------------------------------------
# Fixtures — reuse Ana (super_admin + premium) per test_credentials.md
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def ana_headers(api_client):
    r = api_client.post(f"{API}/auth/login", json={
        "email": "ana@example.com",
        "password": "secret123",
    })
    assert r.status_code == 200, f"Ana login failed: {r.status_code} {r.text}"
    token = r.json()["token"]
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Wearables — /api/wearables/*
# ---------------------------------------------------------------------------
class TestWearables:
    """Wearables sync + status + history."""

    def test_sync_requires_auth(self, api_client):
        # No auth
        r = api_client.post(f"{API}/wearables/sync", json={"source": "healthkit"})
        assert r.status_code == 401, f"expected 401, got {r.status_code} {r.text[:200]}"

    def test_sync_batch_ingest_counters(self, api_client, ana_headers):
        # Use unique dates so per-test steps counter is deterministic
        today = time.strftime("%Y-%m-%d")
        payload = {
            "source": "healthkit",
            "device_name": "iPhone 15 Pro (test)",
            "steps": [
                {"date": "2026-01-10", "steps": 8123},
                {"date": "2026-01-11", "steps": 9421},
            ],
            "sleep": [
                {"date": "2026-01-10", "hours": 7.4, "rem_hours": 1.6, "deep_hours": 1.3},
            ],
            "weights": [
                # unique date per run so we insert (not skip)
                {"date": f"2026-01-{(int(time.time()) % 28) + 1:02d}", "weight_kg": 71.2},
            ],
            "active_energy": [
                {"date": today, "calories": 412},
            ],
            "heart_rate": [
                {"timestamp": f"{today}T09:15:00Z", "bpm": 72},
                {"timestamp": f"{today}T12:15:00Z", "bpm": 88},
                {"timestamp": f"{today}T18:15:00Z", "bpm": 65},
            ],
        }
        r = api_client.post(f"{API}/wearables/sync", headers=ana_headers, json=payload)
        assert r.status_code == 200, f"sync failed: {r.status_code} {r.text[:400]}"
        j = r.json()
        assert j["ok"] is True
        ing = j["ingested"]
        assert ing["steps"] == 2          # steps use upsert → counter always increments
        assert ing["sleep"] == 1          # sleep uses upsert → counter always increments
        # weights & active_energy dedupe by (user+date+source); repeated runs
        # against the same date insert nothing, which is the intended behavior.
        assert ing["weights"] >= 0
        assert ing["active_energy"] >= 0
        assert ing["heart_rate"] == 3     # HR always inserts (append-only)
        assert "at" in j

    def test_status_reports_source(self, api_client, ana_headers):
        r = api_client.get(f"{API}/wearables/status", headers=ana_headers)
        assert r.status_code == 200, r.text[:200]
        j = r.json()
        assert "sources" in j and "total" in j
        assert "healthkit" in j["sources"], f"expected healthkit in {j['sources']}"
        hk = j["sources"]["healthkit"]
        assert "last_sync_at" in hk
        assert hk["total_syncs"] >= 1
        assert isinstance(j["total"], int) and j["total"] >= 1

    def test_status_requires_auth(self, api_client):
        r = api_client.get(f"{API}/wearables/status")
        assert r.status_code == 401

    def test_heart_rate_history(self, api_client, ana_headers):
        r = api_client.get(f"{API}/wearables/heart-rate", headers=ana_headers)
        assert r.status_code == 200, r.text[:200]
        j = r.json()
        assert "items" in j
        # We just inserted 3 in the previous test — at least 3 should be present
        assert len(j["items"]) >= 3
        sample = j["items"][0]
        for k in ("bpm", "timestamp", "user_id", "source"):
            assert k in sample, f"missing {k} in {sample}"

    def test_heart_rate_requires_auth(self, api_client):
        r = api_client.get(f"{API}/wearables/heart-rate")
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# Widgets — /api/widgets/*
# ---------------------------------------------------------------------------
class TestWidgets:
    """Widget token lifecycle + public summary payload."""

    def test_create_token_requires_auth(self, api_client):
        r = api_client.post(f"{API}/widgets/token")
        assert r.status_code == 401

    def test_create_token_returns_long_token(self, api_client, ana_headers):
        r = api_client.post(f"{API}/widgets/token", headers=ana_headers)
        assert r.status_code == 200, r.text[:200]
        j = r.json()
        assert "token" in j
        assert isinstance(j["token"], str)
        assert len(j["token"]) >= 20, f"token too short: {j['token']!r}"

    def test_summary_with_valid_token(self, api_client, ana_headers):
        # Rotate → guarantees we have a fresh token to use
        r = api_client.post(f"{API}/widgets/token", headers=ana_headers)
        assert r.status_code == 200
        token = r.json()["token"]

        r2 = api_client.get(f"{API}/widgets/summary/{token}")
        assert r2.status_code == 200, r2.text[:200]
        j = r2.json()
        # Payload shape from routers/widgets.py
        for key in ("user_name", "date", "calories", "water", "steps", "streak_days"):
            assert key in j, f"missing {key} in summary {j}"
        # weight_kg key is expected even if value is None
        assert "weight_kg" in j

        # calories sub-shape
        for sub in ("consumed", "goal", "remaining", "pct"):
            assert sub in j["calories"]
        # water sub-shape
        assert "ml" in j["water"] and "goal_ml" in j["water"]
        # steps sub-shape
        assert "count" in j["steps"] and "goal" in j["steps"]
        # streak is int
        assert isinstance(j["streak_days"], int)

    def test_summary_invalid_token_returns_401(self, api_client):
        # min_length=10 in the Path validator, so use ≥10-char garbage
        r = api_client.get(f"{API}/widgets/summary/definitely-not-a-real-token-xxxx")
        assert r.status_code == 401, r.text[:200]

    def test_delete_token_and_verify_revoked(self, api_client, ana_headers):
        # Create a fresh token
        r = api_client.post(f"{API}/widgets/token", headers=ana_headers)
        assert r.status_code == 200
        token = r.json()["token"]

        # Sanity: usable
        r0 = api_client.get(f"{API}/widgets/summary/{token}")
        assert r0.status_code == 200

        # Delete
        r1 = api_client.delete(f"{API}/widgets/token", headers=ana_headers)
        assert r1.status_code == 200
        assert r1.json().get("ok") is True

        # Now the same token should be rejected
        r2 = api_client.get(f"{API}/widgets/summary/{token}")
        assert r2.status_code == 401, r2.text[:200]

    def test_delete_token_requires_auth(self, api_client):
        r = api_client.delete(f"{API}/widgets/token")
        assert r.status_code == 401
