"""Tests for the 3 CRITICAL security improvements (against a running backend):
1. HttpOnly cookie auth for the professional portal
2. Content-Security-Policy + other headers on API responses
3. Image upload sanitization (magic bytes, EXIF strip, quota, size)

Uses `requests` (sync) against a running backend on localhost:8001 to avoid
interfering with the async event loop of other test files.
"""
from __future__ import annotations

import base64
import io
import os
import uuid

import pytest
import requests
from PIL import Image
from pymongo import MongoClient

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "vitatracker")


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture
def regular_user():
    email = f"sec_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={
        "name": "Sec Tester", "email": email, "password": "TestPass!123",
        "terms_accepted": True, "privacy_accepted": True,
    }, timeout=10)
    assert r.status_code == 200, r.text
    j = r.json()
    yield j["token"], j["user"]["user_id"], email
    # Cleanup
    cli = MongoClient(MONGO_URL)
    db = cli[DB_NAME]
    db.users.delete_one({"email": email})
    db.photos.delete_many({"user_id": j["user"]["user_id"]})
    db.meals.delete_many({"user_id": j["user"]["user_id"]})


@pytest.fixture
def professional_user():
    """Professional (nutritionist) with 2FA fully enabled — as required by policy."""
    import pyotp as _pyotp
    email = f"nutri_{uuid.uuid4().hex[:8]}@example.com"
    password = "TestPass!123"
    r = requests.post(f"{API}/auth/register", json={
        "name": "Dr Test", "email": email, "password": password,
        "terms_accepted": True, "privacy_accepted": True,
    }, timeout=10)
    assert r.status_code == 200
    token = r.json()["token"]
    uid = r.json()["user"]["user_id"]
    # Enable 2FA
    setup = requests.post(f"{API}/auth/2fa/setup",
                          headers={"Authorization": f"Bearer {token}"}, timeout=10).json()
    code = _pyotp.TOTP(setup["manual_secret"]).now()
    requests.post(f"{API}/auth/2fa/enable",
                  headers={"Authorization": f"Bearer {token}"},
                  json={"code": code}, timeout=10).raise_for_status()
    # Promote to nutritionist (mandatory 2FA role)
    cli = MongoClient(MONGO_URL)
    db = cli[DB_NAME]
    db.users.update_one({"user_id": uid}, {"$set": {"role": "nutritionist"}})
    yield email, password, uid, setup["manual_secret"]
    db.users.delete_one({"user_id": uid})
    db.auth_challenges.delete_many({"user_id": uid})


def _portal_login_with_2fa(email: str, password: str, secret: str,
                            session: requests.Session | None = None):
    """Full portal login: password → challenge → TOTP verify. Returns final response."""
    import pyotp as _pyotp
    s = session or requests
    r1 = s.post(f"{API}/auth/portal/login",
                json={"email": email, "password": password}, timeout=10)
    assert r1.status_code == 200
    j = r1.json()
    assert j.get("status") == "2fa_required", f"Expected challenge, got {j}"
    code = _pyotp.TOTP(secret).now()
    r2 = s.post(f"{API}/auth/2fa/verify-login",
                json={"challenge_id": j["challenge_id"], "code": code}, timeout=10)
    return r2


def _make_test_jpeg_with_exif(width=100, height=100) -> bytes:
    img = Image.new("RGB", (width, height), color=(200, 150, 100))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90, exif=b"Exif\x00\x00SECRET_GPS_DATA_TO_STRIP")
    return buf.getvalue()


def _b64(raw: bytes) -> str:
    return base64.b64encode(raw).decode()


# ===========================================================================
# ITEM 1 — HttpOnly cookie flow for the portal
# ===========================================================================
class TestPortalCookieAuth:
    def test_login_denied_for_regular_user(self, regular_user):
        _tok, _uid, email = regular_user
        r = requests.post(f"{API}/auth/portal/login", json={
            "email": email, "password": "TestPass!123",
        }, timeout=10)
        assert r.status_code == 403
        assert "portal" in r.json()["detail"].lower()

    def test_login_wrong_password(self, professional_user):
        email, _pw, _uid, _sec = professional_user
        r = requests.post(f"{API}/auth/portal/login", json={
            "email": email, "password": "wrong",
        }, timeout=10)
        assert r.status_code == 401

    def test_portal_login_sets_httponly_cookie(self, professional_user):
        email, pw, _uid, secret = professional_user
        r = _portal_login_with_2fa(email, pw, secret)
        assert r.status_code == 200, r.text
        assert "token" not in r.json()
        assert r.json().get("user", {}).get("email") == email
        set_cookie = r.headers.get("set-cookie", "")
        assert "mf_portal_session=" in set_cookie
        assert "HttpOnly" in set_cookie
        assert "Path=/" in set_cookie
        assert "samesite" in set_cookie.lower()

    def test_portal_me_via_cookie(self, professional_user):
        email, pw, _uid, secret = professional_user
        s = requests.Session()
        r = _portal_login_with_2fa(email, pw, secret, session=s)
        assert r.status_code == 200
        # Session auto-persists cookies
        r = s.get(f"{API}/auth/portal/me", timeout=10)
        assert r.status_code == 200
        assert r.json()["user"]["email"] == email

    def test_portal_me_denied_without_cookie(self):
        r = requests.get(f"{API}/auth/portal/me", timeout=10)
        assert r.status_code == 401

    def test_portal_logout_clears_cookie(self, professional_user):
        email, pw, _uid, secret = professional_user
        s = requests.Session()
        _portal_login_with_2fa(email, pw, secret, session=s)
        r = s.post(f"{API}/auth/portal/logout", timeout=10)
        assert r.status_code == 200
        # Cookie should be cleared (max-age=0 or Expires=past)
        set_cookie = r.headers.get("set-cookie", "")
        assert "mf_portal_session=" in set_cookie
        assert ("Max-Age=0" in set_cookie or "1970" in set_cookie or "Expires=" in set_cookie)


