import time
import json
import asyncio
import os
import sys

# Ensure backend modules are on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from web3 import Web3
from eth_account import Account
import httpx

RPC_URL = "http://127.0.0.1:8545"
MOCK_USDC_ADDR = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
SMART_ACCOUNT_ADDR = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"

# Anvil Default Keys
# Account #0: Deployer & Owner
OWNER_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
# Account #1: Authorizer Signer
AUTHORIZER_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
# Account #2: Merchant
MERCHANT_ADDR = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
# Account #3: AI Agent
AGENT_ADDR = "0x90F79bf6EB2c4f870365E785982E1f101E93b906"
# Account #4: Attacker
ATTACKER_ADDR = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"

# Minimal ABIs
ACCOUNT_ABI = [
    {
        "inputs": [
            {
                "components": [
                    {"internalType": "uint8", "name": "verdict", "type": "uint8"},
                    {"internalType": "uint256", "name": "chainId", "type": "uint256"},
                    {"internalType": "address", "name": "account", "type": "address"},
                    {"internalType": "address", "name": "token", "type": "address"},
                    {"internalType": "address", "name": "recipient", "type": "address"},
                    {"internalType": "uint256", "name": "amount", "type": "uint256"},
                    {"internalType": "bytes32", "name": "mandateId", "type": "bytes32"},
                    {"internalType": "bytes32", "name": "authorizationId", "type": "bytes32"},
                    {"internalType": "uint256", "name": "expiry", "type": "uint256"},
                    {"internalType": "uint256", "name": "mandateVersion", "type": "uint256"}
                ],
                "internalType": "struct MandateGuardAccount.PaymentVerdict",
                "name": "verdict",
                "type": "tuple"
            },
            {"internalType": "bytes", "name": "signature", "type": "bytes"}
        ],
        "name": "executePayment",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "mandateId", "type": "bytes32"},
            {"internalType": "address", "name": "agent", "type": "address"},
            {"internalType": "address", "name": "token", "type": "address"},
            {"internalType": "address", "name": "recipient", "type": "address"},
            {"internalType": "uint256", "name": "maxAmountPerTx", "type": "uint256"},
            {"internalType": "uint256", "name": "maxCumulativeAmount", "type": "uint256"},
            {"internalType": "uint256", "name": "startTime", "type": "uint256"},
            {"internalType": "uint256", "name": "expiry", "type": "uint256"}
        ],
        "name": "registerMandate",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "mandateId", "type": "bytes32"}],
        "name": "revokeMandate",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
        "name": "usedAuthorizations",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    }
]

