import uuid
import hashlib
import secrets
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime
from app.core.database import Base

class UserModel(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    wallet_address = Column(String(42), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

class ApiKeyModel(Base):
    __tablename__ = "api_keys"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), index=True, nullable=False)
    name = Column(String(100), nullable=False)
    key_prefix = Column(String(16), nullable=False)
    key_hash = Column(String(64), unique=True, index=True, nullable=False)
    account_address = Column(String(42), index=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    @classmethod
    def hash_key(cls, raw_key: str) -> str:
        return hashlib.sha256(raw_key.encode()).hexdigest()

    @classmethod
    def generate(cls, user_id: str, account_address: str, name: str):
        entropy = secrets.token_hex(20)
        raw_key = f"mg_live_{entropy}"
        key_prefix = raw_key[:12]
        key_hash = cls.hash_key(raw_key)

        api_key_obj = cls(
            user_id=user_id,
            name=name,
            key_prefix=key_prefix,
            key_hash=key_hash,
            account_address=account_address.lower(),
            is_active=True
        )
        return raw_key, api_key_obj
