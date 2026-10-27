from typing import List, Optional, Dict, Any
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.audit import AuditEventModel

class AuditRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def log_event(
        self,
        event_type: str,
        details: Dict[str, Any],
        mandate_id: Optional[str] = None,
        request_id: Optional[str] = None,
    ) -> AuditEventModel:
        event = AuditEventModel(
            id=f"0x{uuid.uuid4().hex}",
            event_type=event_type,
            mandate_id=mandate_id,
            request_id=request_id,
        )
        event.set_details(details)
        self.db.add(event)
        await self.db.commit()
        await self.db.refresh(event)
        return event

    async def list_events(self, limit: int = 100, offset: int = 0) -> List[AuditEventModel]:
        stmt = select(AuditEventModel).order_by(AuditEventModel.created_at.desc()).limit(limit).offset(offset)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
