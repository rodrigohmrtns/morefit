"""Security helpers — password hashing, JWT, auth dependency, premium guard."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, status

from core.config import settings
from core.database import db
from core.utils import now_utc


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
        "exp": int((now_utc() + timedelta(days=settings.jwt_exp_days)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_alg)


def decode_jwt(token: str) -> Optional[str]:
    try:
        p = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_alg])
        return p.get("sub")
    except Exception:
        return None


def is_premium(u: dict) -> bool:
    """Check if a user document represents an active premium subscription."""
    exp = u.get("premium_expires_at")
    if not exp:
        return False
    try:
        exp_dt = datetime.fromisoformat(exp.replace("Z", "+00:00")) if isinstance(exp, str) else exp
        if exp_dt.tzinfo is None:
            exp_dt = exp_dt.replace(tzinfo=timezone.utc)
        return exp_dt > now_utc()
    except Exception:
        return False


async def resolve_user(token: str) -> Optional[dict]:
    """Resolve a bearer token (JWT or Emergent session) → user document (no password_hash)."""
    if not token:
        return None
    uid = decode_jwt(token)
    if uid:
        user = await db.users.find_one({"user_id": uid}, {"_id": 0, "password_hash": 0})
        if user:
            return user
    # Fallback: session token (Emergent Google Auth)
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if session:
        exp = session.get("expires_at")
        if isinstance(exp, datetime):
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp > now_utc():
                return await db.users.find_one(
                    {"user_id": session["user_id"]},
                    {"_id": 0, "password_hash": 0},
                )
    return None


async def current_user(request: Request) -> dict:
    """FastAPI dependency: extract bearer token, resolve user, or raise 401.

    Rejects users flagged for deletion (except in explicit LGPD cancel path — handled at router level).
    """
    auth = request.headers.get("Authorization", "")
    token = auth.split(" ", 1)[1].strip() if auth.lower().startswith("bearer ") else ""
    user = await resolve_user(token)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Não autenticado")
    if user.get("deleted_at"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Conta excluída")
    return user


async def require_premium(user: dict = Depends(current_user)) -> dict:
    """FastAPI dependency: reject non-premium users with HTTP 402."""
    if not is_premium(user):
        raise HTTPException(402, "Recurso Premium — atualize seu plano para continuar")
    return user
