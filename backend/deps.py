"""Shared dependencies for MoreFit routers.

Everything that is imported by more than one router lives here so that
individual routers stay focused on their own domain.
"""
from __future__ import annotations

import json
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal, Optional

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, Request, status
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# --- Config ---
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME", "vitatracker")
JWT_SECRET = os.environ.get("JWT_SECRET", "dev_secret")
JWT_ALG = "HS256"
JWT_EXP_DAYS = 30
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")

# --- Database ---
_client = AsyncIOMotorClient(MONGO_URL)
db = _client[DB_NAME]


# --- Utils ---
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def today_iso() -> str:
    return now_utc().date().isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def make_jwt(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": int(now_utc().timestamp()),
        "exp": int((now_utc() + timedelta(days=JWT_EXP_DAYS)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decode_jwt(token: str) -> Optional[str]:
    try:
        p = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        return p.get("sub")
    except Exception:
        return None


def _extract_json(text: str) -> dict:
    """Best-effort JSON extraction from LLM text."""
    if not text:
        return {}
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        return {}
    try:
        return json.loads(m.group(0))
    except Exception:
        return {}


# --- Auth helpers ---
async def resolve_user(token: str) -> Optional[dict]:
    if not token:
        return None
    # 1) JWT (email/senha)
    uid = decode_jwt(token)
    if uid:
        user = await db.users.find_one({"user_id": uid}, {"_id": 0, "password_hash": 0})
        if user:
            return user
    # 2) Emergent session token
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if session:
        exp = session.get("expires_at")
        if isinstance(exp, datetime):
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp > now_utc():
                user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0, "password_hash": 0})
                if user:
                    return user
    return None


async def current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    token = auth.split(" ", 1)[1].strip() if auth.lower().startswith("bearer ") else ""
    user = await resolve_user(token)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Não autenticado")
    return user


def _is_premium(u: dict) -> bool:
    exp = u.get("premium_expires_at")
    if not exp:
        return False
    try:
        if isinstance(exp, str):
            exp_dt = datetime.fromisoformat(exp.replace("Z", "+00:00"))
        else:
            exp_dt = exp
        if exp_dt.tzinfo is None:
            exp_dt = exp_dt.replace(tzinfo=timezone.utc)
        return exp_dt > now_utc()
    except Exception:
        return False


def _public_user(u: dict) -> dict:
    out = {k: v for k, v in u.items() if k not in ("password_hash", "_id")}
    out["is_premium"] = _is_premium(u)
    return out


async def require_premium(user: dict = Depends(current_user)) -> dict:
    """FastAPI dependency: reject non-premium users with HTTP 402."""
    if not _is_premium(user):
        raise HTTPException(402, "Recurso Premium — atualize seu plano para continuar")
    return user


# ============================================================================
# Shared Pydantic models
# ============================================================================
class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleSessionIn(BaseModel):
    session_token: str


class ProfileIn(BaseModel):
    name: Optional[str] = None
    gender: Optional[Literal["male", "female", "other"]] = None
    birth_date: Optional[str] = None
    height_cm: Optional[float] = None
    starting_weight_kg: Optional[float] = None
    goal_weight_kg: Optional[float] = None
    activity_level: Optional[Literal["sedentary", "light", "moderate", "active", "very_active"]] = None
    goal: Optional[Literal["lose", "maintain", "gain", "improve_health"]] = None
    daily_calorie_goal: Optional[int] = None
    daily_water_ml_goal: Optional[int] = None
    daily_steps_goal: Optional[int] = None
    daily_sleep_hours_goal: Optional[float] = None
    target_date: Optional[str] = None
    photo_base64: Optional[str] = None


class WeightIn(BaseModel):
    weight_kg: float
    date: Optional[str] = None
    time: Optional[str] = None
    note: Optional[str] = None
    source: Optional[Literal["manual", "bluetooth"]] = "manual"
    body_fat_pct: Optional[float] = None
    muscle_mass_kg: Optional[float] = None
    body_water_pct: Optional[float] = None
    protein_pct: Optional[float] = None
    lean_mass_kg: Optional[float] = None
    bone_mass_kg: Optional[float] = None
    visceral_fat: Optional[float] = None
    bmr_kcal: Optional[int] = None
    metabolic_age: Optional[int] = None
    waist_cm: Optional[float] = None
    hip_cm: Optional[float] = None
    arm_cm: Optional[float] = None
    chest_cm: Optional[float] = None
    abdomen_cm: Optional[float] = None
    thigh_cm: Optional[float] = None
    calf_cm: Optional[float] = None
    neck_cm: Optional[float] = None
    shoulders_cm: Optional[float] = None


class MealIn(BaseModel):
    name: str
    meal_type: Literal["breakfast", "lunch", "dinner", "snack"]
    calories: float
    protein_g: float = 0
    carbs_g: float = 0
    fat_g: float = 0
    portion: Optional[str] = None
    image_base64: Optional[str] = None
    date: Optional[str] = None


class MealAnalyzeIn(BaseModel):
    image_base64: str
    meal_type: Literal["breakfast", "lunch", "dinner", "snack"] = "snack"


class WaterIn(BaseModel):
    amount_ml: int
    date: Optional[str] = None


class ExerciseIn(BaseModel):
    name: str
    category: Optional[Literal["gym", "running", "bike", "walking", "swimming", "crossfit", "pilates", "yoga", "custom"]] = "custom"
    duration_min: int
    calories_burned: float
    intensity: Optional[Literal["low", "moderate", "high"]] = "moderate"
    note: Optional[str] = None
    date: Optional[str] = None


class SleepIn(BaseModel):
    hours: float
    quality: Optional[Literal["poor", "ok", "good", "great"]] = "good"
    rem_hours: Optional[float] = None
    deep_hours: Optional[float] = None
    light_hours: Optional[float] = None
    bedtime: Optional[str] = None
    wake_time: Optional[str] = None
    note: Optional[str] = None
    date: Optional[str] = None


class MoodIn(BaseModel):
    mood: Literal["awful", "bad", "ok", "good", "great"]
    note: Optional[str] = None
    date: Optional[str] = None
