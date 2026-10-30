import pytest
import time
import os
import sys
import socket
import httpx

# Ensure SDK is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "sdk", "python")))

from mandateguard import MandateGuardClient
from app.main import app
from app.core.database import init_db

@pytest.fixture(autouse=True)
async def setup_database():
    await init_db()

def is_server_listening(host="127.0.0.1", port=8000):
    try:
        with socket.create_connection((host, port), timeout=0.5):
            return True
    except OSError:
        return False

@pytest.mark.asyncio
async def test_sdk_inprocess_authorization_and_verdict():
    """Verify SDK client flows completely in-process via ASGI transport without external dependencies."""
    account_addr = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
    merchant_addr = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Create API Key
        key_res = await client.post("/api/v1/auth/api-keys", json={
            "user_id": "inproc_sdk_user",
            "account_address": account_addr,
            "name": "InProc SDK Bot"
        })
        assert key_res.status_code == 201
        raw_api_key = key_res.json()["api_key"]

        # 2. Create Mandate
        timestamp = int(time.time() * 1000)
        mandate_res = await client.post("/api/v1/mandates", json={
            "title": f"InProc SDK Mandate {timestamp}",
            "account": account_addr,
            "agent": "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
            "token": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
            "recipient": merchant_addr,
            "max_amount_per_tx": 50_000_000,
            "max_cumulative_amount": 200_000_000,
            "chain_id": 31337,
            "start_time": int(time.time()),
            "expiry": int(time.time()) + 3600
        })
        assert mandate_res.status_code == 201
        mandate_id = mandate_res.json()["id"]

        # 3. Instantiate SDK client with in-process ASGI transport client
        sdk_client = MandateGuardClient(
            api_key=raw_api_key,
            account_address=account_addr,
            base_url="http://testserver",
            http_client=client
        )

        # 4. Request valid authorization
        verdict = await sdk_client.request_authorization(
            mandate_id=mandate_id,
            recipient=merchant_addr,
            amount_usdc=10.0,
            chain_id=31337
        )

        assert verdict.allowed is True
        assert verdict.verdict_label == "ALLOW"
        assert verdict.amount == 10_000_000
        assert verdict.amount_usdc == 10.0
        assert verdict.signature is not None
        assert verdict.signature.startswith("0x")
        assert len(verdict.signature) == 132  # 65 bytes in hex + 0x

        # 5. Request excessive authorization -> DENIED
        denied_verdict = await sdk_client.request_authorization(
            mandate_id=mandate_id,
            recipient=merchant_addr,
            amount_usdc=100.0,  # Exceeds $50 per-tx limit
            chain_id=31337
        )
        assert denied_verdict.allowed is False
        assert denied_verdict.verdict_label == "DENY"
        assert denied_verdict.signature is None

@pytest.mark.skipif(
    not is_server_listening(),
    reason="Live backend not running on http://127.0.0.1:8000"
)
@pytest.mark.asyncio
async def test_sdk_full_flow():
    """Live full integration test against external HTTP & Anvil node."""
    account_addr = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
    merchant_addr = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
    owner_private_key = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

    async with httpx.AsyncClient(base_url="http://127.0.0.1:8000") as client:
        key_res = await client.post("/api/v1/auth/api-keys", json={
            "user_id": "test_sdk_user",
            "account_address": account_addr,
            "name": "SDK Test Bot"
        })
        assert key_res.status_code == 201
        raw_api_key = key_res.json()["api_key"]

        timestamp = int(time.time() * 1000)
        mandate_res = await client.post("/api/v1/mandates", json={
            "title": f"SDK Mandate {timestamp}",
            "account": account_addr,
            "agent": "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
            "token": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
            "recipient": merchant_addr,
            "max_amount_per_tx": 50_000_000,
            "max_cumulative_amount": 200_000_000,
            "chain_id": 31337,
            "start_time": int(time.time()),
            "expiry": int(time.time()) + 3600
        })
        assert mandate_res.status_code == 201
        mandate_id = mandate_res.json()["id"]

    sdk_client = MandateGuardClient(
        api_key=raw_api_key,
        account_address=account_addr,
        base_url="http://127.0.0.1:8000",
        rpc_url="http://127.0.0.1:8545"
    )

    verdict = await sdk_client.request_authorization(
        mandate_id=mandate_id,
        recipient=merchant_addr,
        amount_usdc=10.0,
        chain_id=31337
    )

    assert verdict.allowed is True
    assert verdict.verdict_label == "ALLOW"
    assert verdict.amount_usdc == 10.0
    assert verdict.signature is not None

    from mandateguard.client import Web3, Account, ACCOUNT_ABI
    w3 = Web3(Web3.HTTPProvider("http://127.0.0.1:8545"))
    account_contract = w3.eth.contract(address=Web3.to_checksum_address(account_addr), abi=ACCOUNT_ABI)
    owner_acc = Account.from_key(owner_private_key)
    mandate_bytes = bytes.fromhex(mandate_id[2:])
    reg_tx = account_contract.functions.registerMandate(
        mandate_bytes,
        Web3.to_checksum_address("0x90F79bf6EB2c4f870365E785982E1f101E93b906"),
        Web3.to_checksum_address("0x5FbDB2315678afecb367f032d93F642f64180aa3"),
        Web3.to_checksum_address(merchant_addr),
        50_000_000,
        200_000_000,
        int(time.time()) - 10,
        int(time.time()) + 3600
    ).build_transaction({
        "from": owner_acc.address,
        "nonce": w3.eth.get_transaction_count(owner_acc.address),
        "gas": 300000,
        "gasPrice": w3.eth.gas_price
    })
    signed_reg_tx = w3.eth.account.sign_transaction(reg_tx, owner_private_key)
    reg_hash = w3.eth.send_raw_transaction(signed_reg_tx.raw_transaction)
    w3.eth.wait_for_transaction_receipt(reg_hash)

    tx_hash = sdk_client.execute_payment_on_chain(verdict, owner_private_key)
    assert tx_hash.startswith("0x")

    settled = await sdk_client.settle(verdict.authorization_id, tx_hash)
    assert settled is True
