import pytest
import time
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.database import Base
from app.models.mandate import MandateModel
from app.repositories.mandate_repo import MandateRepository
from app.services.authorization_service import AuthorizationService
from app.schemas.request import PaymentAuthorizationRequest

@pytest.fixture
async def async_db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    SessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with SessionLocal() as session:
        yield session
    
    await engine.dispose()

@pytest.fixture
async def setup_mandate(async_db: AsyncSession):
    mandate_repo = MandateRepository(async_db)
    now = int(time.time())
    mandate = MandateModel(
        id="0x" + "1" * 64,
        title="Compute Infrastructure Budget",
        account="0x1111111111111111111111111111111111111111",
        agent="0x2222222222222222222222222222222222222222",
        token="0x3333333333333333333333333333333333333333",
        recipient="0x4444444444444444444444444444444444444444",
        max_amount_per_tx=50_000_000,       # $50 USDC
        max_cumulative_amount=100_000_000,   # $100 USDC
        current_spent=0,
        reserved_amount=0,
        chain_id=31337,
        start_time=now - 100,
        expiry=now + 86400,
        version=1,
        is_revoked=False,
    )
    await mandate_repo.create(mandate)
    return mandate

@pytest.mark.asyncio
async def test_authorization_allowed_for_valid_request(async_db: AsyncSession, setup_mandate: MandateModel):
    service = AuthorizationService(async_db)
    req = PaymentAuthorizationRequest(
        mandate_id=setup_mandate.id,
        account=setup_mandate.account,
        token=setup_mandate.token,
        recipient=setup_mandate.recipient,
        amount=25_000_000,
        chain_id=setup_mandate.chain_id,
        idempotency_key="idemp_valid_01",
    )

    verdict = await service.evaluate_and_authorize(req)

    assert verdict.verdict == 1
    assert verdict.verdict_label == "ALLOW"
    assert verdict.signature is not None
    assert verdict.signature.startswith("0x")
    assert verdict.amount == 25_000_000

    # Verify budget reservation
    mandate_repo = MandateRepository(async_db)
    updated_mandate = await mandate_repo.get_by_id(setup_mandate.id)
    assert updated_mandate.reserved_amount == 25_000_000

@pytest.mark.asyncio
async def test_authorization_denied_when_mandate_not_found(async_db: AsyncSession):
    service = AuthorizationService(async_db)
    req = PaymentAuthorizationRequest(
        mandate_id="0x" + "f" * 64, # Non-existent
        account="0x1111111111111111111111111111111111111111",
        token="0x3333333333333333333333333333333333333333",
        recipient="0x4444444444444444444444444444444444444444",
        amount=10_000_000,
        chain_id=31337,
        idempotency_key="idemp_missing_01",
    )

    verdict = await service.evaluate_and_authorize(req)

    assert verdict.verdict == 0
    assert verdict.verdict_label == "DENY"
    assert verdict.signature is None
    assert "not found" in verdict.reason.lower()

@pytest.mark.asyncio
async def test_authorization_denied_for_revoked_mandate(async_db: AsyncSession, setup_mandate: MandateModel):
    mandate_repo = MandateRepository(async_db)
    await mandate_repo.revoke(setup_mandate.id)

    service = AuthorizationService(async_db)
    req = PaymentAuthorizationRequest(
        mandate_id=setup_mandate.id,
        account=setup_mandate.account,
        token=setup_mandate.token,
        recipient=setup_mandate.recipient,
        amount=10_000_000,
        chain_id=setup_mandate.chain_id,
        idempotency_key="idemp_revoked_01",
    )

    verdict = await service.evaluate_and_authorize(req)

    assert verdict.verdict == 0
    assert verdict.verdict_label == "DENY"
    assert "revoked" in verdict.reason.lower()

@pytest.mark.asyncio
async def test_authorization_denied_for_unapproved_recipient(async_db: AsyncSession, setup_mandate: MandateModel):
    service = AuthorizationService(async_db)
    req = PaymentAuthorizationRequest(
        mandate_id=setup_mandate.id,
        account=setup_mandate.account,
        token=setup_mandate.token,
        recipient="0x9999999999999999999999999999999999999999", # Unapproved
        amount=10_000_000,
        chain_id=setup_mandate.chain_id,
        idempotency_key="idemp_unapproved_recip",
    )

    verdict = await service.evaluate_and_authorize(req)

    assert verdict.verdict == 0
    assert "unapproved recipient" in verdict.reason.lower()

@pytest.mark.asyncio
async def test_authorization_denied_when_exceeding_per_tx_limit(async_db: AsyncSession, setup_mandate: MandateModel):
    service = AuthorizationService(async_db)
    req = PaymentAuthorizationRequest(
        mandate_id=setup_mandate.id,
        account=setup_mandate.account,
        token=setup_mandate.token,
        recipient=setup_mandate.recipient,
        amount=60_000_000, # Max is 50_000_000
        chain_id=setup_mandate.chain_id,
        idempotency_key="idemp_exceed_tx",
    )

    verdict = await service.evaluate_and_authorize(req)

    assert verdict.verdict == 0
    assert "exceeds max per-tx limit" in verdict.reason.lower()

@pytest.mark.asyncio
async def test_cumulative_spending_cap_enforcement(async_db: AsyncSession, setup_mandate: MandateModel):
    service = AuthorizationService(async_db)

    # First request: $45 (allowed, leaves $55 remaining of $100)
    verdict1 = await service.evaluate_and_authorize(PaymentAuthorizationRequest(
        mandate_id=setup_mandate.id,
        account=setup_mandate.account,
        token=setup_mandate.token,
        recipient=setup_mandate.recipient,
        amount=45_000_000,
        chain_id=setup_mandate.chain_id,
        idempotency_key="idemp_cum_1",
    ))
    assert verdict1.verdict == 1

    # Second request: $45 (allowed, leaves $10 remaining of $100)
    verdict2 = await service.evaluate_and_authorize(PaymentAuthorizationRequest(
        mandate_id=setup_mandate.id,
        account=setup_mandate.account,
        token=setup_mandate.token,
        recipient=setup_mandate.recipient,
        amount=45_000_000,
        chain_id=setup_mandate.chain_id,
        idempotency_key="idemp_cum_2",
    ))
    assert verdict2.verdict == 1

    # Third request: $20 (would total $110 > $100 -> MUST BE DENIED)
    verdict3 = await service.evaluate_and_authorize(PaymentAuthorizationRequest(
        mandate_id=setup_mandate.id,
        account=setup_mandate.account,
        token=setup_mandate.token,
        recipient=setup_mandate.recipient,
        amount=20_000_000,
        chain_id=setup_mandate.chain_id,
        idempotency_key="idemp_cum_3",
    ))
    assert verdict3.verdict == 0
    assert "exceeds remaining cumulative budget" in verdict3.reason.lower()

@pytest.mark.asyncio
async def test_idempotency_returns_identical_verdict(async_db: AsyncSession, setup_mandate: MandateModel):
    service = AuthorizationService(async_db)
    req = PaymentAuthorizationRequest(
        mandate_id=setup_mandate.id,
        account=setup_mandate.account,
        token=setup_mandate.token,
        recipient=setup_mandate.recipient,
        amount=10_000_000,
        chain_id=setup_mandate.chain_id,
        idempotency_key="idemp_repeat_key",
    )

    verdict_first = await service.evaluate_and_authorize(req)
    verdict_second = await service.evaluate_and_authorize(req)

    assert verdict_first.authorization_id == verdict_second.authorization_id
    assert verdict_first.signature == verdict_second.signature
    assert verdict_first.verdict == verdict_second.verdict
