"""Auth + Profile endpoints."""
from __future__ import annotations

from datetime import timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response

import os

from core.image_safety import check_user_quota, sanitize_image_base64
from deps import (
    GoogleSessionIn,
    LoginIn,
    PORTAL_COOKIE_NAME,
    ProfileIn,
    RegisterIn,
    _public_user,
    current_user,
    db,
    hash_password,
    make_jwt,
    new_id,
    now_utc,
    verify_password,
)
from middleware.security import auth_rate_limit, register_rate_limit
from services.audit_service import audit_service

router = APIRouter(tags=["auth"])

PROFESSIONAL_ROLES = {"nutritionist", "personal", "doctor", "admin"}
PORTAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 30  # 30 days
IS_PROD = os.environ.get("ENV", "dev").lower() in ("prod", "production")


def _cookie_kwargs():
    """Consistent, secure cookie flags across set/delete."""
    return {
        "httponly": True,
        "secure": IS_PROD,
        "samesite": "lax" if not IS_PROD else "strict",
        "path": "/",
    }


# Current version of legal documents. Bump when content changes materially —
# users will be re-prompted to accept the new version on next login.
LEGAL_TERMS_VERSION = "1.0"
LEGAL_PRIVACY_VERSION = "1.0"


@router.post("/auth/register")
async def register(payload: RegisterIn, request: Request, _rl: None = Depends(register_rate_limit)):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(400, "E-mail já cadastrado")
    # LGPD art. 8º — reject registration without explicit consent to Terms + Privacy
    if not payload.terms_accepted or not payload.privacy_accepted:
        raise HTTPException(
            400,
            "Você precisa aceitar os Termos de Uso e a Política de Privacidade para criar sua conta.",
        )
    ts = now_utc()
    # Capture minimal audit trail: what was accepted, when, from where.
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent", "")[:400]
    user = {
        "user_id": new_id("user"),
        "email": payload.email.lower(),
        "name": payload.name,
        "password_hash": hash_password(payload.password),
        "avatar": None,
        "auth_provider": "email",
        "created_at": now_utc(),
        "gender": None, "birth_date": None, "height_cm": None,
        "starting_weight_kg": None, "goal_weight_kg": None,
        "activity_level": "moderate", "goal": "maintain",
        "daily_calorie_goal": 2000, "daily_water_ml_goal": 2000, "daily_steps_goal": 8000,
        "daily_sleep_hours_goal": 8.0,
        "target_date": None, "photo_base64": None,
        "onboarded": False,
        # LGPD consent bookkeeping
        "consents": {
            "terms": {"accepted": True, "version": LEGAL_TERMS_VERSION, "at": ts, "ip": ip, "ua": ua},
            "privacy": {"accepted": True, "version": LEGAL_PRIVACY_VERSION, "at": ts, "ip": ip, "ua": ua},
            "marketing": {"accepted": bool(payload.marketing_accepted), "at": ts, "ip": ip, "ua": ua},
        },
    }
    await db.users.insert_one(user)
    await audit_service.log_event(
        event_type="auth.register", user=user, request=request,
        metadata={
            "terms_version": LEGAL_TERMS_VERSION,
            "privacy_version": LEGAL_PRIVACY_VERSION,
            "marketing": bool(payload.marketing_accepted),
        },
    )
    return {"token": make_jwt(user["user_id"]), "user": _public_user(user)}


@router.post("/auth/login")
async def login(payload: LoginIn, request: Request, response: Response, _rl: None = Depends(auth_rate_limit)):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not user.get("password_hash") or not verify_password(payload.password, user["password_hash"]):
        await audit_service.log_event(
            event_type="auth.login_failed", request=request,
            metadata={"email": payload.email.lower()}, severity="warn",
        )
        raise HTTPException(401, "Credenciais inválidas")
    if user.get("deleted_at"):
        raise HTTPException(403, "Conta excluída")

    # 2FA gate — protects legacy clients too
    from core.totp import is_2fa_enabled, is_2fa_mandatory
    from routers.twofa import _create_login_challenge
    if is_2fa_mandatory(user) and not is_2fa_enabled(user):
        return {"status": "2fa_setup_required", "email": user["email"]}
    if is_2fa_enabled(user):
        cid = await _create_login_challenge(user, "mobile")
        return {"status": "2fa_required", "challenge_id": cid, "expires_in": 300}

    await audit_service.log_event(event_type="auth.login", user=user, request=request)
    return {"token": make_jwt(user["user_id"]), "user": _public_user(user)}


