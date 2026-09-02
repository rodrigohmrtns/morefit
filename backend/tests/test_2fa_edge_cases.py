"""Optional additional 2FA TOTP edge-case tests.

Covers gaps identified during review:
- Enable without a pending setup should return 400.
- Anti-replay: the SAME successful TOTP cannot be reused on a new challenge.
- Rate-limit: verify-login rejects after CHALLENGE_MAX_ATTEMPTS (5) with 429.
- verify-login on an expired/consumed challenge fails cleanly.
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
        "name": "TOTP Edge", "email": email, "password": password,
        "terms_accepted": True, "privacy_accepted": True,
    }, timeout=10)
    r.raise_for_status()
    return r.json()


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def user_ctx():
    email = f"totpx_{uuid.uuid4().hex[:8]}@example.com"
    data = _register(email)
    yield {"email": email, "password": "Passw0rd!23", "token": data["token"], "user": data["user"]}
    _cleanup(email)


def _enable_2fa(ctx):
    setup = requests.post(f"{API}/auth/2fa/setup", headers=_auth(ctx["token"]), timeout=10).json()
    code = pyotp.TOTP(setup["manual_secret"]).now()
    requests.post(f"{API}/auth/2fa/enable", headers=_auth(ctx["token"]),
                  json={"code": code}, timeout=10).raise_for_status()
    return setup


# ---------------------------------------------------------------------------
# Enable without prior /setup
# ---------------------------------------------------------------------------
def test_enable_without_setup_returns_400(user_ctx):
    r = requests.post(f"{API}/auth/2fa/enable", headers=_auth(user_ctx["token"]),
                      json={"code": "123456"}, timeout=10)
    assert r.status_code == 400
    body = r.json()
    # Portuguese message from router
    assert "setup" in body.get("detail", "").lower() or "pendente" in body.get("detail", "").lower()


# ---------------------------------------------------------------------------
# Anti-replay: the same TOTP cannot be reused on a fresh challenge
# ---------------------------------------------------------------------------
def test_totp_anti_replay_same_code_rejected(user_ctx):
    setup = _enable_2fa(user_ctx)
    code = pyotp.TOTP(setup["manual_secret"]).now()

    # First login + verify — succeeds
    login1 = requests.post(f"{API}/auth/2fa/login",
                           json={"email": user_ctx["email"], "password": user_ctx["password"],
                                 "channel": "mobile"}, timeout=10).json()
    v1 = requests.post(f"{API}/auth/2fa/verify-login",
                       json={"challenge_id": login1["challenge_id"], "code": code}, timeout=10)
    assert v1.status_code == 200, v1.text
    assert v1.json()["via"] == "totp"

    # Second login attempt — SAME code, same 30s window → must be rejected
    login2 = requests.post(f"{API}/auth/2fa/login",
                           json={"email": user_ctx["email"], "password": user_ctx["password"],
                                 "channel": "mobile"}, timeout=10).json()
    v2 = requests.post(f"{API}/auth/2fa/verify-login",
                       json={"challenge_id": login2["challenge_id"], "code": code}, timeout=10)
    assert v2.status_code == 401, v2.text


# ---------------------------------------------------------------------------
# Challenge rate-limit: 5 wrong attempts → 429 and challenge is invalidated
# ---------------------------------------------------------------------------
def test_challenge_locks_after_max_attempts(user_ctx):
    _enable_2fa(user_ctx)
    login = requests.post(f"{API}/auth/2fa/login",
                          json={"email": user_ctx["email"], "password": user_ctx["password"],
                                "channel": "mobile"}, timeout=10).json()
    cid = login["challenge_id"]

    # 5 failed attempts. Router pre-checks attempts BEFORE incrementing, so:
    # - attempts 1..4 → 401 (bad code)
    # - attempt 5 → still 401 (attempts == 4 before check < 5)
    # - attempt 6 → 429 (attempts == 5 before check, hits threshold)
    statuses = []
    for _ in range(6):
        r = requests.post(f"{API}/auth/2fa/verify-login",
                          json={"challenge_id": cid, "code": "000000"}, timeout=10)
        statuses.append(r.status_code)
    # Expect a 429 somewhere in the tail once the threshold is crossed.
    assert 429 in statuses, f"expected 429 after repeated failures, got {statuses}"
    # And the challenge must be gone → subsequent request also 401 (invalid/expired)
    r_after = requests.post(f"{API}/auth/2fa/verify-login",
                            json={"challenge_id": cid, "code": "000000"}, timeout=10)
    assert r_after.status_code in (401, 429)


# ---------------------------------------------------------------------------
# Consumed challenge cannot be reused after a successful verify
# ---------------------------------------------------------------------------
def test_challenge_single_use(user_ctx):
    setup = _enable_2fa(user_ctx)
    login = requests.post(f"{API}/auth/2fa/login",
                          json={"email": user_ctx["email"], "password": user_ctx["password"],
                                "channel": "mobile"}, timeout=10).json()
    cid = login["challenge_id"]
    code = pyotp.TOTP(setup["manual_secret"]).now()
    ok = requests.post(f"{API}/auth/2fa/verify-login",
                       json={"challenge_id": cid, "code": code}, timeout=10)
    assert ok.status_code == 200
    # Reusing the same challenge id must fail
    again = requests.post(f"{API}/auth/2fa/verify-login",
                          json={"challenge_id": cid, "code": code}, timeout=10)
    assert again.status_code == 401
