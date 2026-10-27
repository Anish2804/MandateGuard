from typing import Optional, List
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.request import PaymentRequestModel

class PaymentRequestRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, request_model: PaymentRequestModel) -> PaymentRequestModel:
        self.db.add(request_model)
        await self.db.commit()
        await self.db.refresh(request_model)
        return request_model

    async def get_by_id(self, request_id: str) -> Optional[PaymentRequestModel]:
        stmt = select(PaymentRequestModel).where(PaymentRequestModel.id == request_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_idempotency_key(self, idempotency_key: str) -> Optional[PaymentRequestModel]:
        stmt = select(PaymentRequestModel).where(PaymentRequestModel.idempotency_key == idempotency_key)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_authorization_id(self, auth_id: str) -> Optional[PaymentRequestModel]:
        stmt = select(PaymentRequestModel).where(PaymentRequestModel.authorization_id == auth_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_all(self, limit: int = 100, offset: int = 0) -> List[PaymentRequestModel]:
        stmt = select(PaymentRequestModel).order_by(PaymentRequestModel.created_at.desc()).limit(limit).offset(offset)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def mark_settled(self, auth_id: str, tx_hash: str) -> Optional[PaymentRequestModel]:
        req = await self.get_by_authorization_id(auth_id)
        if req:
            req.status = "SETTLED"
            req.tx_hash = tx_hash
            req.settled_at = datetime.now(timezone.utc)
            await self.db.commit()
            await self.db.refresh(req)
        return req
