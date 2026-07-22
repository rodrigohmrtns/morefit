"""VitaTracker Backend — thin composition layer.

All business logic lives in domain routers under `/app/backend/routers/*.py`.
This module wires them together, configures middlewares, and manages startup.
"""
from __future__ import annotations

import logging
import os

from fastapi import APIRouter, FastAPI
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.cors import CORSMiddleware

# Shared deps (loads env, connects Mongo)
from deps import db  # noqa: F401 — ensures env loaded once + Mongo client init
from core.config import settings as core_settings  # noqa: F401

# Middleware + rate limiter
from middleware.security import (
    SecurityHeadersMiddleware,
    limiter,
)

# Domain routers (in dependency order)
from routers.auth import router as auth_router
from routers.tracking import router as tracking_router
from routers.food import router as food_router
from routers.coach import router as coach_router
from routers.analytics import router as analytics_router
from routers.gamification import router as gamification_router
from routers.community import router as community_router
from routers.professional import router as professional_router
from routers.companies import router as companies_router
from routers.billing import router as billing_router
from routers.wearables import router as wearables_router
from routers.widgets import router as widgets_router

# Pre-existing sub-app routers (already modularized)
from routers.lgpd import router as lgpd_router
from routers.admin import router as admin_router

# Legacy compatibility routes that live outside /api
from routers.professional import build_public_report_html

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
log = logging.getLogger("vitatracker")

app = FastAPI(title="VitaTracker API", version="1.5.0")

# Rate limiting + security headers
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SecurityHeadersMiddleware)


# ---------------------------------------------------------------------------
# API composition — one thin router that gets prefixed with /api
# ---------------------------------------------------------------------------
api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"app": "VitaTracker", "status": "ok"}


api.include_router(auth_router)
api.include_router(tracking_router)
api.include_router(food_router)
api.include_router(coach_router)
api.include_router(analytics_router)
api.include_router(gamification_router)
api.include_router(community_router)
api.include_router(professional_router)
api.include_router(companies_router)
api.include_router(billing_router)
api.include_router(wearables_router)
api.include_router(widgets_router)
api.include_router(lgpd_router)
api.include_router(admin_router)

app.include_router(api)


# ---------------------------------------------------------------------------
# Legacy compatibility routes (no /api prefix)
# ---------------------------------------------------------------------------
@app.get("/report/{token}", include_in_schema=False)
async def public_report_legacy(token: str):
    """Legacy path kept for backward compat — delegates to /api/reports/public/{token}."""
    return await build_public_report_html(token)


# ---------------------------------------------------------------------------
# Startup / Shutdown — DB indexes
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def startup() -> None:
    # Core indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    for coll in ("weights", "meals", "waters", "exercises", "sleeps", "moods"):
        await db[coll].create_index([("user_id", 1), ("date", -1)])

    # Companies / campaigns
    await db.companies.create_index("code", unique=True)
    await db.companies.create_index("owner_id")
    await db.company_members.create_index([("company_id", 1), ("user_id", 1)], unique=True)
    await db.company_members.create_index("user_id")
    await db.campaigns.create_index("company_id")
    await db.campaign_participations.create_index([("campaign_id", 1), ("user_id", 1)], unique=True)

    # Compound indexes (perf)
    await db.users.create_index("premium_expires_at", sparse=True)
    await db.users.create_index("deletion_scheduled_at", sparse=True)
    await db.users.create_index("role", sparse=True)
    await db.users.create_index("banned", sparse=True)

    await db.payment_transactions.create_index([("user_id", 1), ("created_at", -1)])
    await db.payment_transactions.create_index("status")
    await db.payment_transactions.create_index("session_id", unique=True)

    await db.posts.create_index([("kind", 1), ("created_at", -1)])
    await db.posts.create_index("user_id")
    await db.comments.create_index([("post_id", 1), ("created_at", 1)])

    await db.shares.create_index("token", unique=True)
    await db.shares.create_index("user_id")

    await db.audit_logs.create_index([("user_id", 1), ("timestamp", -1)])
    await db.audit_logs.create_index("event_type")
    await db.audit_logs.create_index("timestamp")

    # Wearables
    await db.wearable_syncs.create_index([("user_id", 1), ("at", -1)])
    await db.heart_rate.create_index([("user_id", 1), ("timestamp", -1)])

    # Widgets
    await db.widget_tokens.create_index("token", unique=True)
    await db.widget_tokens.create_index("user_id", unique=True)

    log.info("VitaTracker started — indexes ready.")


@app.on_event("shutdown")
async def shutdown() -> None:
    log.info("VitaTracker shutting down.")


# ---------------------------------------------------------------------------
# CORS (must come after routes)
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
