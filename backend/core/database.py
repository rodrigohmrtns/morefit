"""MongoDB async client — single motor client shared by all repositories."""
from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from core.config import settings

_client: AsyncIOMotorClient = AsyncIOMotorClient(settings.mongo_url)
db: AsyncIOMotorDatabase = _client[settings.db_name]


def get_db() -> AsyncIOMotorDatabase:
    """FastAPI dependency (also usable directly)."""
    return db


async def close_db() -> None:
    _client.close()
