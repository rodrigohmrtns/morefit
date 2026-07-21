"""Application configuration — single source of truth for env-based settings."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from pydantic import BaseModel

_ROOT = Path(__file__).parent.parent
load_dotenv(_ROOT / ".env")


class Settings(BaseModel):
    """Immutable application settings loaded once at import time."""
    mongo_url: str
    db_name: str = "vitatracker"
    jwt_secret: str = "dev_secret"
    jwt_alg: str = "HS256"
    jwt_exp_days: int = 30
    emergent_llm_key: str = ""
    stripe_api_key: str = ""

    # Rate limits (per minute unless suffixed)
    rate_limit_default: str = "120/minute"
    rate_limit_auth: str = "10/minute"
    rate_limit_register: str = "5/minute"
    rate_limit_billing: str = "20/minute"

    # LGPD
    account_deletion_grace_days: int = 30


def _load() -> Settings:
    return Settings(
        mongo_url=os.environ["MONGO_URL"],
        db_name=os.environ.get("DB_NAME", "vitatracker"),
        jwt_secret=os.environ.get("JWT_SECRET", "dev_secret"),
        jwt_exp_days=int(os.environ.get("JWT_EXP_DAYS", "30")),
        emergent_llm_key=os.environ.get("EMERGENT_LLM_KEY", ""),
        stripe_api_key=os.environ.get("STRIPE_API_KEY", ""),
    )


settings: Settings = _load()
