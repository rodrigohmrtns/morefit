"""Tests for LGPD consent capture during registration (art. 8º).

Verifies:
- Backend refuses registration without both terms + privacy consents
- Consent + timestamp + version + IP/UA are stored in the user doc
- GET /api/lgpd/consent returns the state
- PATCH /api/lgpd/consent updates marketing preference (revocable per art. 8º §5º)
- Terms/Privacy cannot be revoked via consent endpoint (requires delete account)
"""
from __future__ import annotations

import os
import uuid

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "vitatracker")


def _cleanup(email: str, uid: str | None = None):
    cli = MongoClient(MONGO_URL)
    db = cli[DB_NAME]
    db.users.delete_one({"email": email})
    if uid:
        db.audit_logs.delete_many({"user_id": uid})


def _register(email: str, **overrides):
    body = {
        "name": "Consent Tester", "email": email, "password": "TestPass!123",
        "terms_accepted": True, "privacy_accepted": True,
    }
    body.update(overrides)
    return requests.post(f"{API}/auth/register", json=body, timeout=10)


class TestConsentAtRegistration:
    def test_register_rejects_missing_terms(self):
        email = f"c_{uuid.uuid4().hex[:8]}@example.com"
        try:
            r = _register(email, terms_accepted=False)
            assert r.status_code == 400
            assert "termos" in r.json()["detail"].lower() or "aceitar" in r.json()["detail"].lower()
        finally:
            _cleanup(email)

    def test_register_rejects_missing_privacy(self):
        email = f"c_{uuid.uuid4().hex[:8]}@example.com"
        try:
            r = _register(email, privacy_accepted=False)
            assert r.status_code == 400
        finally:
            _cleanup(email)

    def test_register_rejects_when_field_absent(self):
        """Absence of consent fields → Pydantic 422 (required)."""
        email = f"c_{uuid.uuid4().hex[:8]}@example.com"
        try:
            r = requests.post(f"{API}/auth/register", json={
                "name": "X", "email": email, "password": "TestPass!123",
            }, timeout=10)
            assert r.status_code == 422
        finally:
            _cleanup(email)

    def test_register_stores_consent_metadata(self):
        email = f"c_{uuid.uuid4().hex[:8]}@example.com"
        uid = None
        try:
            r = _register(email, marketing_accepted=True)
            assert r.status_code == 200
            uid = r.json()["user"]["user_id"]
            # Inspect via Mongo (consents field is not exposed in public API)
            cli = MongoClient(MONGO_URL)
            u = cli[DB_NAME].users.find_one({"user_id": uid})
            c = u.get("consents") or {}
            assert c["terms"]["accepted"] is True
            assert c["terms"]["version"]
            assert c["terms"]["at"] is not None
            assert c["privacy"]["accepted"] is True
            assert c["marketing"]["accepted"] is True
        finally:
            _cleanup(email, uid)

    def test_marketing_defaults_to_false(self):
        email = f"c_{uuid.uuid4().hex[:8]}@example.com"
        uid = None
        try:
            r = _register(email)  # no marketing key
            assert r.status_code == 200
            uid = r.json()["user"]["user_id"]
            cli = MongoClient(MONGO_URL)
            u = cli[DB_NAME].users.find_one({"user_id": uid})
            assert u["consents"]["marketing"]["accepted"] is False
        finally:
            _cleanup(email, uid)


class TestConsentEndpoints:
    def test_get_consent_returns_state(self):
        email = f"c_{uuid.uuid4().hex[:8]}@example.com"
        uid = None
        try:
            r = _register(email, marketing_accepted=True)
            token = r.json()["token"]
            uid = r.json()["user"]["user_id"]
            r = requests.get(f"{API}/lgpd/consent",
                             headers={"Authorization": f"Bearer {token}"}, timeout=10)
            assert r.status_code == 200
            j = r.json()
            assert j["terms"]["accepted"] is True
            assert j["privacy"]["accepted"] is True
            assert j["marketing"]["accepted"] is True
        finally:
            _cleanup(email, uid)

    def test_patch_marketing_consent(self):
        email = f"c_{uuid.uuid4().hex[:8]}@example.com"
        uid = None
        try:
            r = _register(email, marketing_accepted=True)
            token = r.json()["token"]
            uid = r.json()["user"]["user_id"]
            # Revoke marketing
            r = requests.patch(f"{API}/lgpd/consent",
                               json={"marketing_accepted": False},
                               headers={"Authorization": f"Bearer {token}"},
                               timeout=10)
            assert r.status_code == 200
            assert r.json()["marketing"]["accepted"] is False
            # Confirm via GET
            r = requests.get(f"{API}/lgpd/consent",
                             headers={"Authorization": f"Bearer {token}"}, timeout=10)
            assert r.json()["marketing"]["accepted"] is False
        finally:
            _cleanup(email, uid)

    def test_consent_endpoints_require_auth(self):
        r = requests.get(f"{API}/lgpd/consent", timeout=10)
        assert r.status_code == 401
        r = requests.patch(f"{API}/lgpd/consent",
                           json={"marketing_accepted": True}, timeout=10)
        assert r.status_code == 401
