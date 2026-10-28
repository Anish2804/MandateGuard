import pytest
import asyncio
import time
from app.core.database import init_db, AsyncSessionLocal
from app.models.mandate import MandateModel
from app.repositories.mandate_repo import MandateRepository

@pytest.fixture(autouse=True)
async def setup_db():
    await init_db()

@pytest.mark.asyncio
async def test_concurrent_budget_reservations_cannot_overspend():
    """
    Test that when 10 concurrent requests each attempt to reserve 30 USDC from a
    mandate with max cumulative limit of 100 USDC, exactly 3 succeed (total 90)
    and the remaining 7 fail, with zero overspending.
    """
    mandate_id = f"0x_test_concurrency_{int(time.time() * 1000)}"
    max_cumulative = 100_000_000 # 100 USDC
    req_amount = 30_000_000     # 30 USDC each

    async with AsyncSessionLocal() as session:
        repo = MandateRepository(session)
        model = MandateModel(
            id=mandate_id,
            title="Concurrency Test Mandate",
            account="0x1111111111111111111111111111111111111111",
            agent="0x2222222222222222222222222222222222222222",
            token="0x3333333333333333333333333333333333333333",
            recipient="0x4444444444444444444444444444444444444444",
            max_amount_per_tx=50_000_000,
            max_cumulative_amount=max_cumulative,
            current_spent=0,
            reserved_amount=0,
            chain_id=31337,
            start_time=int(time.time()) - 10,
            expiry=int(time.time()) + 3600,
            version=1,
            is_revoked=False,
        )
        await repo.create(model)

    async def attempt_reservation():
        async with AsyncSessionLocal() as session:
            repo = MandateRepository(session)
            return await repo.reserve_budget(mandate_id, req_amount)

    # Launch 10 concurrent reservation attempts simultaneously
    tasks = [attempt_reservation() for _ in range(10)]
    results = await asyncio.gather(*tasks)

    successful = [r for r in results if r is True]
    failed = [r for r in results if r is False]

    # Exactly 3 can succeed (3 * 30 = 90 <= 100; 4th would require 120 > 100)
    assert len(successful) == 3, f"Expected exactly 3 reservations to succeed, got {len(successful)}"
    assert len(failed) == 7, f"Expected 7 reservations to fail, got {len(failed)}"

    # Verify final state in database
    async with AsyncSessionLocal() as session:
        repo = MandateRepository(session)
        updated = await repo.get_by_id(mandate_id)
        assert updated is not None
        assert updated.reserved_amount == 90_000_000
        assert updated.remaining_budget == 10_000_000
        assert updated.reserved_amount <= updated.max_cumulative_amount
