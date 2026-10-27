from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field

class ApiKeyCreateRequest(BaseModel):
    user_id: str = Field(..., description="User ID / Owner ID")
    account_address: str = Field(..., description="Smart account address this key is restricted to")
    name: str = Field(..., max_length=100, description="Friendly label for the AI agent")

class ApiKeyCreatedResponse(BaseModel):
    id: str
    name: str
    key_prefix: str
    api_key: str = Field(..., description="Secret full API key (shown only once)")
    account_address: str
    is_active: bool
    created_at: datetime

class ApiKeySummaryResponse(BaseModel):
    id: str
    name: str
    key_prefix: str
    account_address: str
    is_active: bool
    created_at: datetime
