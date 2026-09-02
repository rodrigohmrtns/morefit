"""Two-Factor Authentication (TOTP) endpoints.

Flow:
  1. `POST /auth/2fa/setup`   — generates a secret + QR + 10 backup codes
                                (persists in `totp_pending`, not enabled yet).
  2. `POST /auth/2fa/enable`  — user confirms with the first live code;
                                moves pending → active.
  3. Login flow: password OK + 2FA active → returns `challenge_id`.
     `POST /auth/2fa/verify-login` accepts either TOTP or a backup code.
  4. `POST /auth/2fa/disable` — requires current password AND a valid code
                                (blocked for mandatory-2FA roles).
  5. `POST /auth/2fa/backup-codes/regenerate` — issue fresh 10 codes.
  6. `GET  /auth/2fa/status`  — {enabled, mandatory, pending}.
"""
from __future__ import annotations

import secrets
from datetime import timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field

from core.totp import (
    BACKUP_CODE_COUNT,
    code_hash,
    decrypt_secret,
    encrypt_secret,
    is_2fa_enabled,
    is_2fa_mandatory,
    new_backup_codes,
    new_secret,
    qr_data_url,
    verify_totp_get_timecode,
    verify_totp_simple,
)
from deps import (
    LoginIn,
    PORTAL_COOKIE_NAME,
    _public_user,
    current_user,
    db,
    make_jwt,
    now_utc,
    verify_password,
)
from middleware.security import auth_rate_limit
from services.audit_service import audit_service

router = APIRouter(prefix="/auth/2fa", tags=["2fa"])

# ---------------------------------------------------------------------------
# Constants — mirrored from auth.py for portal cookie
# ---------------------------------------------------------------------------
import os
IS_PROD = os.environ.get("ENV", "dev").lower() in ("prod", "production")
PORTAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 30


def _cookie_kwargs():
    return {
        "httponly": True,
        "secure": IS_PROD,
        "samesite": "lax" if not IS_PROD else "strict",
        "path": "/",
    }


CHALLENGE_TTL_MIN = 5
CHALLENGE_MAX_ATTEMPTS = 5


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class CodeIn(BaseModel):
    code: str = Field(min_length=6, max_length=32)


class DisableIn(BaseModel):
    password: str
    code: str = Field(min_length=6, max_length=32)


class VerifyLoginIn(BaseModel):
    challenge_id: str
    code: str = Field(min_length=6, max_length=32)


class LoginWithChannelIn(BaseModel):
    email: EmailStr
    password: str
    channel: Literal["mobile", "portal"] = "mobile"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
async def _issue_login_success(user: dict, channel: str, response: Response, request: Request):
    """Emit a session (bearer or cookie) after a successful (password + optional 2FA) flow."""
    await audit_service.log_event(event_type="auth.login", user=user, request=request)
    if channel == "portal":
        token = make_jwt(user["user_id"])
        response.set_cookie(
            key=PORTAL_COOKIE_NAME, value=token, max_age=PORTAL_COOKIE_MAX_AGE, **_cookie_kwargs()
        )
        return {"authenticated": True, "user": _public_user(user)}
    return {"token": make_jwt(user["user_id"]), "user": _public_user(user)}


async def _create_login_challenge(user: dict, channel: str) -> str:
    """Create a short-lived challenge doc; returns its id."""
    cid = secrets.token_urlsafe(24)
    await db.auth_challenges.insert_one({
        "_id": cid,
        "user_id": user["user_id"],
        "channel": channel,
        "purpose": "login_2fa",
        "attempts": 0,
        "created_at": now_utc(),
        "expires_at": now_utc() + timedelta(minutes=CHALLENGE_TTL_MIN),
    })
    return cid


