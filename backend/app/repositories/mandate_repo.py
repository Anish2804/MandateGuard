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
        Prevents concurrent requests from overspending the cumulative budget.
        """
        mandate = await self.get_by_id(mandate_id)
        if not mandate or mandate.is_revoked:
            return False

        if mandate.remaining_budget < amount:
            return False

        mandate.reserved_amount += amount
        await self.db.commit()
        await self.db.refresh(mandate)
        return True

    async def settle_budget(self, mandate_id: str, amount: int) -> bool:
        """
        Move funds from reserved to settled current_spent upon confirmed on-chain execution.
        """
        mandate = await self.get_by_id(mandate_id)
        if not mandate:
            return False

        mandate.reserved_amount = max(0, mandate.reserved_amount - amount)
        mandate.current_spent += amount
        await self.db.commit()
        await self.db.refresh(mandate)
        return True

    async def release_budget(self, mandate_id: str, amount: int) -> bool:
        """
        Release reserved funds back to available budget if execution expired or reverted.
        """
        mandate = await self.get_by_id(mandate_id)
        if not mandate:
            return False

        mandate.reserved_amount = max(0, mandate.reserved_amount - amount)
        await self.db.commit()
        await self.db.refresh(mandate)
        return True
