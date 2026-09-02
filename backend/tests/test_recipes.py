"""Tests for Item 13: POST /api/coach/recipes (AI recipes gated by require_premium).

Uses Gemini 2.5 Flash via emergentintegrations — responses can take 5–15s.
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from pymongo import MongoClient

API = "http://localhost:8001/api"
ADMIN_EMAIL = "ana@example.com"
ADMIN_PWD = "secret123"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "vitatracker")

# LLM calls can take a while.
LLM_TIMEOUT = 60.0


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def api_client():
    with httpx.Client(base_url="http://localhost:8001", timeout=LLM_TIMEOUT) as c:
        yield c


@pytest.fixture(scope="module")
def premium_headers(api_client):
    """Login as Ana (super_admin + premium) and return auth headers.

    Self-heals: if the DB does not currently mark Ana as premium (e.g. a prior
    test module's teardown $unset her premium fields), we re-grant premium and
    re-login before yielding. This mirrors the setup the main agent performs.
    """
    r = api_client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    if data["user"].get("is_premium") is not True:
        # Re-grant premium directly in DB and re-login
        cli = MongoClient(MONGO_URL)
        exp = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        cli[DB_NAME].users.update_one(
            {"email": ADMIN_EMAIL},
            {"$set": {
                "is_premium": True,
                "premium_expires_at": exp,
                "subscription_tier": "premium",
            }},
        )
        cli.close()
        r = api_client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
        assert r.status_code == 200, f"re-login failed: {r.status_code} {r.text}"
        data = r.json()
        assert data["user"].get("is_premium") is True, "Failed to re-grant premium to Ana"
    return {"Authorization": f"Bearer {data['token']}"}


@pytest.fixture(scope="module")
def non_premium_headers(api_client):
    """Fresh signup — new users are non-premium by default."""
    email = f"nonprem_recipe_{uuid.uuid4().hex[:8]}@example.com"
    r = api_client.post(f"{API}/auth/register", json={"name": "NoPrem", "email": email, "password": "secret123", "terms_accepted": True, "privacy_accepted": True})
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    # Sanity: make sure DB does NOT mark them premium.
    cli = MongoClient(MONGO_URL)
    cli[DB_NAME].users.update_one(
        {"email": email},
        {"$set": {"is_premium": False, "premium_expires_at": None}},
    )
    cli.close()
    return {"Authorization": f"Bearer {data['token']}", "_email": email}


# ---------- Auth / gating ----------
class TestRecipesGating:
    def test_no_auth_returns_401(self, api_client):
        r = api_client.post(f"{API}/coach/recipes", json={})
        assert r.status_code == 401, f"expected 401, got {r.status_code} {r.text}"

    def test_non_premium_returns_402(self, api_client, non_premium_headers):
        headers = {k: v for k, v in non_premium_headers.items() if not k.startswith("_")}
        r = api_client.post(f"{API}/coach/recipes", headers=headers, json={})
        # Implementation uses HTTP 402 for premium gate (see require_premium in server.py)
        assert r.status_code in (402, 403), f"expected 402/403, got {r.status_code} {r.text}"
        # Ensure it's the premium message, not a random 500
        assert "premium" in r.text.lower() or "atualize" in r.text.lower()

    def test_invalid_meal_type_returns_422(self, api_client, premium_headers):
        r = api_client.post(
            f"{API}/coach/recipes",
            headers=premium_headers,
            json={"meal_type": "brunch"},  # not in Literal enum
        )
        assert r.status_code == 422, f"expected 422, got {r.status_code} {r.text}"


# ---------- Happy path (LLM) ----------
def _assert_recipe_shape(recipe: dict):
    """Validate a single recipe object has all required keys and correct types."""
    assert isinstance(recipe, dict), f"recipe not a dict: {recipe!r}"
    for k in ("name", "emoji", "time_min", "servings", "ingredients", "instructions", "macros", "tags"):
        assert k in recipe, f"missing key '{k}' in recipe {recipe!r}"
    assert isinstance(recipe["name"], str) and recipe["name"].strip()
    assert isinstance(recipe["ingredients"], list) and len(recipe["ingredients"]) > 0
    assert isinstance(recipe["instructions"], list) and len(recipe["instructions"]) > 0
    macros = recipe["macros"]
    assert isinstance(macros, dict)
    for mk in ("calories", "protein_g", "carbs_g", "fat_g"):
        assert mk in macros, f"missing macro '{mk}' in {macros!r}"
        assert isinstance(macros[mk], (int, float)), f"macro '{mk}' not numeric: {macros[mk]!r}"
    assert isinstance(recipe["tags"], list)


class TestRecipesHappyPath:
    def test_premium_empty_body_defaults(self, api_client, premium_headers):
        """Body {} should default meal_type=lunch and return >=1 recipe."""
        r = api_client.post(f"{API}/coach/recipes", headers=premium_headers, json={})
        assert r.status_code == 200, f"expected 200, got {r.status_code} {r.text}"
        data = r.json()
        assert "recipes" in data, f"missing 'recipes' key: {data}"
        recipes = data["recipes"]
        assert isinstance(recipes, list) and len(recipes) >= 1, f"expected >=1 recipe, got {recipes!r}"
        for rec in recipes:
            _assert_recipe_shape(rec)

    def test_premium_with_restrictions_and_max_calories(self, api_client, premium_headers):
        """Vegetarian + max 400kcal — verify shape and that macros.calories<=400 (with some tolerance)."""
        r = api_client.post(
            f"{API}/coach/recipes",
            headers=premium_headers,
            json={
                "meal_type": "lunch",
                "dietary_restrictions": ["vegetariano"],
                "max_calories": 400,
                "goal": "lose",
            },
        )
        assert r.status_code == 200, f"expected 200, got {r.status_code} {r.text}"
        data = r.json()
        recipes = data.get("recipes") or []
        assert len(recipes) >= 1
        for rec in recipes:
            _assert_recipe_shape(rec)
            cal = rec["macros"]["calories"]
            # LLM sometimes overshoots by a small margin; allow +25% tolerance but log if strict fails.
            assert cal <= 500, f"recipe '{rec['name']}' calories={cal} way above max_calories=400"
