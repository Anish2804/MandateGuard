import pytest
import time
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import init_db

@pytest.fixture(autouse=True)
async def initialize_test_database():
    await init_db()

@pytest.mark.asyncio
async def test_api_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        assert "authorizer_signer" in data

@pytest.mark.asyncio
async def test_api_mandate_lifecycle_and_authorization():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        now = int(time.time())
        # 1. Create Mandate
        mandate_payload = {
            "title": "API Test Mandate",
            "account": "0x1111111111111111111111111111111111111111",
            "agent": "0x2222222222222222222222222222222222222222",
            "token": "0x3333333333333333333333333333333333333333",
            "recipient": "0x4444444444444444444444444444444444444444",
            "max_amount_per_tx": 30_000_000,
            "max_cumulative_amount": 100_000_000,
            "chain_id": 31337,
            "start_time": now - 10,
            "expiry": now + 86400,
        }
        res_create = await client.post("/api/v1/mandates", json=mandate_payload)
        assert res_create.status_code == 201
        mandate_data = res_create.json()
        mandate_id = mandate_data["id"]

        # 2. List Mandates
        res_list = await client.get("/api/v1/mandates")
        assert res_list.status_code == 200
        assert any(m["id"] == mandate_id for m in res_list.json())

        # 3. Request Valid Authorization
        auth_payload = {
            "mandate_id": mandate_id,
            "account": "0x1111111111111111111111111111111111111111",
            "token": "0x3333333333333333333333333333333333333333",
            "recipient": "0x4444444444444444444444444444444444444444",
            "amount": 20_000_000,
            "chain_id": 31337,
            "idempotency_key": f"api_test_req_{int(time.time() * 1000)}",
        }
        res_auth = await client.post("/api/v1/authorize", json=auth_payload)
        assert res_auth.status_code == 200
        auth_data = res_auth.json()
        assert auth_data["verdict"] == 1
        assert auth_data["signature"] is not None

        # 4. Verify Verdict Signature
        verify_payload = {
            "verdict": auth_data["verdict"],
            "chain_id": auth_data["chain_id"],
            "account": auth_data["account"],
            "token": auth_data["token"],
            "recipient": auth_data["recipient"],
            "amount": auth_data["amount"],
            "mandate_id": auth_data["mandate_id"],
            "authorization_id": auth_data["authorization_id"],
            "expiry": auth_data["expiry"],
            "mandate_version": auth_data["mandate_version"],
            "signature": auth_data["signature"],
        }
        res_verify = await client.post("/api/v1/verdicts/verify", json=verify_payload)
        assert res_verify.status_code == 200
        assert res_verify.json()["is_valid"] is True

        # 5. Settle Payment
        settle_payload = {
            "authorization_id": auth_data["authorization_id"],
            "tx_hash": "0x" + "c" * 64,
        }
        res_settle = await client.post("/api/v1/settle", json=settle_payload)
        assert res_settle.status_code == 200
        assert res_settle.json()["status"] == "SETTLED"

        # 6. Check Audit Events
        res_audit = await client.get("/api/v1/audit-events")
        assert res_audit.status_code == 200
        assert len(res_audit.json()) > 0
