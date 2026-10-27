from typing import Optional
from pydantic import BaseModel, Field

class PaymentVerdictResponse(BaseModel):
    verdict: int = Field(..., description="0 = DENY, 1 = ALLOW")
    verdict_label: str = Field(..., description="'ALLOW' or 'DENY'")
    authorization_id: str = Field(..., description="Unique 32-byte authorization nonce (0x hex)")
    mandate_id: str = Field(..., description="Mandate ID")
    account: str = Field(..., description="Smart account address")
    token: str = Field(..., description="Token contract address")
    recipient: str = Field(..., description="Merchant destination address")
    amount: int = Field(..., description="Base token amount")
    chain_id: int = Field(..., description="Chain ID")
    expiry: int = Field(..., description="Unix timestamp expiration")
    mandate_version: int = Field(..., description="Mandate version")
    signature: Optional[str] = Field(None, description="EIP-712 ECDSA signature (null if DENIED)")
    authorizer_address: Optional[str] = Field(None, description="Signer public address")
    reason: str = Field(..., description="Reason for verdict")
    status: str = Field(..., description="Request status: ALLOWED, DENIED, or SETTLED")

class VerdictVerifyRequest(BaseModel):
    verdict: int
    chain_id: int
    account: str
    token: str
    recipient: str
    amount: int
    mandate_id: str
    authorization_id: str
    expiry: int
    mandate_version: int
    signature: str

class VerdictVerifyResponse(BaseModel):
    is_valid: bool
    recovered_signer: str
    expected_signer: str
    reason: Optional[str] = None
