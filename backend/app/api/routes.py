import time
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from web3 import Web3

from app.core.config import settings
from app.core.database import get_db
from app.core.signer import recover_signer_from_verdict
from app.models.mandate import MandateModel
from app.models.tenant import ApiKeyModel
from app.repositories.mandate_repo import MandateRepository
from app.repositories.request_repo import PaymentRequestRepository
from app.repositories.audit_repo import AuditRepository
from app.services.authorization_service import AuthorizationService
from app.schemas.mandate import MandateCreate, MandateResponse
from app.schemas.request import PaymentAuthorizationRequest, PaymentSettlementRequest
from app.schemas.verdict import PaymentVerdictResponse, VerdictVerifyRequest, VerdictVerifyResponse
from app.schemas.tenant import ApiKeyCreateRequest, ApiKeyCreatedResponse, ApiKeySummaryResponse
from app.core.auth import verify_agent_api_key
from sqlalchemy import select

router = APIRouter()

@router.get("/health", tags=["System"])
async def health_check(db: AsyncSession = Depends(get_db)):
    signer_address = None
    try:
        signer_address = Web3().eth.account.from_key(settings.AUTHORIZER_PRIVATE_KEY).address
    except Exception as e:
        signer_address = f"Error deriving signer: {str(e)}"

    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "chain_id": settings.CHAIN_ID,
        "smart_account": settings.SMART_ACCOUNT_ADDRESS,
        "authorizer_signer": signer_address,
        "database": "connected",
        "timestamp": int(time.time()),
    }

# --- Mandate Endpoints ---

@router.post("/mandates", response_model=MandateResponse, status_code=status.HTTP_201_CREATED, tags=["Mandates"])
async def create_mandate(req: MandateCreate, db: AsyncSession = Depends(get_db)):
    mandate_repo = MandateRepository(db)
    audit_repo = AuditRepository(db)

    mandate_id = req.id if req.id else f"0x{uuid.uuid4().hex.rjust(64, '0')}"
    current_time = int(time.time())
    start_time = req.start_time or current_time

    if req.expiry <= start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mandate expiry must be greater than start time"
        )

    model = MandateModel(
        id=mandate_id,
        title=req.title,
        account=req.account,
        agent=req.agent,
        token=req.token,
        recipient=req.recipient,
        max_amount_per_tx=req.max_amount_per_tx,
        max_cumulative_amount=req.max_cumulative_amount,
        current_spent=0,
        reserved_amount=0,
        chain_id=req.chain_id,
        start_time=start_time,
        expiry=req.expiry,
        version=1,
        is_revoked=False,
    )
    created = await mandate_repo.create(model)

    await audit_repo.log_event(
        event_type="MANDATE_CREATED",
        mandate_id=mandate_id,
        details={
            "title": req.title,
            "account": req.account,
            "agent": req.agent,
            "max_amount_per_tx": req.max_amount_per_tx,
            "max_cumulative_amount": req.max_cumulative_amount,
        }
    )

    return MandateResponse(
        id=created.id,
        title=created.title,
        account=created.account,
        agent=created.agent,
        token=created.token,
        recipient=created.recipient,
        max_amount_per_tx=created.max_amount_per_tx,
        max_cumulative_amount=created.max_cumulative_amount,
        current_spent=created.current_spent,
        reserved_amount=created.reserved_amount,
        remaining_budget=created.remaining_budget,
        chain_id=created.chain_id,
        start_time=created.start_time,
        expiry=created.expiry,
        version=created.version,
        is_revoked=created.is_revoked,
        status="ACTIVE" if not created.is_revoked else "REVOKED",
    )

@router.get("/mandates", response_model=List[MandateResponse], tags=["Mandates"])
async def list_mandates(limit: int = 100, offset: int = 0, db: AsyncSession = Depends(get_db)):
    mandate_repo = MandateRepository(db)
    models = await mandate_repo.list_all(limit=limit, offset=offset)
    return [
        MandateResponse(
            id=m.id,
            title=m.title,
            account=m.account,
            agent=m.agent,
            token=m.token,
            recipient=m.recipient,
            max_amount_per_tx=m.max_amount_per_tx,
            max_cumulative_amount=m.max_cumulative_amount,
            current_spent=m.current_spent,
            reserved_amount=m.reserved_amount,
            remaining_budget=m.remaining_budget,
            chain_id=m.chain_id,
            start_time=m.start_time,
            expiry=m.expiry,
            version=m.version,
            is_revoked=m.is_revoked,
            status="REVOKED" if m.is_revoked else ("ACTIVE" if m.remaining_budget > 0 else "EXHAUSTED"),
        )
        for m in models
    ]