async def _validate_challenge(challenge_id: str) -> dict:
    ch = await db.auth_challenges.find_one({"_id": challenge_id})
    if not ch:
        raise HTTPException(401, "Challenge inválido ou expirado")
    if ch.get("expires_at") and ch["expires_at"] <= now_utc().replace(tzinfo=ch["expires_at"].tzinfo):
        await db.auth_challenges.delete_one({"_id": challenge_id})
        raise HTTPException(401, "Challenge expirado")
    if ch.get("attempts", 0) >= CHALLENGE_MAX_ATTEMPTS:
        await db.auth_challenges.delete_one({"_id": challenge_id})
        raise HTTPException(429, "Muitas tentativas — reinicie o login")
    return ch


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------
@router.get("/status")
async def status_2fa(user: dict = Depends(current_user)):
    fresh = await db.users.find_one({"user_id": user["user_id"]})
    return {
        "enabled": is_2fa_enabled(fresh),
        "mandatory": is_2fa_mandatory(fresh),
        "pending": bool((fresh or {}).get("totp_pending")),
        "backup_codes_remaining": len(((fresh or {}).get("totp") or {}).get("backup_code_hashes") or []),
    }


# ---------------------------------------------------------------------------
# Setup (returns QR + backup codes, does NOT activate)
# ---------------------------------------------------------------------------
@router.post("/setup")
async def setup_2fa(request: Request, user: dict = Depends(current_user)):
    if is_2fa_enabled(user):
        raise HTTPException(400, "2FA já está ativo. Desative antes de reconfigurar.")
    secret = new_secret()
    plain_codes, hashes = new_backup_codes()
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"totp_pending": {
            "secret_enc": encrypt_secret(secret),
            "backup_code_hashes": hashes,
            "created_at": now_utc(),
        }}},
    )
    await audit_service.log_event(event_type="auth.2fa_setup_started", user=user, request=request)
    return {
        "qr_data_url": qr_data_url(user["email"], secret),
        "manual_secret": secret,
        "backup_codes": plain_codes,
        "issuer": "MoreFit",
    }


# ---------------------------------------------------------------------------
# Enable — confirm first code
# ---------------------------------------------------------------------------
@router.post("/enable")
async def enable_2fa(body: CodeIn, request: Request, user: dict = Depends(current_user)):
    fresh = await db.users.find_one({"user_id": user["user_id"]})
    pending = (fresh or {}).get("totp_pending")
    if not pending:
        raise HTTPException(400, "Nenhum setup pendente. Chame /setup primeiro.")
    secret = decrypt_secret(pending["secret_enc"])
    if not verify_totp_simple(secret, body.code, valid_window=1):
        raise HTTPException(400, "Código inválido — verifique o app autenticador.")
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"totp": {
            "enabled": True,
            "secret_enc": pending["secret_enc"],
            "backup_code_hashes": pending["backup_code_hashes"],
            "last_timecode": None,
            "enabled_at": now_utc(),
        }},
         "$unset": {"totp_pending": ""}},
    )
    await audit_service.log_event(event_type="auth.2fa_enabled", user=user, request=request)
    return {"enabled": True}


# ---------------------------------------------------------------------------
# Disable (requires password + code; blocked for mandatory roles)
# ---------------------------------------------------------------------------
@router.post("/disable")
async def disable_2fa(body: DisableIn, request: Request, user: dict = Depends(current_user)):
    if is_2fa_mandatory(user):
        raise HTTPException(403, "2FA não pode ser desativado para esta função (nutricionista/admin).")
    fresh = await db.users.find_one({"user_id": user["user_id"]})
    if not fresh or not is_2fa_enabled(fresh):
        raise HTTPException(400, "2FA não está ativo.")
    if not verify_password(body.password, fresh.get("password_hash") or ""):
        raise HTTPException(401, "Senha incorreta")
    secret = decrypt_secret(fresh["totp"]["secret_enc"])
    # Accept a live TOTP or a backup code
    ok = verify_totp_simple(secret, body.code) or (
        code_hash(body.code) in (fresh["totp"].get("backup_code_hashes") or [])
    )
    if not ok:
        raise HTTPException(401, "Código inválido")
    await db.users.update_one({"user_id": user["user_id"]}, {"$unset": {"totp": ""}})
    await audit_service.log_event(event_type="auth.2fa_disabled", user=user, request=request)
    return {"enabled": False}


# ---------------------------------------------------------------------------
# Regenerate backup codes
# ---------------------------------------------------------------------------
@router.post("/backup-codes/regenerate")
async def regen_backup_codes(request: Request, user: dict = Depends(current_user)):
    fresh = await db.users.find_one({"user_id": user["user_id"]})
    if not fresh or not is_2fa_enabled(fresh):
        raise HTTPException(400, "2FA não está ativo.")
    plain, hashes = new_backup_codes()
    await db.users.update_one(
        {"user_id": user["user_id"]}, {"$set": {"totp.backup_code_hashes": hashes}}
    )
    await audit_service.log_event(event_type="auth.2fa_backup_regenerated", user=user, request=request)
    return {"backup_codes": plain, "count": BACKUP_CODE_COUNT}


