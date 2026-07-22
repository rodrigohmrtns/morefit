"""MoreFit Backend API Tests - covers auth, profile, weight, meals, water, dashboard, meals/analyze."""
import base64
import io
import os
import time
import uuid

import pytest
import requests
from PIL import Image, ImageDraw

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://fitpro-ecosystem-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# ----- Fixtures -----
@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def user_ctx(api_client):
    """Create a fresh test user; return token + user."""
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    payload = {"name": "Test User", "email": email, "password": "secret123"}
    r = api_client.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    return {"token": data["token"], "user": data["user"], "email": email, "password": "secret123"}


@pytest.fixture
def auth_headers(user_ctx):
    return {"Authorization": f"Bearer {user_ctx['token']}"}


@pytest.fixture
def premium_auth_headers(user_ctx, auth_headers):
    """Grant premium tier directly in DB for tests that hit gated endpoints."""
    from datetime import datetime, timezone, timedelta
    from pymongo import MongoClient
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    cli = MongoClient(mongo_url)
    db = cli[os.environ.get("DB_NAME", "vitatracker")]
    exp = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
    db.users.update_one(
        {"email": user_ctx["email"]},
        {"$set": {"subscription_tier": "premium", "premium_expires_at": exp,
                  "premium_since": datetime.now(timezone.utc).isoformat(),
                  "last_plan": "annual"}},
    )
    yield auth_headers
    db.users.update_one(
        {"email": user_ctx["email"]},
        {"$unset": {"subscription_tier": "", "premium_expires_at": "",
                    "premium_since": "", "last_plan": ""}},
    )
    cli.close()


def _real_food_image_b64() -> str:
    """Generate JPEG bytes of a food-ish scene with real textures/edges/shadows."""
    img = Image.new("RGB", (512, 512), (255, 245, 220))
    d = ImageDraw.Draw(img)
    # plate
    d.ellipse((40, 40, 472, 472), fill=(240, 240, 240), outline=(150, 150, 150), width=4)
    # rice pile
    for i in range(200):
        x = 180 + (i * 37) % 160
        y = 180 + (i * 53) % 140
        d.ellipse((x, y, x + 6, y + 4), fill=(255, 250, 230))
    # beans
    for i in range(60):
        x = 120 + (i * 29) % 260
        y = 300 + (i * 17) % 100
        d.ellipse((x, y, x + 14, y + 10), fill=(80, 40, 20))
    # chicken (brown blob)
    d.rounded_rectangle((250, 120, 400, 240), radius=30, fill=(180, 110, 60), outline=(120, 70, 30), width=3)
    # broccoli
    for i in range(30):
        x = 80 + (i * 13) % 90
        y = 130 + (i * 23) % 90
        d.ellipse((x, y, x + 22, y + 22), fill=(30, 110, 40))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode()


# ----- Health -----
class TestHealth:
    def test_root(self, api_client):
        r = api_client.get(f"{API}/")
        assert r.status_code == 200
        j = r.json()
        assert j.get("status") == "ok"
        assert j.get("app") == "MoreFit"