@router.post("/auth/google-session")
async def google_session(payload: GoogleSessionIn):
    """Exchange Emergent session_token for a session, upserting the user."""
    async with httpx.AsyncClient(timeout=15) as http_client:
        r = await http_client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": payload.session_token},
        )
    if r.status_code != 200:
        raise HTTPException(401, "Sessão Google inválida")
    data = r.json()
    email = data["email"].lower()
    user = await db.users.find_one({"email": email})
    if not user:
        user = {
            "user_id": new_id("user"),
            "email": email,
            "name": data.get("name") or email.split("@")[0],
            "password_hash": None,
            "avatar": data.get("picture"),
            "auth_provider": "google",
            "created_at": now_utc(),
            "gender": None, "birth_date": None, "height_cm": None,
            "starting_weight_kg": None, "goal_weight_kg": None,
            "activity_level": "moderate", "goal": "maintain",
            "daily_calorie_goal": 2000, "daily_water_ml_goal": 2000, "daily_steps_goal": 8000,
            "daily_sleep_hours_goal": 8.0,
            "target_date": None, "photo_base64": None,
            "onboarded": False,
        }
        await db.users.insert_one(user)
    await db.user_sessions.update_one(
        {"session_token": payload.session_token},
        {"$set": {
            "session_token": payload.session_token,
            "user_id": user["user_id"],
            "expires_at": now_utc() + timedelta(days=7),
            "created_at": now_utc(),
        }},
        upsert=True,
    )
    return {"token": payload.session_token, "user": _public_user(user)}


@router.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    return {"user": _public_user(user)}


@router.post("/auth/logout")
async def logout(request: Request, user: dict = Depends(current_user)):
    auth = request.headers.get("Authorization", "")
    token = auth.split(" ", 1)[1].strip() if auth.lower().startswith("bearer ") else ""
    await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ============================================================================
# Portal profissional — cookie HttpOnly flow (safer against XSS)
#
# Endpoints below issue/refresh/clear an HttpOnly cookie that the portal-web
# uses transparently. Regular mobile auth (Bearer JWT) remains unchanged.
# ============================================================================
@router.post("/auth/portal/login")
async def portal_login(
    payload: LoginIn,
    request: Request,
    response: Response,
    _rl: None = Depends(auth_rate_limit),
):
    """Login for the professional portal.

    On success: sets HttpOnly cookie `mf_portal_session` and returns user (no token in body).
    Requires the account role to be one of PROFESSIONAL_ROLES.
    """
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user.get("password_hash") or ""):
        await audit_service.log_event(
            event_type="auth.portal_login_failed", request=request,
            metadata={"email": payload.email.lower()}, severity="warn",
        )
        raise HTTPException(401, "Credenciais inválidas")
    if user.get("deleted_at"):
        raise HTTPException(403, "Conta excluída")

    role = user.get("role") or "user"
    if role not in PROFESSIONAL_ROLES:
        await audit_service.log_event(
            event_type="auth.portal_login_denied", user=user, request=request,
            metadata={"role": role}, severity="warn",
        )
        raise HTTPException(403, "Conta sem acesso ao portal profissional")

    # 2FA gate for portal (professionals — mandatory by policy)
    from core.totp import is_2fa_enabled, is_2fa_mandatory
    from routers.twofa import _create_login_challenge
    if is_2fa_mandatory(user) and not is_2fa_enabled(user):
        return {"status": "2fa_setup_required", "email": user["email"]}
    if is_2fa_enabled(user):
        cid = await _create_login_challenge(user, "portal")
        return {"status": "2fa_required", "challenge_id": cid, "expires_in": 300}

    token = make_jwt(user["user_id"])
    response.set_cookie(
        key=PORTAL_COOKIE_NAME,
        value=token,
        max_age=PORTAL_COOKIE_MAX_AGE,
        **_cookie_kwargs(),
    )
    await audit_service.log_event(event_type="auth.portal_login", user=user, request=request)
    return {"user": _public_user(user)}


@router.get("/auth/portal/me")
async def portal_me(user: dict = Depends(current_user)):
    """Return current portal user (via cookie or bearer). Handy to hydrate the UI."""
    role = user.get("role") or "user"
    if role not in PROFESSIONAL_ROLES:
        raise HTTPException(403, "Conta sem acesso ao portal profissional")
    return {"user": _public_user(user)}


@router.post("/auth/portal/logout")
async def portal_logout(response: Response):
    """Clear the portal cookie. Idempotent (no auth required)."""
    response.delete_cookie(key=PORTAL_COOKIE_NAME, **_cookie_kwargs())
    return {"ok": True}


@router.put("/profile")
async def update_profile(payload: ProfileIn, user: dict = Depends(current_user)):
    updates = {k: v for k, v in payload.dict().items() if v is not None}
    # Sanitize avatar if user is uploading one
    if updates.get("photo_base64"):
        clean_b64, size = sanitize_image_base64(updates["photo_base64"], max_dim=512)
        await check_user_quota(db, user["user_id"], extra_bytes=size)
        updates["photo_base64"] = clean_b64
    if updates:
        updates["onboarded"] = True
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": updates})
    fresh = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    return {"user": fresh}
