from typing import Optional
from fastapi import Security, HTTPException, status, Depends
from fastapi.security import APIKeyHeader
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_db
from app.models.tenant import ApiKeyModel

API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)

async def verify_agent_api_key(
    raw_api_key: Optional[str] = Security(API_KEY_HEADER),
    db: AsyncSession = Depends(get_db)
) -> Optional[ApiKeyModel]:
    """
    Validates the X-API-Key header.
    Returns the associated ApiKeyModel if valid and active.
    If REQUIRE_API_KEY is True and header is absent, raises HTTP 401 Unauthorized.
    If REQUIRE_API_KEY is False and header is absent, returns None (local dev mode).
    If header is provided but invalid, raises HTTP 401.
    """
    if not raw_api_key:
        if settings.REQUIRE_API_KEY:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing required X-API-Key authentication header"
            )
        return None

    key_hash = ApiKeyModel.hash_key(raw_api_key)
    query = select(ApiKeyModel).where(
        ApiKeyModel.key_hash == key_hash,
        ApiKeyModel.is_active == True # noqa
    )
    result = await db.execute(query)
    api_key_obj = result.scalars().first()

    if not api_key_obj:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked API Key"
        )

    return api_key_obj