@router.get("/mandates/{mandate_id}", response_model=MandateResponse, tags=["Mandates"])
async def get_mandate(mandate_id: str, db: AsyncSession = Depends(get_db)):
    mandate_repo = MandateRepository(db)
    m = await mandate_repo.get_by_id(mandate_id)
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mandate not found")

    return MandateResponse(
        id=m.id,
        title=m.title,
        account=m.account,
        agent=m.agent,
        token=m.token,
        recipient=m.recipient,
        max_amount_per_tx=m.max_amount_per_tx,
        max_cumulative_amount=m.max_cumulative_amount,
        current_spent=m.current_spent,
        reserved_amount=m.reserved_amount,
        remaining_budget=m.remaining_budget,
        chain_id=m.chain_id,
        start_time=m.start_time,
        expiry=m.expiry,
        version=m.version,
        is_revoked=m.is_revoked,
        status="REVOKED" if m.is_revoked else ("ACTIVE" if m.remaining_budget > 0 else "EXHAUSTED"),
    )

@router.post("/mandates/{mandate_id}/revoke", response_model=MandateResponse, tags=["Mandates"])
async def revoke_mandate(mandate_id: str, db: AsyncSession = Depends(get_db)):
    mandate_repo = MandateRepository(db)
    audit_repo = AuditRepository(db)

    m = await mandate_repo.revoke(mandate_id)
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mandate not found")

    await audit_repo.log_event(
        event_type="MANDATE_REVOKED",
        mandate_id=mandate_id,
        details={"revoked_at": int(time.time()), "title": m.title}
    )

    return MandateResponse(
        id=m.id,
        title=m.title,
        account=m.account,
        agent=m.agent,
        token=m.token,
        recipient=m.recipient,
        max_amount_per_tx=m.max_amount_per_tx,
        max_cumulative_amount=m.max_cumulative_amount,
        current_spent=m.current_spent,
        reserved_amount=m.reserved_amount,
        remaining_budget=m.remaining_budget,
        chain_id=m.chain_id,
        start_time=m.start_time,
        expiry=m.expiry,
        version=m.version,
        is_revoked=m.is_revoked,
        status="REVOKED",
    )

# --- Agent Authentication & Provisioning Endpoints ---

@router.post("/auth/api-keys", response_model=ApiKeyCreatedResponse, status_code=status.HTTP_201_CREATED, tags=["Agent Auth"])
async def create_api_key(req: ApiKeyCreateRequest, db: AsyncSession = Depends(get_db)):
    raw_key, api_key_obj = ApiKeyModel.generate(
        user_id=req.user_id,
        account_address=req.account_address,
        name=req.name
    )
    db.add(api_key_obj)
    await db.commit()
    await db.refresh(api_key_obj)
    return ApiKeyCreatedResponse(
        id=api_key_obj.id,
        name=api_key_obj.name,
        key_prefix=api_key_obj.key_prefix,
        api_key=raw_key,
        account_address=api_key_obj.account_address,
        is_active=api_key_obj.is_active,
        created_at=api_key_obj.created_at
    )

@router.get("/auth/api-keys", response_model=List[ApiKeySummaryResponse], tags=["Agent Auth"])
async def list_api_keys(account: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    query = select(ApiKeyModel).order_by(ApiKeyModel.created_at.desc())
    if account:
        query = query.where(ApiKeyModel.account_address == account.lower())
    result = await db.execute(query)
    keys = result.scalars().all()
    return [
        ApiKeySummaryResponse(
            id=k.id,
            name=k.name,
            key_prefix=k.key_prefix,
            account_address=k.account_address,
            is_active=k.is_active,
            created_at=k.created_at
        )
        for k in keys
    ]

@router.delete("/auth/api-keys/{key_id}", tags=["Agent Auth"])
async def revoke_api_key(key_id: str, db: AsyncSession = Depends(get_db)):
    query = select(ApiKeyModel).where(ApiKeyModel.id == key_id)
    result = await db.execute(query)
    key_obj = result.scalars().first()
    if not key_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")
    key_obj.is_active = False
    await db.commit()
    return {"status": "success", "message": f"API key {key_id} revoked"}

# --- Authorization Endpoints ---

@router.post("/authorize", response_model=PaymentVerdictResponse, tags=["Authorization"])
async def authorize_payment(
    req: PaymentAuthorizationRequest,
    agent_auth: Optional[ApiKeyModel] = Depends(verify_agent_api_key),
    db: AsyncSession = Depends(get_db)
):
    # Multi-tenant account isolation: if agent provided an API key, enforce that it can only spend from its assigned account!
    if agent_auth:
        if req.account.lower() != agent_auth.account_address.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"API Key is locked to account {agent_auth.account_address}, but requested account was {req.account}"
            )
    service = AuthorizationService(db)
    return await service.evaluate_and_authorize(req)

