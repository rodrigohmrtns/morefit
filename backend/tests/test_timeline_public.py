"""Ad-hoc public-URL smoke test for MoreFit rebrand + timeline endpoints.

Runs against the public preview URL from frontend/.env EXPO_PUBLIC_BACKEND_URL
using the seeded Ana user (ana@example.com / secret123).
"""
from __future__ import annotations

import os
import pytest
import requests
from datetime import date
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / "frontend" / ".env")
BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")

EMAIL = "ana@example.com"
PASSWORD = "secret123"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def test_root_rebrand():
    r = requests.get(f"{BASE_URL}/api/", timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert j["app"] == "MoreFit"
    assert j["status"] == "ok"


def test_timeline_month_requires_auth():
    r = requests.get(f"{BASE_URL}/api/timeline/month", params={"ym": "2026-06"}, timeout=15)
    assert r.status_code == 401


def test_timeline_day_requires_auth():
    r = requests.get(f"{BASE_URL}/api/timeline/day", params={"date": "2026-06-15"}, timeout=15)
    assert r.status_code == 401


def test_timeline_month_ana(token):
    r = requests.get(
        f"{BASE_URL}/api/timeline/month",
        params={"ym": "2026-06"},
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["ym"] == "2026-06"
    assert len(j["days"]) == 30
    for d in j["days"]:
        assert "counts" in d and "totals" in d
        assert set(d["counts"].keys()) == {"weight", "meal", "water", "exercise", "sleep", "photo", "mood", "fasting"}
        assert set(d["totals"].keys()) == {"water_ml", "exercise_min", "exercise_kcal", "calories"}


def test_timeline_day_ana(token):
    today = date.today().isoformat()
    r = requests.get(
        f"{BASE_URL}/api/timeline/day",
        params={"date": today},
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["date"] == today
    assert "summary" in j and "events" in j
    for k in ("water_ml", "calories", "exercise_min", "exercise_kcal", "logs_count"):
        assert k in j["summary"]


def test_regression_dashboard(token):
    r = requests.get(f"{BASE_URL}/api/dashboard/summary", headers={"Authorization": f"Bearer {token}"}, timeout=15)
    assert r.status_code == 200


@pytest.mark.parametrize("endpoint", ["/api/water", "/api/meals", "/api/weight", "/api/exercises"])
def test_regression_existing_endpoints(token, endpoint):
    r = requests.get(f"{BASE_URL}{endpoint}", headers={"Authorization": f"Bearer {token}"}, timeout=15)
    assert r.status_code == 200
