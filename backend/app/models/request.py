from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, BigInteger, DateTime
from app.core.database import Base

class PaymentRequestModel(Base):
    __tablename__ = "payment_requests"

    id = Column(String(66), primary_key=True, index=True)
    mandate_id = Column(String(66), nullable=False, index=True)
    idempotency_key = Column(String(255), unique=True, index=True, nullable=False)
    account = Column(String(42), nullable=False)
    token = Column(String(42), nullable=False)
    recipient = Column(String(42), nullable=False)
    amount = Column(BigInteger, nullable=False)
    chain_id = Column(BigInteger, nullable=False)
    verdict = Column(Integer, nullable=False) # 0 = DENY, 1 = ALLOW
    signature = Column(String(132), nullable=True) # 0x + 130 hex chars (65 bytes)
    authorization_id = Column(String(66), nullable=False, unique=True, index=True)
    expiry = Column(BigInteger, nullable=False)
    mandate_version = Column(Integer, nullable=False)
    status = Column(String(32), default="PENDING", nullable=False) # PENDING, ALLOWED, DENIED, SETTLED, EXPIRED, RELEASED
    rejection_reason = Column(String(1024), nullable=True)
    tx_hash = Column(String(66), nullable=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    settled_at = Column(DateTime, nullable=True)