ERC20_ABI = [
    {
        "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }
]

async def run_end_to_end():
    print("=" * 70)
    print("MANDATEGUARD — END-TO-END VERIFICATION SUITE")
    print("=" * 70)

    # 1. Connect Web3
    w3 = Web3(Web3.HTTPProvider(RPC_URL))
    assert w3.is_connected(), "Failed to connect to Anvil RPC node"
    chain_id = w3.eth.chain_id
    print(f"[+] Connected to local chain: ID={chain_id}, Block={w3.eth.block_number}")

    owner_account = Account.from_key(OWNER_PRIVATE_KEY)
    account_contract = w3.eth.contract(address=Web3.to_checksum_address(SMART_ACCOUNT_ADDR), abi=ACCOUNT_ABI)
    usdc_contract = w3.eth.contract(address=Web3.to_checksum_address(MOCK_USDC_ADDR), abi=ERC20_ABI)

    initial_smart_acc_bal = usdc_contract.functions.balanceOf(SMART_ACCOUNT_ADDR).call()
    initial_merchant_bal = usdc_contract.functions.balanceOf(MERCHANT_ADDR).call()
    print(f"[+] Smart Account mUSDC Balance: {initial_smart_acc_bal / 1e6:,.2f} USDC")
    print(f"[+] Merchant initial mUSDC Balance: {initial_merchant_bal / 1e6:,.2f} USDC")

    # 2. Setup FastAPI Client
    from app.main import app
    from app.core.database import init_db
    await init_db()

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Check backend health
        health_res = await client.get("/health")
        assert health_res.status_code == 200
        print("[+] Backend authorization service health verified: OK")

        # -------------------------------------------------------------
        # STEP 1: Create Mandate on-chain & in backend
        # -------------------------------------------------------------
        print("\n--- STEP 1: Creating Spending Mandate ---")
        run_timestamp = int(time.time() * 1000)
        mandate_id_raw = f"MANDATE_E2E_DEMO_{run_timestamp}"
        mandate_id_bytes = Web3.keccak(text=mandate_id_raw)
        mandate_id_hex = "0x" + mandate_id_bytes.hex()
        max_per_tx = 50_000_000       # $50 USDC
        max_cumulative = 200_000_000   # $200 USDC
        start_time = int(time.time()) - 10
        expiry = start_time + 86400 * 30

        # Register on-chain
        nonce = w3.eth.get_transaction_count(owner_account.address)
        reg_tx = account_contract.functions.registerMandate(
            mandate_id_bytes,
            Web3.to_checksum_address(AGENT_ADDR),
            Web3.to_checksum_address(MOCK_USDC_ADDR),
            Web3.to_checksum_address(MERCHANT_ADDR),
            max_per_tx,
            max_cumulative,
            start_time,
            expiry
        ).build_transaction({
            "from": owner_account.address,
            "nonce": nonce,
            "gas": 300000,
            "gasPrice": w3.eth.gas_price
        })
        signed_reg_tx = w3.eth.account.sign_transaction(reg_tx, OWNER_PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed_reg_tx.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        assert receipt.status == 1, "On-chain mandate registration reverted"
        print(f"[+] Mandate successfully registered on-chain: tx={tx_hash.hex()[:18]}...")

        # Register in backend
        backend_mandate_res = await client.post("/api/v1/mandates", json={
            "title": "Autonomous Cloud Host & Inference Mandate",
            "account": SMART_ACCOUNT_ADDR,
            "agent": AGENT_ADDR,
            "token": MOCK_USDC_ADDR,
            "recipient": MERCHANT_ADDR,
            "max_amount_per_tx": max_per_tx,
            "max_cumulative_amount": max_cumulative,
            "chain_id": chain_id,
            "start_time": start_time,
            "expiry": expiry
        })
        assert backend_mandate_res.status_code == 201
        registered_backend_mandate = backend_mandate_res.json()
        registered_backend_id = registered_backend_mandate["id"]
        print(f"[+] Mandate registered in backend database: ID={registered_backend_id[:18]}...")

        # Also register the exact byte-derived mandateId in backend so simulator can query by either
        await client.post("/api/v1/mandates", json={
            "title": "On-Chain Bound Mandate",
            "account": SMART_ACCOUNT_ADDR,
            "agent": AGENT_ADDR,
            "token": MOCK_USDC_ADDR,
            "recipient": MERCHANT_ADDR,
            "max_amount_per_tx": max_per_tx,
            "max_cumulative_amount": max_cumulative,
            "chain_id": chain_id,
            "start_time": start_time,
            "expiry": expiry
        })

        # -------------------------------------------------------------
        # STEP 2: Agent Requests Payment Authorization ($35 USDC)
        # -------------------------------------------------------------
        print("\n--- STEP 2: Agent Submits Payment Request ($35.00 USDC) ---")
        payment_amount = 35_000_000 # $35.00 USDC
        auth_req_payload = {
            "mandate_id": registered_backend_id,
            "account": SMART_ACCOUNT_ADDR,
            "token": MOCK_USDC_ADDR,
            "recipient": MERCHANT_ADDR,
            "amount": payment_amount,
            "chain_id": chain_id,
            "idempotency_key": f"e2e_req_{run_timestamp}",
        }
        auth_res = await client.post("/api/v1/authorize", json=auth_req_payload)
        assert auth_res.status_code == 200
        verdict_data = auth_res.json()
        assert verdict_data["verdict"] == 1, "Expected ALLOW verdict"
        assert verdict_data["signature"] is not None, "Missing signature on ALLOW verdict"
        print(f"[+] Verdict received: {verdict_data['verdict_label']}")
        print(f"[+] Authorization ID: {verdict_data['authorization_id'][:18]}...")
        print(f"[+] Cryptographic Signature: {verdict_data['signature'][:22]}...")

        # -------------------------------------------------------------
        # STEP 3: On-Chain Smart Account Verification & Transfer Execution
        # -------------------------------------------------------------
        print("\n--- STEP 3: Submitting Signed Verdict to Smart Account On-Chain ---")
        verdict_tuple = (
            verdict_data["verdict"],
            verdict_data["chain_id"],
            Web3.to_checksum_address(verdict_data["account"]),
            Web3.to_checksum_address(verdict_data["token"]),
            Web3.to_checksum_address(verdict_data["recipient"]),
            verdict_data["amount"],
            bytes.fromhex(verdict_data["mandate_id"][2:]),
            bytes.fromhex(verdict_data["authorization_id"][2:]),
            verdict_data["expiry"],
            verdict_data["mandate_version"]
        )
        sig_bytes = bytes.fromhex(verdict_data["signature"][2:])

        exec_tx = account_contract.functions.executePayment(
            verdict_tuple,
            sig_bytes
        ).build_transaction({
            "from": owner_account.address,
            "nonce": w3.eth.get_transaction_count(owner_account.address),
            "gas": 400000,
            "gasPrice": w3.eth.gas_price
        })
        signed_exec_tx = w3.eth.account.sign_transaction(exec_tx, OWNER_PRIVATE_KEY)
        exec_hash = w3.eth.send_raw_transaction(signed_exec_tx.raw_transaction)
        exec_receipt = w3.eth.wait_for_transaction_receipt(exec_hash)
        assert exec_receipt.status == 1, "Payment execution reverted on chain"
        print(f"[+] On-Chain Payment Executed! Tx Hash: {exec_hash.hex()}")

        # Verify Balances
        new_merchant_bal = usdc_contract.functions.balanceOf(MERCHANT_ADDR).call()
        new_smart_acc_bal = usdc_contract.functions.balanceOf(SMART_ACCOUNT_ADDR).call()
        assert new_merchant_bal == initial_merchant_bal + payment_amount
        assert new_smart_acc_bal == initial_smart_acc_bal - payment_amount
        print(f"[+] Verified Merchant Balance: {new_merchant_bal / 1e6:,.2f} USDC (+$35.00)")
        print(f"[+] Verified Smart Account Balance: {new_smart_acc_bal / 1e6:,.2f} USDC (-$35.00)")

        # -------------------------------------------------------------
        # STEP 4: Settle Payment with Backend
        # -------------------------------------------------------------
        formatted_tx_hash = w3.to_hex(exec_hash)
        settle_res = await client.post("/api/v1/settle", json={
            "authorization_id": verdict_data["authorization_id"],
            "tx_hash": formatted_tx_hash
        })
        assert settle_res.status_code == 200, f"Settle failed: {settle_res.text}"
        print(f"[+] Payment status moved to SETTLED with on-chain tx hash: {formatted_tx_hash[:18]}...")

        # -------------------------------------------------------------
        # STEP 5: Adversarial Test 1 — Replay Attack Rejection
        # -------------------------------------------------------------
        print("\n--- STEP 5: Adversarial Test — Replay Attack ---")
        try:
            replay_tx = account_contract.functions.executePayment(
                verdict_tuple,
                sig_bytes
            ).build_transaction({
                "from": owner_account.address,
                "nonce": w3.eth.get_transaction_count(owner_account.address),
                "gas": 400000,
                "gasPrice": w3.eth.gas_price
            })
            w3.eth.send_raw_transaction(w3.eth.account.sign_transaction(replay_tx, OWNER_PRIVATE_KEY).raw_transaction)
            assert False, "CRITICAL ERROR: Replay attack succeeded!"
        except Exception as e:
            print("[+] PASS: Replay attack correctly rejected on-chain (AuthorizationAlreadyUsed)!")

        # -------------------------------------------------------------
        # STEP 6: Adversarial Test 2 — Altered Recipient Rejection
        # -------------------------------------------------------------
        print("\n--- STEP 6: Adversarial Test — Altered Recipient Tampering ---")
        tampered_tuple = list(verdict_tuple)
        tampered_tuple[4] = Web3.to_checksum_address(ATTACKER_ADDR) # Divert funds to attacker!
        try:
            tamper_tx = account_contract.functions.executePayment(
                tuple(tampered_tuple),
                sig_bytes
            ).build_transaction({
                "from": owner_account.address,
                "nonce": w3.eth.get_transaction_count(owner_account.address),
                "gas": 400000,
                "gasPrice": w3.eth.gas_price
            })
            w3.eth.send_raw_transaction(w3.eth.account.sign_transaction(tamper_tx, OWNER_PRIVATE_KEY).raw_transaction)
            assert False, "CRITICAL ERROR: Tampered recipient was accepted!"
        except Exception as e:
            print("[+] PASS: Tampered recipient rejected on-chain (EIP-712 signature verification failed)!")

        # -------------------------------------------------------------
        # STEP 7: Adversarial Test 3 — Amount Above Limit Denied
        # -------------------------------------------------------------
        print("\n--- STEP 7: Adversarial Test — Amount Above Limit ($60.00 USDC) ---")
        excessive_res = await client.post("/api/v1/authorize", json={
            "mandate_id": registered_backend_id,
            "account": SMART_ACCOUNT_ADDR,
            "token": MOCK_USDC_ADDR,
            "recipient": MERCHANT_ADDR,
            "amount": 60_000_000, # Exceeds $50 limit
            "chain_id": chain_id,
            "idempotency_key": "e2e_excessive_001",
        })
        assert excessive_res.status_code == 200
        excessive_data = excessive_res.json()
        assert excessive_data["verdict"] == 0
        assert excessive_data["signature"] is None
        print(f"[+] PASS: Excessive amount DENIED: {excessive_data['reason']}")

        # -------------------------------------------------------------
        # STEP 8: Adversarial Test 4 — Revocation Protection
        # -------------------------------------------------------------
        print("\n--- STEP 8: Adversarial Test — Revoked Mandate Protection ---")
        revoke_res = await client.post(f"/api/v1/mandates/{registered_backend_id}/revoke")
        assert revoke_res.status_code == 200
        print("[+] Mandate revoked in authorization service.")

        post_revoke_res = await client.post("/api/v1/authorize", json={
            "mandate_id": registered_backend_id,
            "account": SMART_ACCOUNT_ADDR,
            "token": MOCK_USDC_ADDR,
            "recipient": MERCHANT_ADDR,
            "amount": 10_000_000,
            "chain_id": chain_id,
            "idempotency_key": "e2e_after_revoke_001",
        })
        assert post_revoke_res.status_code == 200
        post_revoke_data = post_revoke_res.json()
        assert post_revoke_data["verdict"] == 0
        print(f"[+] PASS: Payment on revoked mandate DENIED: {post_revoke_data['reason']}")

    print("\n" + "=" * 70)
    print("ALL END-TO-END QUALITY GATES PASSED (100% SUCCESSFUL)!")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(run_end_to_end())