# ===========================================================================
# ITEM 2 — Security headers on API responses
# ===========================================================================
class TestSecurityHeaders:
    def test_hsts_header(self):
        r = requests.get(f"{API}/", timeout=10)
        assert r.status_code == 200
        assert "max-age" in r.headers.get("strict-transport-security", "")

    def test_xfo_and_nosniff(self):
        r = requests.get(f"{API}/", timeout=10)
        assert r.headers.get("x-frame-options") == "DENY"
        assert r.headers.get("x-content-type-options") == "nosniff"

    def test_permissions_policy(self):
        r = requests.get(f"{API}/", timeout=10)
        pp = r.headers.get("permissions-policy", "")
        assert "camera=()" in pp
        assert "microphone=()" in pp
        assert "geolocation=()" in pp

    def test_csp_on_json_api(self):
        r = requests.get(f"{API}/", timeout=10)
        csp = r.headers.get("content-security-policy", "")
        assert "default-src 'none'" in csp
        assert "frame-ancestors 'none'" in csp

    def test_referrer_policy(self):
        r = requests.get(f"{API}/", timeout=10)
        assert r.headers.get("referrer-policy") == "strict-origin-when-cross-origin"


# ===========================================================================
# ITEM 3 — Image sanitization
# ===========================================================================
class TestImageSanitization:
    def test_rejects_non_image_bytes(self, regular_user):
        tok, _uid, _email = regular_user
        r = requests.post(f"{API}/photos",
            json={"image_base64": _b64(b"this is definitely not an image")},
            headers={"Authorization": f"Bearer {tok}"}, timeout=10)
        assert r.status_code == 400

    def test_rejects_empty_string(self, regular_user):
        tok, _uid, _email = regular_user
        r = requests.post(f"{API}/photos",
            json={"image_base64": ""},
            headers={"Authorization": f"Bearer {tok}"}, timeout=10)
        assert r.status_code == 400

    def test_rejects_invalid_base64(self, regular_user):
        tok, _uid, _email = regular_user
        r = requests.post(f"{API}/photos",
            json={"image_base64": "!!!not base64!!!"},
            headers={"Authorization": f"Bearer {tok}"}, timeout=10)
        assert r.status_code == 400

    def test_rejects_oversized_image(self, regular_user):
        tok, _uid, _email = regular_user
        big = b"\xff\xd8\xff" + os.urandom(6 * 1024 * 1024)
        r = requests.post(f"{API}/photos",
            json={"image_base64": _b64(big)},
            headers={"Authorization": f"Bearer {tok}"}, timeout=30)
        assert r.status_code in (400, 413)

    def test_accepts_valid_jpeg_and_strips_metadata(self, regular_user):
        tok, _uid, _email = regular_user
        raw = _make_test_jpeg_with_exif(200, 200)
        r = requests.post(f"{API}/photos",
            json={"image_base64": _b64(raw), "note": "test"},
            headers={"Authorization": f"Bearer {tok}"}, timeout=15)
        assert r.status_code == 200, r.text
        stored_raw = base64.b64decode(r.json()["image_base64"])
        img = Image.open(io.BytesIO(stored_raw))
        assert img.format == "JPEG"
        exif = img.getexif()
        assert not exif or len(exif) == 0
        assert b"SECRET_GPS_DATA_TO_STRIP" not in stored_raw

    def test_downscales_huge_image(self, regular_user):
        tok, _uid, _email = regular_user
        img = Image.new("RGB", (4000, 4000), color=(50, 50, 200))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=80)
        r = requests.post(f"{API}/photos",
            json={"image_base64": _b64(buf.getvalue())},
            headers={"Authorization": f"Bearer {tok}"}, timeout=30)
        assert r.status_code == 200, r.text
        stored = Image.open(io.BytesIO(base64.b64decode(r.json()["image_base64"])))
        assert max(stored.size) <= 2048

    def test_accepts_data_uri_prefix(self, regular_user):
        tok, _uid, _email = regular_user
        raw = _make_test_jpeg_with_exif(50, 50)
        b64_with_prefix = f"data:image/jpeg;base64,{_b64(raw)}"
        r = requests.post(f"{API}/photos",
            json={"image_base64": b64_with_prefix},
            headers={"Authorization": f"Bearer {tok}"}, timeout=10)
        assert r.status_code == 200