# ----- Auth -----
class TestAuth:
    def test_register_returns_jwt_and_user(self, user_ctx):
        assert user_ctx["token"] and isinstance(user_ctx["token"], str)
        assert user_ctx["user"]["email"] == user_ctx["email"]
        assert user_ctx["user"]["onboarded"] is False
        assert "password_hash" not in user_ctx["user"]

    def test_register_duplicate_email(self, api_client, user_ctx):
        r = api_client.post(f"{API}/auth/register", json={
            "name": "Dup", "email": user_ctx["email"], "password": "secret123"
        })
        assert r.status_code == 400

    def test_login_valid(self, api_client, user_ctx):
        r = api_client.post(f"{API}/auth/login", json={
            "email": user_ctx["email"], "password": user_ctx["password"]
        })
        assert r.status_code == 200
        assert "token" in r.json()

    def test_login_wrong_password(self, api_client, user_ctx):
        r = api_client.post(f"{API}/auth/login", json={
            "email": user_ctx["email"], "password": "wrongpass"
        })
        assert r.status_code == 401

    def test_me_with_token(self, api_client, auth_headers, user_ctx):
        r = api_client.get(f"{API}/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["user"]["email"] == user_ctx["email"]

    def test_me_without_token(self, api_client):
        r = api_client.get(f"{API}/auth/me")
        assert r.status_code == 401


# ----- Profile -----
class TestProfile:
    def test_update_profile_sets_onboarded(self, api_client, auth_headers):
        r = api_client.put(f"{API}/profile", headers=auth_headers, json={
            "gender": "female", "birth_date": "1995-05-10", "height_cm": 165,
            "starting_weight_kg": 70, "goal_weight_kg": 62,
            "activity_level": "moderate", "goal": "lose",
            "daily_calorie_goal": 1800, "daily_water_ml_goal": 2200,
        })
        assert r.status_code == 200
        u = r.json()["user"]
        assert u["onboarded"] is True
        assert u["daily_calorie_goal"] == 1800
        assert u["goal"] == "lose"

        # Verify persistence
        r2 = api_client.get(f"{API}/auth/me", headers=auth_headers)
        assert r2.json()["user"]["daily_calorie_goal"] == 1800


# ----- Weight -----
class TestWeight:
    def test_create_and_list_weight_desc(self, api_client, auth_headers):
        for d, w in [("2026-01-05", 70.0), ("2026-01-06", 69.5), ("2026-01-07", 69.2)]:
            r = api_client.post(f"{API}/weight", headers=auth_headers, json={"weight_kg": w, "date": d})
            assert r.status_code == 200
            assert r.json()["weight_kg"] == w
        r = api_client.get(f"{API}/weight", headers=auth_headers)
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 3
        dates = [i["date"] for i in items[:3]]
        assert dates == sorted(dates, reverse=True)


# ----- Meals -----
class TestMeals:
    def test_create_list_delete_meal(self, api_client, auth_headers):
        r = api_client.post(f"{API}/meals", headers=auth_headers, json={
            "name": "Arroz e Frango", "meal_type": "lunch",
            "calories": 550, "protein_g": 40, "carbs_g": 60, "fat_g": 12, "portion": "1 prato",
        })
        assert r.status_code == 200
        meal_id = r.json()["id"]
        assert r.json()["calories"] == 550

        r2 = api_client.get(f"{API}/meals", headers=auth_headers)
        assert r2.status_code == 200
        assert any(m["id"] == meal_id for m in r2.json()["items"])

        r3 = api_client.delete(f"{API}/meals/{meal_id}", headers=auth_headers)
        assert r3.status_code == 200

        r4 = api_client.get(f"{API}/meals", headers=auth_headers)
        assert not any(m["id"] == meal_id for m in r4.json()["items"])


# ----- Water -----
class TestWater:
    def test_water_total_ml(self, api_client, auth_headers):
        # Use a unique date to isolate
        d = f"2026-01-{(int(time.time()) % 28) + 1:02d}"
        # Clean baseline: current items on that date (likely none)
        base = api_client.get(f"{API}/water", headers=auth_headers, params={"date": d}).json().get("total_ml", 0)
        for amt in (200, 300, 500):
            r = api_client.post(f"{API}/water", headers=auth_headers, json={"amount_ml": amt, "date": d})
            assert r.status_code == 200
        r = api_client.get(f"{API}/water", headers=auth_headers, params={"date": d})
        assert r.status_code == 200
        assert r.json()["total_ml"] == base + 1000


# ----- Dashboard -----
class TestDashboard:
    def test_dashboard_summary_shape(self, api_client, auth_headers):
        # Seed meal + water for today
        api_client.post(f"{API}/meals", headers=auth_headers, json={
            "name": "Café", "meal_type": "breakfast",
            "calories": 300, "protein_g": 15, "carbs_g": 30, "fat_g": 10,
        })
        api_client.post(f"{API}/water", headers=auth_headers, json={"amount_ml": 250})
        r = api_client.get(f"{API}/dashboard/summary", headers=auth_headers)
        assert r.status_code == 200
        j = r.json()
        for key in ("date", "calories", "macros", "water", "meals_count"):
            assert key in j
        assert "consumed" in j["calories"] and "goal" in j["calories"]
        assert "protein_g" in j["macros"]
        assert j["calories"]["consumed"] >= 300
        assert j["water"]["total_ml"] >= 250
        assert j["meals_count"] >= 1


# ----- Meals/analyze (Gemini) -----
class TestMealAnalyze:
    def test_analyze_real_food_image(self, api_client, premium_auth_headers):
        auth_headers = premium_auth_headers
        img_b64 = _real_food_image_b64()
        r = api_client.post(f"{API}/meals/analyze", headers=auth_headers,
                            json={"image_base64": img_b64, "meal_type": "lunch"},
                            timeout=90)
        assert r.status_code == 200, f"analyze failed: {r.status_code} {r.text[:400]}"
        analysis = r.json().get("analysis") or {}
        for k in ("calories", "protein_g", "carbs_g", "fat_g"):
            assert k in analysis, f"missing {k} in analysis: {analysis}"
        assert isinstance(analysis["calories"], (int, float))
        assert analysis["calories"] > 0
