from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.models.mandate import MandateModel

class MandateRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, mandate: MandateModel) -> MandateModel:
        self.db.add(mandate)
        await self.db.commit()
        await self.db.refresh(mandate)
        return mandate

    async def get_by_id(self, mandate_id: str) -> Optional[MandateModel]:
        stmt = select(MandateModel).where(MandateModel.id == mandate_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_all(self, limit: int = 100, offset: int = 0) -> List[MandateModel]:
        stmt = select(MandateModel).order_by(MandateModel.created_at.desc()).limit(limit).offset(offset)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def revoke(self, mandate_id: str) -> Optional[MandateModel]:
        mandate = await self.get_by_id(mandate_id)
        if mandate:
            mandate.is_revoked = True
            await self.db.commit()
            await self.db.refresh(mandate)
        return mandate

    async def reserve_budget(self, mandate_id: str, amount: int) -> bool:
        """
        Atomically reserve budget for an approved authorization request.
        Uses a single atomic SQL UPDATE with conditional WHERE clause to eliminate TOCTOU race conditions.
        """
        stmt = (
            update(MandateModel)
            .where(
                MandateModel.id == mandate_id,
                MandateModel.is_revoked.is_(False),
                (MandateModel.max_cumulative_amount - MandateModel.current_spent - MandateModel.reserved_amount) >= amount
            )
            .values(reserved_amount=MandateModel.reserved_amount + amount)
        )
        result = await self.db.execute(stmt)
        await self.db.commit()
        return result.rowcount > 0

    async def settle_budget(self, mandate_id: str, amount: int) -> bool:
        """
        Move funds from reserved to settled current_spent upon confirmed on-chain execution.
        """
        stmt = (
            update(MandateModel)
            .where(
                MandateModel.id == mandate_id,
                MandateModel.reserved_amount >= amount
            )
            .values(
                reserved_amount=MandateModel.reserved_amount - amount,
                current_spent=MandateModel.current_spent + amount
            )
        )
        result = await self.db.execute(stmt)
        if result.rowcount == 0:
            # Fallback if reserved_amount < amount: deduct whatever remains reserved
            stmt_fallback = (
                update(MandateModel)
                .where(MandateModel.id == mandate_id)
                .values(
                    reserved_amount=0,
                    current_spent=MandateModel.current_spent + amount
                )
            )
            result = await self.db.execute(stmt_fallback)
        await self.db.commit()
        return result.rowcount > 0

    async def release_budget(self, mandate_id: str, amount: int) -> bool:
        """
        Release reserved funds back to available budget if execution expired or reverted.
        """
        stmt = (
            update(MandateModel)
            .where(
                MandateModel.id == mandate_id,
                MandateModel.reserved_amount >= amount
            )
            .values(reserved_amount=MandateModel.reserved_amount - amount)
        )
        result = await self.db.execute(stmt)
        if result.rowcount == 0:
            stmt_fallback = (
                update(MandateModel)
                .where(MandateModel.id == mandate_id)
                .values(reserved_amount=0)
            )
            result = await self.db.execute(stmt_fallback)
        await self.db.commit()
        return result.rowcount > 0
