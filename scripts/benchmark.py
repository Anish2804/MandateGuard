"""
MandateGuard — Performance & Gas Benchmark Suite (Requirement 36)
================================================================
Measures actual authorization latency (P50, P90, P99, mean, min, max)
and documents empirical gas consumption from Foundry tests.
"""

import time
import statistics
import asyncio
from httpx import AsyncClient, ASGITransport
import sys
import os

# Add backend directory to sys.path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.main import app
from app.core.database import init_db, AsyncSessionLocal
from app.models.mandate import MandateModel

FOUNDRY_GAS_METRICS = {
    "MandateGuardAccount Deployment (CREATE2)": 1564487,
    "Register Spending Mandate": 43800,
    "Execute Payment (Full EIP-712 & Transfer)": 243306,
    "Early Revert: Expired Verdict": 65817,
    "Early Revert: Unauthorized Key": 104790,
    "Early Revert: Tampered Recipient": 81850,
    "Early Revert: Tampered Amount": 99928,
    "EIP-1271 Signature Verification": 40813,
    "Emergency Token Withdrawal": 77120,
    "Pause / Unpause State Change": 58985,
}

async def benchmark_authorization_latency(sample_size: int = 100):
    await init_db()
    
    # Create test mandate in DB
    mandate_id = "0x" + "ff" * 32
    account_addr = "0xB07e049cc3245e8a765bA9bfb537CF5D5fFd4D68"
    token_addr = "0x9CA71737B76EE51d2366C53CC8CdF21DC5246097"
    merchant_addr = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"

    async with AsyncSessionLocal() as session:
        # Check if already exists
        existing = await session.get(MandateModel, mandate_id)
        if not existing:
            m = MandateModel(
                id=mandate_id,
                title="Benchmark Mandate",
                account=account_addr,
                agent="0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
                token=token_addr,
                recipient=merchant_addr,
                max_amount_per_tx=100_000_000,
                max_cumulative_amount=10_000_000_000,
                current_spent=0,
                reserved_amount=0,
                chain_id=84532,
                start_time=0,
                expiry=1893456000,
                version=1,
                is_revoked=False
            )
            session.add(m)
            await session.commit()

    transport = ASGITransport(app=app)
    latencies_ms = []

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Provision API key for account
        key_res = await client.post("/api/v1/auth/api-keys", json={
            "user_id": "benchmark_user",
            "account_address": account_addr,
            "name": "Benchmark Agent Key"
        })
        assert key_res.status_code == 201
        raw_api_key = key_res.json()["api_key"]

        # Warmup
        for w in range(5):
            await client.post(
                "/api/v1/authorize",
                json={
                    "mandate_id": mandate_id,
                    "account": account_addr,
                    "recipient": merchant_addr,
                    "token": token_addr,
                    "amount": 10_000,
                    "chain_id": 84532,
                    "idempotency_key": f"warmup_{w}"
                },
                headers={"X-API-Key": raw_api_key}
            )

        # Benchmark runs
        for i in range(sample_size):
            t0 = time.perf_counter()
            resp = await client.post(
                "/api/v1/authorize",
                json={
                    "mandate_id": mandate_id,
                    "account": account_addr,
                    "recipient": merchant_addr,
                    "token": token_addr,
                    "amount": 100_000,
                    "chain_id": 84532,
                    "idempotency_key": f"bench_{i}"
                },
                headers={"X-API-Key": raw_api_key}
            )
            t1 = time.perf_counter()
            assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
            latencies_ms.append((t1 - t0) * 1000.0)

    latencies_ms.sort()
    p50 = statistics.median(latencies_ms)
    p90 = latencies_ms[int(sample_size * 0.90)]
    p99 = latencies_ms[int(sample_size * 0.99)]
    mean_val = statistics.mean(latencies_ms)
    min_val = min(latencies_ms)
    max_val = max(latencies_ms)

    print("\n" + "="*60)
    print("MANDATEGUARD EMPIRICAL BENCHMARK REPORT (Requirement 36)")
    print("="*60)
    print(f"Sample Size: {sample_size} runs (in-process ASGI with SQLite transactions)")
    print(f"Mean Latency:   {mean_val:.2f} ms")
    print(f"P50 (Median):   {p50:.2f} ms")
    print(f"P90:            {p90:.2f} ms")
    print(f"P99:            {p99:.2f} ms")
    print(f"Min Latency:    {min_val:.2f} ms")
    print(f"Max Latency:    {max_val:.2f} ms")
    print("-" * 60)
    print("FOUNDRY ONCHAIN GAS BENCHMARK (Base / EVM)")
    print("-" * 60)
    for op, gas in FOUNDRY_GAS_METRICS.items():
        print(f"{op:<45}: {gas:>10,d} gas")
    print("=" * 60)

    return {
        "sample_size": sample_size,
        "mean_ms": mean_val,
        "p50_ms": p50,
        "p90_ms": p90,
        "p99_ms": p99,
        "min_ms": min_val,
        "max_ms": max_val,
        "gas_metrics": FOUNDRY_GAS_METRICS
    }

if __name__ == "__main__":
    asyncio.run(benchmark_authorization_latency(100))
