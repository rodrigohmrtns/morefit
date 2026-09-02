"""Integration tests for the Super Admin module (Fase 4)."""
from __future__ import annotations

import os
from datetime import datetime, timezone, timedelta

import pytest
import httpx
from pymongo import MongoClient

API = "http://localhost:8001/api"
ADMIN_EMAIL = "ana@example.com"
ADMIN_PWD = "secret123"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "vitatracker")


@pytest.fixture(scope="module")
def api_client():
    with httpx.Client(base_url="http://localhost:8001", timeout=15.0) as c:
        yield c


@pytest.fixture(scope="module")
def admin_headers(api_client):
    """Ensure the test user exists AND is super_admin, then return auth headers."""
    r = api_client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
    if r.status_code != 200:
        r2 = api_client.post(f"{API}/auth/register", json={"name": "Ana Silva", "email": ADMIN_EMAIL, "password": ADMIN_PWD, "terms_accepted": True, "privacy_accepted": True})
        assert r2.status_code == 200
        data = r2.json()
    else:
        data = r.json()

    cli = MongoClient(MONGO_URL)
    cli[DB_NAME].users.update_one({"email": ADMIN_EMAIL}, {"$set": {"role": "super_admin"}})
    cli.close()

    return {"Authorization": f"Bearer {data['token']}"}


@pytest.fixture(scope="module")
def non_admin_headers(api_client):
    """A regular user (no super_admin role) used for access denial tests."""
    email = "regular_user_admin_test@example.com"
    password = "regular123"
    r = api_client.post(f"{API}/auth/login", json={"email": email, "password": password})
    if r.status_code != 200:
        r2 = api_client.post(f"{API}/auth/register", json={"name": "Regular", "email": email, "password": password, "terms_accepted": True, "privacy_accepted": True})
        assert r2.status_code == 200
        data = r2.json()
    else:
        data = r.json()

    # ensure no admin role
    cli = MongoClient(MONGO_URL)
    cli[DB_NAME].users.update_one({"email": email}, {"$unset": {"role": ""}})
    cli.close()

    return {"Authorization": f"Bearer {data['token']}"}


class TestAdminAccess:
    def test_dashboard_denied_for_non_admin(self, api_client, non_admin_headers):
        r = api_client.get(f"{API}/admin/dashboard", headers=non_admin_headers)
        assert r.status_code == 403

    def test_dashboard_allowed_for_admin(self, api_client, admin_headers):
        r = api_client.get(f"{API}/admin/dashboard", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        assert "users" in d
        assert d["users"]["total"] >= 1
        assert "revenue" in d
        assert "content" in d


class TestAdminUsers:
    def test_list_users_returns_paginated(self, api_client, admin_headers):
        r = api_client.get(f"{API}/admin/users?limit=10", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        assert "items" in d
        assert isinstance(d["items"], list)
        assert d["total"] >= 1
        # verify no password_hash leaks
        for u in d["items"]:
            assert "password_hash" not in u

    def test_search_users(self, api_client, admin_headers):
        r = api_client.get(f"{API}/admin/users?search=ana", headers=admin_headers)
        assert r.status_code == 200
        assert any("ana" in (u.get("email") or "").lower() for u in r.json()["items"])

    def test_grant_premium(self, api_client, admin_headers):
        # find ana user_id
        r = api_client.get(f"{API}/admin/users?search=ana", headers=admin_headers)
        uid = r.json()["items"][0]["user_id"]
        r2 = api_client.post(f"{API}/admin/users/{uid}/grant-premium", json={"days": 5}, headers=admin_headers)
        assert r2.status_code == 200
        d = r2.json()
        assert d["ok"] is True
        assert d["premium_expires_at"]

        # verify audit event was recorded
        r3 = api_client.get(f"{API}/admin/audit?event_type=admin.grant_premium&limit=5", headers=admin_headers)
        assert any(x["event_type"] == "admin.grant_premium" for x in r3.json()["items"])


class TestAdminAudit:
    def test_list_all_audit_events(self, api_client, admin_headers):
        r = api_client.get(f"{API}/admin/audit?limit=10", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json()["items"], list)

    def test_filter_by_event_type(self, api_client, admin_headers):
        # Trigger a login to ensure at least one event exists
        api_client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
        r = api_client.get(f"{API}/admin/audit?event_type=auth.login&limit=5", headers=admin_headers)
        assert r.status_code == 200
        items = r.json()["items"]
        assert all(x["event_type"] == "auth.login" for x in items)
        assert len(items) >= 1


class TestAdminDb:
    def test_db_stats_returns_collections(self, api_client, admin_headers):
        r = api_client.get(f"{API}/admin/db-stats", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["database"] == DB_NAME
        assert "collections" in d
        # essential collections must be present
        for c in ("users", "weights", "audit_logs"):
            assert c in d["collections"]
        # each collection has index info
        users_stats = d["collections"]["users"]
        assert users_stats["n_indexes"] >= 2  # at least user_id + email indexes


class TestAdminTransactions:
    def test_list_transactions(self, api_client, admin_headers):
        r = api_client.get(f"{API}/admin/transactions?limit=20", headers=admin_headers)
        assert r.status_code == 200
        assert "items" in r.json()
        assert isinstance(r.json()["items"], list)