# ---------------------------------------------------------------------------
# Login with challenge — used by mobile AND portal
# The legacy `POST /auth/login` still works for users WITHOUT 2FA (kept for
# backwards compatibility). New clients should use `/auth/2fa/login` which
# always returns either a token OR a challenge in a single, unified shape.
# ---------------------------------------------------------------------------
@router.post("/login")
async def login_with_2fa(
    payload: LoginWithChannelIn,
    request: Request,
    response: Response,
    _rl: None = Depends(auth_rate_limit),
):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user.get("password_hash") or ""):
        await audit_service.log_event(
            event_type="auth.login_failed", request=request,
            metadata={"email": payload.email.lower()}, severity="warn",
        )
        raise HTTPException(401, "Credenciais inválidas")
    if user.get("deleted_at"):
        raise HTTPException(403, "Conta excluída")

    # Portal channel enforces professional role gate
    if payload.channel == "portal":
        from routers.auth import PROFESSIONAL_ROLES  # avoid circular import at module level
        role = user.get("role") or "user"
        if role not in PROFESSIONAL_ROLES:
            raise HTTPException(403, "Conta sem acesso ao portal profissional")

    enabled = is_2fa_enabled(user)
    mandatory = is_2fa_mandatory(user)

    # Mandatory role but no 2FA → force setup (do NOT issue token)
    if mandatory and not enabled:
        return {"status": "2fa_setup_required", "email": user["email"]}

    # Not enabled at all → issue directly
    if not enabled:
        return {"status": "ok", **(await _issue_login_success(user, payload.channel, response, request))}

    # Enabled → challenge
    challenge_id = await _create_login_challenge(user, payload.channel)
    return {
        "status": "2fa_required",
        "challenge_id": challenge_id,
        "expires_in": CHALLENGE_TTL_MIN * 60,
    }


@router.post("/verify-login")
async def verify_login(
    body: VerifyLoginIn,
    request: Request,
    response: Response,
    _rl: None = Depends(auth_rate_limit),
):
    ch = await _validate_challenge(body.challenge_id)
    await db.auth_challenges.update_one({"_id": ch["_id"]}, {"$inc": {"attempts": 1}})

    user = await db.users.find_one({"user_id": ch["user_id"]})
    if not user or not user.get("totp"):
        raise HTTPException(401, "Challenge inválido")

    totp_doc = user["totp"]
    secret = decrypt_secret(totp_doc["secret_enc"])
    supplied = body.code.strip()

    accepted_via = None
    if supplied.isdigit() and len(supplied) == 6:
        timecode = verify_totp_get_timecode(secret, supplied, valid_window=1)
        if timecode is not None:
            # Anti-replay: last_timecode must strictly increase
            last_tc = totp_doc.get("last_timecode")
            if last_tc is None or timecode > last_tc:
                r = await db.users.update_one(
                    {"user_id": user["user_id"],
                     "$or": [{"totp.last_timecode": None},
                             {"totp.last_timecode": {"$lt": timecode}}]},
                    {"$set": {"totp.last_timecode": timecode}},
                )
                if r.modified_count == 1:
                    accepted_via = "totp"
    else:
        # Backup code — single use via atomic $pull
        h = code_hash(supplied)
        r = await db.users.update_one(
            {"user_id": user["user_id"], "totp.backup_code_hashes": h},
            {"$pull": {"totp.backup_code_hashes": h}},
        )
        if r.modified_count == 1:
            accepted_via = "backup"

    if not accepted_via:
        await audit_service.log_event(
            event_type="auth.2fa_verify_failed", user=user, request=request, severity="warn",
        )
        raise HTTPException(401, "Código inválido")

    await db.auth_challenges.delete_one({"_id": ch["_id"]})
    await audit_service.log_event(
        event_type="auth.2fa_verify_ok", user=user, request=request,
        metadata={"via": accepted_via},
    )
    return {"status": "ok", "via": accepted_via,
            **(await _issue_login_success(user, ch["channel"], response, request))}
