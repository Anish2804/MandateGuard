from datetime import datetime, timezone
import json
from sqlalchemy import Column, String, DateTime, Text
from app.core.database import Base

class AuditEventModel(Base):
    __tablename__ = "audit_events"

    id = Column(String(66), primary_key=True, index=True)
    event_type = Column(String(64), nullable=False, index=True)
    mandate_id = Column(String(66), nullable=True, index=True)
    request_id = Column(String(66), nullable=True, index=True)
    details_json = Column(Text, nullable=False, default="{}")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def set_details(self, data: dict):
        self.details_json = json.dumps(data)

    def get_details(self) -> dict:
        try:
            return json.loads(self.details_json)
        except Exception:
            return {}
