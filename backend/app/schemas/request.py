from typing import Optional
from pydantic import BaseModel, Field, field_validator
from web3 import Web3

class PaymentAuthorizationRequest(BaseModel):
    mandate_id: str = Field(..., description="Target spending mandate identifier (bytes32 hex)")
    account: str = Field(..., description="Target smart account address")
    token: str = Field(..., description="Token contract address")
    recipient: str = Field(..., description="Payment destination merchant address")
    amount: int = Field(..., gt=0, description="Amount in base token units (e.g. 6 decimals for USDC)")
    chain_id: int = Field(31337, description="Target EVM chain ID")
    idempotency_key: str = Field(..., min_length=1, max_length=255, description="Unique client idempotency key")
    custom_expiry: Optional[int] = Field(None, description="Optional custom timestamp expiry")

    @field_validator("account", "token", "recipient")
    @classmethod
    def validate_addresses(cls, v: str) -> str:
        if not Web3.is_address(v):
            raise ValueError(f"Invalid Ethereum address: {v}")
        return Web3.to_checksum_address(v)

class PaymentSettlementRequest(BaseModel):
    authorization_id: str = Field(..., description="Authorization ID of the executed payment")
    tx_hash: str = Field(..., description="Mined transaction hash on chain")

    @field_validator("tx_hash")
    @classmethod
    def validate_tx_hash(cls, v: str) -> str:
        if not v.startswith("0x") or len(v) != 66:
            raise ValueError(f"Invalid transaction hash format: {v}")
        return v
