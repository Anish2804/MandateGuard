from dataclasses import dataclass
from typing import Optional, Dict, Any

@dataclass
class PaymentVerdictResult:
    allowed: bool
    verdict: int
    verdict_label: str
    mandate_id: str
    authorization_id: str
    account: str
    token: str
    recipient: str
    amount: int
    chain_id: int
    expiry: int
    mandate_version: int
    signature: Optional[str]
    authorizer_signer: Optional[str]
    reason: Optional[str]
    raw_response: Dict[str, Any]

    @property
    def amount_usdc(self) -> float:
        return self.amount / 1_000_000.0
