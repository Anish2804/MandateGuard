from typing import Optional
from pydantic import BaseModel, Field, field_validator
from web3 import Web3

class MandateCreate(BaseModel):
    id: Optional[str] = Field(None, description="Optional custom 32-byte hex mandate ID (e.g. registered on-chain)")
    title: str = Field(..., min_length=1, max_length=255, description="Human readable policy title")
    account: str = Field(..., description="Target guarded smart account address")
    agent: str = Field(..., description="Authorized agent address")
    token: str = Field(..., description="Allowed ERC-20 token address (MockUSDC)")
    recipient: Optional[str] = Field(None, description="Designated recipient merchant; null allows any recipient")
    max_amount_per_tx: int = Field(..., gt=0, description="Max amount per transaction in base token units")
    max_cumulative_amount: int = Field(..., gt=0, description="Max cumulative amount across policy duration")
    chain_id: int = Field(31337, description="Target EVM chain ID")
    start_time: Optional[int] = Field(None, description="Unix timestamp start; defaults to now")
    expiry: int = Field(..., description="Unix timestamp expiration")

    @field_validator("account", "agent", "token")
    @classmethod
    def validate_addresses(cls, v: str) -> str:
        if not Web3.is_address(v):
            raise ValueError(f"Invalid Ethereum address: {v}")
        return Web3.to_checksum_address(v)

    @field_validator("recipient")
    @classmethod
    def validate_recipient(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v != "" and v != "0x0000000000000000000000000000000000000000":
            if not Web3.is_address(v):
                raise ValueError(f"Invalid Ethereum address for recipient: {v}")
            return Web3.to_checksum_address(v)
        return None

class MandateResponse(BaseModel):
    id: str
    title: str
    account: str
    agent: str
    token: str
    recipient: Optional[str]
    max_amount_per_tx: int
    max_cumulative_amount: int
    current_spent: int
    reserved_amount: int
    remaining_budget: int
    chain_id: int
    start_time: int
    expiry: int
    version: int
    is_revoked: bool
    status: str

    model_config = {"from_attributes": True}
