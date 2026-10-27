import pytest
import time
import httpx
from app.main import app
from app.core.database import init_db

@pytest.fixture(autouse=True)
async def setup_database():
    await init_db()

@pytest.mark.asyncio
async def test_api_key_lifecycle_and_account_isolation():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        user_id = "user_test_tenant_01"
        account_a = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
        account_b = "0x1111111111111111111111111111111111111111"

        # 1. Create API Key for Account A
        create_res = await client.post("/api/v1/auth/api-keys", json={
            "user_id": user_id,
            "account_address": account_a,
            "name": "Cloud DevOps Agent A"
        })
        assert create_res.status_code == 201
        data = create_res.json()
        raw_api_key = data["api_key"]
        key_id = data["id"]
        assert raw_api_key.startswith("mg_live_")
        assert data["account_address"] == account_a.lower()

        # 2. List API Keys
        list_res = await client.get("/api/v1/auth/api-keys")
        assert list_res.status_code == 200
        keys = list_res.json()
        assert any(k["id"] == key_id for k in keys)

        # 3. Create a mandate on Account A
        timestamp = int(time.time() * 1000)
        mandate_res = await client.post("/api/v1/mandates", json={
            "title": f"Tenant Mandate {timestamp}",
            "account": account_a,
            "agent": "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
            "token": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
            "recipient": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
            "max_amount_per_tx": 50_000_000,
            "max_cumulative_amount": 200_000_000,
            "chain_id": 31337,
            "start_time": int(time.time()),
            "expiry": int(time.time()) + 3600
        })
        assert mandate_res.status_code == 201
        mandate_id = mandate_res.json()["id"]

        # 4. Agent calls /authorize WITH valid API Key for Account A -> ALLOW
        auth_res = await client.post(
            "/api/v1/authorize",
            headers={"X-API-Key": raw_api_key},
            json={
                "mandate_id": mandate_id,
                "account": account_a,
                "token": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
                "recipient": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
                "amount": 20_000_000,
                "chain_id": 31337,
                "idempotency_key": f"tenant_req_{timestamp}"
            }
        )
        assert auth_res.status_code == 200
        assert auth_res.json()["verdict"] == 1

        # 5. Agent tries to cross-spend against Account B using Account A's API Key -> 403 Forbidden!
        cross_spend_res = await client.post(
            "/api/v1/authorize",
            headers={"X-API-Key": raw_api_key},
            json={
                "mandate_id": mandate_id,
                "account": account_b,
                "token": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
                "recipient": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
                "amount": 20_000_000,
                "chain_id": 31337,
                "idempotency_key": f"cross_spend_{timestamp}"
            }
        )
        assert cross_spend_res.status_code == 403
        assert "API Key is locked to account" in cross_spend_res.json()["detail"]

        # 6. Revoke API Key
        del_res = await client.delete(f"/api/v1/auth/api-keys/{key_id}")
        assert del_res.status_code == 200

        # 7. Agent tries to authorize with revoked API key -> 401 Unauthorized!
        revoked_res = await client.post(
            "/api/v1/authorize",
            headers={"X-API-Key": raw_api_key},
            json={
                "mandate_id": mandate_id,
                "account": account_a,
                "token": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
                "recipient": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
                "amount": 10_000_000,
                "chain_id": 31337,
                "idempotency_key": f"revoked_req_{timestamp}"
            }
        )
        assert revoked_res.status_code == 401
