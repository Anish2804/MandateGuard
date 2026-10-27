import time
import uuid
from typing import Tuple
from web3 import Web3
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.signer import sign_payment_verdict, recover_signer_from_verdict
from app.models.mandate import MandateModel
from app.models.request import PaymentRequestModel
from app.repositories.mandate_repo import MandateRepository
from app.repositories.request_repo import PaymentRequestRepository
from app.repositories.audit_repo import AuditRepository
from app.schemas.request import PaymentAuthorizationRequest
from app.schemas.verdict import PaymentVerdictResponse

class AuthorizationService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.mandate_repo = MandateRepository(db)
        self.request_repo = PaymentRequestRepository(db)
        self.audit_repo = AuditRepository(db)

    async def evaluate_and_authorize(
        self, req: PaymentAuthorizationRequest
    ) -> PaymentVerdictResponse:
        current_timestamp = int(time.time())

        # 1. Idempotency Check
        existing_req = await self.request_repo.get_by_idempotency_key(req.idempotency_key)
        if existing_req:
            verdict_label = "ALLOW" if existing_req.verdict == 1 else "DENY"
            return PaymentVerdictResponse(
                verdict=existing_req.verdict,
                verdict_label=verdict_label,
                authorization_id=existing_req.authorization_id,
                mandate_id=existing_req.mandate_id,
                account=existing_req.account,
                token=existing_req.token,
                recipient=existing_req.recipient,
                amount=existing_req.amount,
                chain_id=existing_req.chain_id,
                expiry=existing_req.expiry,
                mandate_version=existing_req.mandate_version,
                signature=existing_req.signature,
                authorizer_address=settings.AUTHORIZER_PRIVATE_KEY and Web3.to_checksum_address(
                    Web3().eth.account.from_key(settings.AUTHORIZER_PRIVATE_KEY).address
                ),
                reason=existing_req.rejection_reason or "Idempotent response: previously evaluated",
                status=existing_req.status,
            )

        # 2. Fetch Mandate
        mandate = await self.mandate_repo.get_by_id(req.mandate_id)
        auth_id = f"0x{uuid.uuid4().hex.rjust(64, '0')}"
        req_id = f"0x{uuid.uuid4().hex.rjust(64, '0')}"

        if not mandate:
            return await self._record_deny(
                req_id=req_id,
                auth_id=auth_id,
                req=req,
                mandate_version=1,
                reason=f"Mandate {req.mandate_id} not found",
            )

        # 3. Policy Condition Evaluations
        if mandate.is_revoked:
            return await self._record_deny(
                req_id=req_id,
                auth_id=auth_id,
                req=req,
                mandate_version=mandate.version,
                reason="Mandate is revoked",
            )

        if current_timestamp < mandate.start_time or current_timestamp > mandate.expiry:
            return await self._record_deny(
                req_id=req_id,
                auth_id=auth_id,
                req=req,
                mandate_version=mandate.version,
                reason=f"Mandate is not active (current: {current_timestamp}, window: {mandate.start_time}-{mandate.expiry})",
            )

        if req.account.lower() != mandate.account.lower():
            return await self._record_deny(
                req_id=req_id,
                auth_id=auth_id,
                req=req,
                mandate_version=mandate.version,
                reason=f"Account mismatch: expected {mandate.account}, got {req.account}",
            )

        if req.token.lower() != mandate.token.lower():
            return await self._record_deny(
                req_id=req_id,
                auth_id=auth_id,
                req=req,
                mandate_version=mandate.version,
                reason=f"Token mismatch: expected {mandate.token}, got {req.token}",
            )

        if req.chain_id != mandate.chain_id:
            return await self._record_deny(
                req_id=req_id,
                auth_id=auth_id,
                req=req,
                mandate_version=mandate.version,
                reason=f"Chain ID mismatch: expected {mandate.chain_id}, got {req.chain_id}",
            )

        if mandate.recipient and req.recipient.lower() != mandate.recipient.lower():
            return await self._record_deny(
                req_id=req_id,
                auth_id=auth_id,
                req=req,
                mandate_version=mandate.version,
                reason=f"Unapproved recipient: expected {mandate.recipient}, got {req.recipient}",
            )

        if req.amount > mandate.max_amount_per_tx:
            return await self._record_deny(
                req_id=req_id,
                auth_id=auth_id,
                req=req,
                mandate_version=mandate.version,
                reason=f"Amount {req.amount} exceeds max per-tx limit of {mandate.max_amount_per_tx}",
            )

        if req.amount > mandate.remaining_budget:
            return await self._record_deny(
                req_id=req_id,
                auth_id=auth_id,
                req=req,
                mandate_version=mandate.version,
                reason=f"Amount {req.amount} exceeds remaining cumulative budget of {mandate.remaining_budget} (spent: {mandate.current_spent}, reserved: {mandate.reserved_amount})",
            )

        # 4. Atomic Budget Reservation (Concurrency Control)
        reserved_ok = await self.mandate_repo.reserve_budget(mandate.id, req.amount)
        if not reserved_ok:
            return await self._record_deny(
                req_id=req_id,
                auth_id=auth_id,
                req=req,
                mandate_version=mandate.version,
                reason="Concurrent spending limit contention: reservation failed",
            )

        # 5. Generate Signed ALLOW Verdict
        expiry = req.custom_expiry or min(
            current_timestamp + settings.DEFAULT_EXPIRY_SECONDS,
            mandate.expiry
        )

        sig_hex, signer_address, formatted_auth_id = sign_payment_verdict(
            verdict=1, # ALLOW
            chain_id=req.chain_id,
            account=req.account,
            token=req.token,
            recipient=req.recipient,
            amount=req.amount,
            mandate_id=mandate.id,
            authorization_id=auth_id,
            expiry=expiry,
            mandate_version=mandate.version,
        )

        request_record = PaymentRequestModel(
            id=req_id,
            mandate_id=mandate.id,
            idempotency_key=req.idempotency_key,
            account=req.account,
            token=req.token,
            recipient=req.recipient,
            amount=req.amount,
            chain_id=req.chain_id,
            verdict=1,
            signature=sig_hex,
            authorization_id=formatted_auth_id,
            expiry=expiry,
            mandate_version=mandate.version,
            status="ALLOWED",
            rejection_reason=None,
        )
        await self.request_repo.create(request_record)

        await self.audit_repo.log_event(
            event_type="VERDICT_ISSUED",
            mandate_id=mandate.id,
            request_id=req_id,
            details={
                "verdict": "ALLOW",
                "authorization_id": formatted_auth_id,
                "amount": req.amount,
                "recipient": req.recipient,
                "token": req.token,
                "signer": signer_address,
            },
        )

        return PaymentVerdictResponse(
            verdict=1,
            verdict_label="ALLOW",
            authorization_id=formatted_auth_id,
            mandate_id=mandate.id,
            account=req.account,
            token=req.token,
            recipient=req.recipient,
            amount=req.amount,
            chain_id=req.chain_id,
            expiry=expiry,
            mandate_version=mandate.version,
            signature=sig_hex,
            authorizer_address=signer_address,
            reason="Payment complies with approved mandate policy",
            status="ALLOWED",
        )

    async def _record_deny(
        self,
        req_id: str,
        auth_id: str,
        req: PaymentAuthorizationRequest,
        mandate_version: int,
        reason: str,
    ) -> PaymentVerdictResponse:
        formatted_auth_id = f"0x{uuid.uuid4().hex.rjust(64, '0')}"
        request_record = PaymentRequestModel(
            id=req_id,
            mandate_id=req.mandate_id,
            idempotency_key=req.idempotency_key,
            account=req.account,
            token=req.token,
            recipient=req.recipient,
            amount=req.amount,
            chain_id=req.chain_id,
            verdict=0,
            signature=None, # DENY verdicts are not given executable signatures
            authorization_id=formatted_auth_id,
            expiry=0,
            mandate_version=mandate_version,
            status="DENIED",
            rejection_reason=reason,
        )
        await self.request_repo.create(request_record)

        await self.audit_repo.log_event(
            event_type="VERDICT_DENIED",
            mandate_id=req.mandate_id,
            request_id=req_id,
            details={
                "verdict": "DENY",
                "reason": reason,
                "amount": req.amount,
                "recipient": req.recipient,
            },
        )

        return PaymentVerdictResponse(
            verdict=0,
            verdict_label="DENY",
            authorization_id=formatted_auth_id,
            mandate_id=req.mandate_id,
            account=req.account,
            token=req.token,
            recipient=req.recipient,
            amount=req.amount,
            chain_id=req.chain_id,
            expiry=0,
            mandate_version=mandate_version,
            signature=None,
            authorizer_address=None,
            reason=reason,
            status="DENIED",
        )

    async def settle_payment(self, auth_id: str, tx_hash: str) -> bool:
        """Settle a payment upon confirmed on-chain execution."""
        req = await self.request_repo.get_by_authorization_id(auth_id)
        if not req or req.status != "ALLOWED":
            return False

        await self.request_repo.mark_settled(auth_id, tx_hash)
        await self.mandate_repo.settle_budget(req.mandate_id, req.amount)

        await self.audit_repo.log_event(
            event_type="PAYMENT_SETTLED",
            mandate_id=req.mandate_id,
            request_id=req.id,
            details={
                "authorization_id": auth_id,
                "tx_hash": tx_hash,
                "amount": req.amount,
            },
        )
        return True