@router.get("/requests", tags=["Authorization"])
async def list_requests(limit: int = 100, offset: int = 0, db: AsyncSession = Depends(get_db)):
    request_repo = PaymentRequestRepository(db)
    items = await request_repo.list_all(limit=limit, offset=offset)
    return [
        {
            "id": r.id,
            "mandate_id": r.mandate_id,
            "idempotency_key": r.idempotency_key,
            "account": r.account,
            "token": r.token,
            "recipient": r.recipient,
            "amount": r.amount,
            "chain_id": r.chain_id,
            "verdict": r.verdict,
            "verdict_label": "ALLOW" if r.verdict == 1 else "DENY",
            "authorization_id": r.authorization_id,
            "expiry": r.expiry,
            "status": r.status,
            "tx_hash": r.tx_hash,
            "rejection_reason": r.rejection_reason,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "settled_at": r.settled_at.isoformat() if r.settled_at else None,
        }
        for r in items
    ]

@router.get("/requests/{request_id}", tags=["Authorization"])
async def get_request(request_id: str, db: AsyncSession = Depends(get_db)):
    request_repo = PaymentRequestRepository(db)
    r = await request_repo.get_by_id(request_id)
    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    return {
        "id": r.id,
        "mandate_id": r.mandate_id,
        "idempotency_key": r.idempotency_key,
        "account": r.account,
        "token": r.token,
        "recipient": r.recipient,
        "amount": r.amount,
        "chain_id": r.chain_id,
        "verdict": r.verdict,
        "verdict_label": "ALLOW" if r.verdict == 1 else "DENY",
        "authorization_id": r.authorization_id,
        "signature": r.signature,
        "expiry": r.expiry,
        "status": r.status,
        "tx_hash": r.tx_hash,
        "rejection_reason": r.rejection_reason,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "settled_at": r.settled_at.isoformat() if r.settled_at else None,
    }

@router.post("/verdicts/verify", response_model=VerdictVerifyResponse, tags=["Authorization"])
async def verify_verdict(req: VerdictVerifyRequest):
    expected_signer = Web3().eth.account.from_key(settings.AUTHORIZER_PRIVATE_KEY).address
    try:
        recovered = recover_signer_from_verdict(
            verdict=req.verdict,
            chain_id=req.chain_id,
            account=req.account,
            token=req.token,
            recipient=req.recipient,
            amount=req.amount,
            mandate_id=req.mandate_id,
            authorization_id=req.authorization_id,
            expiry=req.expiry,
            mandate_version=req.mandate_version,
            signature=req.signature,
        )
        is_valid = (recovered.lower() == expected_signer.lower())
        return VerdictVerifyResponse(
            is_valid=is_valid,
            recovered_signer=recovered,
            expected_signer=expected_signer,
            reason="Signature valid" if is_valid else "Recovered signer does not match authorizer key",
        )
    except Exception as e:
        return VerdictVerifyResponse(
            is_valid=False,
            recovered_signer="0x0000000000000000000000000000000000000000",
            expected_signer=expected_signer,
            reason=f"Verification failed: {str(e)}",
        )

@router.post("/settle", tags=["Authorization"])
async def settle_payment(req: PaymentSettlementRequest, db: AsyncSession = Depends(get_db)):
    service = AuthorizationService(db)
    settled, reason = await service.settle_payment(req.authorization_id, req.tx_hash)
    if not settled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to settle payment: {reason}"
        )
    return {"status": "SETTLED", "authorization_id": req.authorization_id, "tx_hash": req.tx_hash, "message": reason}

# --- Audit Events ---

@router.get("/audit-events", tags=["Audit"])
async def list_audit_events(limit: int = 100, offset: int = 0, db: AsyncSession = Depends(get_db)):
    audit_repo = AuditRepository(db)
    events = await audit_repo.list_events(limit=limit, offset=offset)
    return [
        {
            "id": e.id,
            "event_type": e.event_type,
            "mandate_id": e.mandate_id,
            "request_id": e.request_id,
            "details": e.get_details(),
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in events
    ]
