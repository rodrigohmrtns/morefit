"""Tests for 2FA TOTP (setup, enable, login challenge, backup codes, disable).

Requires the backend running on :8001.
"""
from __future__ import annotations

import os
import uuid

import pyotp
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "vitatracker")


def _cli():
    return MongoClient(MONGO_URL)[DB_NAME]


def _cleanup(email: str):
    db = _cli()
    u = db.users.find_one({"email": email})
    if u:
        db.audit_logs.delete_many({"user_id": u["user_id"]})
        db.auth_challenges.delete_many({"user_id": u["user_id"]})
    db.users.delete_one({"email": email})


def _register(email: str, password: str = "Passw0rd!23"):
    r = requests.post(f"{API}/auth/register", json={
        "name": "TOTP Tester", "email": email, "password": password,
        "terms_accepted": True, "privacy_accepted": True,
    }, timeout=10)
    r.raise_for_status()
    return r.json()  # {token, user}


@pytest.fixture()
def user_ctx():
    email = f"totp_{uuid.uuid4().hex[:8]}@example.com"
    data = _register(email)
    yield {"email": email, "password": "Passw0rd!23", "token": data["token"], "user": data["user"]}
    _cleanup(email)


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------
def test_status_defaults(user_ctx):
    r = requests.get(f"{API}/auth/2fa/status", headers=_auth(user_ctx["token"]), timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert j == {"enabled": False, "mandatory": False, "pending": False, "backup_codes_remaining": 0}


# ---------------------------------------------------------------------------
# Setup returns QR + 10 backup codes
# ---------------------------------------------------------------------------
def test_setup_returns_qr_and_backup_codes(user_ctx):
    r = requests.post(f"{API}/auth/2fa/setup", headers=_auth(user_ctx["token"]), timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert j["qr_data_url"].startswith("data:image/png;base64,")
    assert isinstance(j["manual_secret"], str) and len(j["manual_secret"]) >= 16
    assert isinstance(j["backup_codes"], list) and len(j["backup_codes"]) == 10
    assert j["issuer"] == "MoreFit"

    st = requests.get(f"{API}/auth/2fa/status", headers=_auth(user_ctx["token"]), timeout=10).json()
    assert st["pending"] is True and st["enabled"] is False


# ---------------------------------------------------------------------------
# Enable with valid TOTP
# ---------------------------------------------------------------------------
def test_enable_with_valid_code(user_ctx):
    setup = requests.post(f"{API}/auth/2fa/setup", headers=_auth(user_ctx["token"]), timeout=10).json()
    code = pyotp.TOTP(setup["manual_secret"]).now()
    r = requests.post(f"{API}/auth/2fa/enable", headers=_auth(user_ctx["token"]),
                      json={"code": code}, timeout=10)
    assert r.status_code == 200, r.text
    assert r.json() == {"enabled": True}

    st = requests.get(f"{API}/auth/2fa/status", headers=_auth(user_ctx["token"]), timeout=10).json()
    assert st == {"enabled": True, "mandatory": False, "pending": False, "backup_codes_remaining": 10}


def test_enable_rejects_bad_code(user_ctx):
    requests.post(f"{API}/auth/2fa/setup", headers=_auth(user_ctx["token"]), timeout=10)
    r = requests.post(f"{API}/auth/2fa/enable", headers=_auth(user_ctx["token"]),
                      json={"code": "000000"}, timeout=10)
    assert r.status_code == 400


# ---------------------------------------------------------------------------
# Login challenge flow
# ---------------------------------------------------------------------------
def _enable_2fa(ctx):
    setup = requests.post(f"{API}/auth/2fa/setup", headers=_auth(ctx["token"]), timeout=10).json()
    code = pyotp.TOTP(setup["manual_secret"]).now()
    requests.post(f"{API}/auth/2fa/enable", headers=_auth(ctx["token"]),
                  json={"code": code}, timeout=10).raise_for_status()
    return setup


def test_login_returns_challenge_when_2fa_enabled(user_ctx):
    setup = _enable_2fa(user_ctx)
    r = requests.post(f"{API}/auth/login",
                      json={"email": user_ctx["email"], "password": user_ctx["password"]}, timeout=10)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["status"] == "2fa_required"
    assert isinstance(j["challenge_id"], str) and len(j["challenge_id"]) > 10
    assert "token" not in j and "user" not in j


def test_login_2fa_endpoint_returns_challenge(user_ctx):
    setup = _enable_2fa(user_ctx)
    r = requests.post(f"{API}/auth/2fa/login",
                      json={"email": user_ctx["email"], "password": user_ctx["password"],
                            "channel": "mobile"}, timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert j["status"] == "2fa_required"


def test_verify_login_success_totp(user_ctx):
    setup = _enable_2fa(user_ctx)
    login = requests.post(f"{API}/auth/2fa/login",
                          json={"email": user_ctx["email"], "password": user_ctx["password"],
                                "channel": "mobile"}, timeout=10).json()
    code = pyotp.TOTP(setup["manual_secret"]).now()
    r = requests.post(f"{API}/auth/2fa/verify-login",
                      json={"challenge_id": login["challenge_id"], "code": code}, timeout=10)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["status"] == "ok" and j["via"] == "totp"
    assert "token" in j and "user" in j


def test_verify_login_backup_code_single_use(user_ctx):
    setup = _enable_2fa(user_ctx)
    login = requests.post(f"{API}/auth/2fa/login",
                          json={"email": user_ctx["email"], "password": user_ctx["password"],
                                "channel": "mobile"}, timeout=10).json()
    backup = setup["backup_codes"][0]
    r = requests.post(f"{API}/auth/2fa/verify-login",
                      json={"challenge_id": login["challenge_id"], "code": backup}, timeout=10)
    assert r.status_code == 200, r.text
    assert r.json()["via"] == "backup"

    # Same backup on a new challenge must fail
    login2 = requests.post(f"{API}/auth/2fa/login",
                           json={"email": user_ctx["email"], "password": user_ctx["password"],
                                 "channel": "mobile"}, timeout=10).json()
    r2 = requests.post(f"{API}/auth/2fa/verify-login",
                       json={"challenge_id": login2["challenge_id"], "code": backup}, timeout=10)
    assert r2.status_code == 401


def test_verify_login_bad_code(user_ctx):
    _enable_2fa(user_ctx)
    login = requests.post(f"{API}/auth/2fa/login",
                          json={"email": user_ctx["email"], "password": user_ctx["password"],
                                "channel": "mobile"}, timeout=10).json()
    r = requests.post(f"{API}/auth/2fa/verify-login",
                      json={"challenge_id": login["challenge_id"], "code": "000000"}, timeout=10)
    assert r.status_code == 401


def test_verify_login_unknown_challenge(user_ctx):
    r = requests.post(f"{API}/auth/2fa/verify-login",
                      json={"challenge_id": "does-not-exist", "code": "123456"}, timeout=10)
    assert r.status_code == 401


# ---------------------------------------------------------------------------
# Regenerate backup codes
# ---------------------------------------------------------------------------
def test_regen_backup_codes(user_ctx):
    setup = _enable_2fa(user_ctx)
    old_codes = set(setup["backup_codes"])
    r = requests.post(f"{API}/auth/2fa/backup-codes/regenerate",
                      headers=_auth(user_ctx["token"]), timeout=10)
    assert r.status_code == 200
    new_codes = set(r.json()["backup_codes"])
    assert len(new_codes) == 10
    assert new_codes.isdisjoint(old_codes)


# ---------------------------------------------------------------------------
# Disable
# ---------------------------------------------------------------------------
def test_disable_requires_password_and_code(user_ctx):
    setup = _enable_2fa(user_ctx)
    code = pyotp.TOTP(setup["manual_secret"]).now()
    # Wrong password
    r = requests.post(f"{API}/auth/2fa/disable", headers=_auth(user_ctx["token"]),
                      json={"password": "wrong", "code": code}, timeout=10)
    assert r.status_code == 401
    # Wrong code
    r = requests.post(f"{API}/auth/2fa/disable", headers=_auth(user_ctx["token"]),
                      json={"password": user_ctx["password"], "code": "000000"}, timeout=10)
    assert r.status_code == 401
    # Both correct
    fresh_code = pyotp.TOTP(setup["manual_secret"]).now()
    r = requests.post(f"{API}/auth/2fa/disable", headers=_auth(user_ctx["token"]),
                      json={"password": user_ctx["password"], "code": fresh_code}, timeout=10)
    assert r.status_code == 200
    assert r.json() == {"enabled": False}


def test_disable_blocked_for_mandatory_role(user_ctx):
    # Promote to nutritionist and enable 2FA
    setup = _enable_2fa(user_ctx)
    _cli().users.update_one({"email": user_ctx["email"]}, {"$set": {"role": "nutritionist"}})
    code = pyotp.TOTP(setup["manual_secret"]).now()
    r = requests.post(f"{API}/auth/2fa/disable", headers=_auth(user_ctx["token"]),
                      json={"password": user_ctx["password"], "code": code}, timeout=10)
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# Users without 2FA still login normally (regression guard)
# ---------------------------------------------------------------------------
def test_login_without_2fa_still_works(user_ctx):
    r = requests.post(f"{API}/auth/login",
                      json={"email": user_ctx["email"], "password": user_ctx["password"]}, timeout=10)
    assert r.status_code == 200
    assert "token" in r.json() and "user" in r.json()


# ---------------------------------------------------------------------------
# Mandatory-role user without 2FA is blocked (must configure)
# ---------------------------------------------------------------------------
def test_mandatory_role_without_2fa_blocked(user_ctx):
    _cli().users.update_one({"email": user_ctx["email"]}, {"$set": {"role": "admin"}})
    r = requests.post(f"{API}/auth/login",
                      json={"email": user_ctx["email"], "password": user_ctx["password"]}, timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert j["status"] == "2fa_setup_required"
    assert "token" not in j
