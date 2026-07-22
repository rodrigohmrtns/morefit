"""MoreFit — tests for the new timeline router (calendar + day aggregation)."""
from __future__ import annotations

import os
import uuid
from datetime import date, timedelta
from pathlib import Path

import pytest
from dotenv import load_dotenv
from httpx import ASGITransport, AsyncClient
from motor.motor_asyncio import AsyncIOMotorClient

# Load env before importing server
load_dotenv(Path(__file__).parent.parent / ".env")
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")

from server import app  # noqa: E402

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME", "vitatracker")


@pytest.fixture(scope="module")
def base_url():
    return "http://test"


@pytest.fixture(scope="module")
async def http():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
async def user_token(http: AsyncClient):
    """Register a fresh user and return (token, user_id, email)."""
    email = f"tl_{uuid.uuid4().hex[:8]}@example.com"
    password = "TestPass!123"
    r = await http.post("/api/auth/register", json={
        "name": "Timeline Tester",
        "email": email,
        "password": password,
        "height_cm": 170,
    })
    assert r.status_code == 200, r.text
    j = r.json()
    yield j["token"], j["user"]["user_id"], email

    # Cleanup
    cli = AsyncIOMotorClient(MONGO_URL)
    db = cli[DB_NAME]
    await db.users.delete_one({"email": email})
    for coll in ("weights", "meals", "waters", "exercises", "sleeps", "moods", "photos", "fastings"):
        await db[coll].delete_many({"user_id": j["user"]["user_id"]})


@pytest.mark.anyio
async def test_timeline_month_empty(http: AsyncClient, user_token):
    token, _uid, _email = user_token
    r = await http.get("/api/timeline/month?ym=2026-06", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    j = r.json()
    assert j["ym"] == "2026-06"
    assert len(j["days"]) == 30  # June has 30 days
    # All zero
    assert all(d["counts"]["meal"] == 0 for d in j["days"])
    assert all(d["totals"]["water_ml"] == 0 for d in j["days"])


@pytest.mark.anyio
async def test_timeline_day_empty(http: AsyncClient, user_token):
    token, _uid, _email = user_token
    r = await http.get("/api/timeline/day?date=2026-06-15", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    j = r.json()
    assert j["date"] == "2026-06-15"
    assert j["summary"]["logs_count"] == 0
    assert j["events"] == []


@pytest.mark.anyio
async def test_timeline_with_logs(http: AsyncClient, user_token):
    """Add water + meal + exercise + weight logs and expect them in the timeline."""
    token, _uid, _email = user_token
    hdr = {"Authorization": f"Bearer {token}"}
    today = date.today().isoformat()
    ym = today[:7]

    # Log some entries
    await http.post("/api/water", json={"amount_ml": 300, "date": today, "time": "08:30"}, headers=hdr)
    await http.post("/api/water", json={"amount_ml": 500, "date": today, "time": "12:00"}, headers=hdr)
    await http.post("/api/meals", json={
        "name": "Café da manhã", "meal_type": "breakfast", "calories": 320,
        "protein_g": 12, "carbs_g": 40, "fat_g": 8, "date": today, "time": "08:00",
    }, headers=hdr)
    await http.post("/api/exercises", json={
        "name": "Corrida", "category": "running", "duration_min": 30,
        "calories_burned": 250, "date": today,
    }, headers=hdr)
    await http.post("/api/weight", json={"weight_kg": 72.5, "date": today, "time": "07:00"}, headers=hdr)

    # Month view should now show counts on `today`
    r = await http.get(f"/api/timeline/month?ym={ym}", headers=hdr)
    assert r.status_code == 200
    j = r.json()
    day_cell = next(d for d in j["days"] if d["date"] == today)
    assert day_cell["counts"]["water"] == 2
    assert day_cell["counts"]["meal"] == 1
    assert day_cell["counts"]["exercise"] == 1
    assert day_cell["counts"]["weight"] == 1
    assert day_cell["totals"]["water_ml"] == 800
    assert day_cell["totals"]["calories"] == 320
    assert day_cell["totals"]["exercise_min"] == 30
    assert day_cell["totals"]["exercise_kcal"] == 250

    # Day view should return 5 sorted events
    r = await http.get(f"/api/timeline/day?date={today}", headers=hdr)
    assert r.status_code == 200
    j = r.json()
    assert j["summary"]["logs_count"] == 5
    assert j["summary"]["water_ml"] == 800
    assert j["summary"]["calories"] == 320
    kinds = [ev["kind"] for ev in j["events"]]
    assert set(kinds) == {"weight", "meal", "water", "exercise"}
    # sorted by time
    times = [ev["time"] for ev in j["events"]]
    assert times == sorted(times)


@pytest.mark.anyio
async def test_timeline_requires_auth(http: AsyncClient):
    r = await http.get("/api/timeline/month?ym=2026-06")
    assert r.status_code == 401
    r = await http.get("/api/timeline/day?date=2026-06-15")
    assert r.status_code == 401
