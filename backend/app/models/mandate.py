from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, BigInteger, Boolean, DateTime
from app.core.database import Base

class MandateModel(Base):
    __tablename__ = "mandates"

    id = Column(String(66), primary_key=True, index=True) # 0x + 64 hex chars
    title = Column(String(255), nullable=False)
    account = Column(String(42), nullable=False, index=True)
    agent = Column(String(42), nullable=False)
    token = Column(String(42), nullable=False)
    recipient = Column(String(42), nullable=True) # None = any recipient permitted
    max_amount_per_tx = Column(BigInteger, nullable=False)
    max_cumulative_amount = Column(BigInteger, nullable=False)
    current_spent = Column(BigInteger, default=0, nullable=False)
    reserved_amount = Column(BigInteger, default=0, nullable=False)
    chain_id = Column(BigInteger, nullable=False)
    start_time = Column(BigInteger, nullable=False)
    expiry = Column(BigInteger, nullable=False)
    version = Column(Integer, default=1, nullable=False)
    is_revoked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    @property
    def remaining_budget(self) -> int:
        return max(0, self.max_cumulative_amount - (self.current_spent + self.reserved_amount))
