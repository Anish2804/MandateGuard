"""
Example Autonomous AI Agent using MandateGuard SDK
Demonstrates:
1. Agent initializes MandateGuardClient with its assigned API key.
2. Agent requests payment authorization for a cloud server ($15.00 USDC).
3. Backend policy validates human mandate rules.
4. Agent executes payment on-chain via smart account.
"""

import asyncio
import os
import sys

# Ensure SDK is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from mandateguard import MandateGuardClient

async def main():
    print("=====================================================")
    print("🤖 Autonomous AI Agent — MandateGuard Payment Workflow")
    print("=====================================================")

    # 1. Initialize client with Agent's API Key and assigned Smart Account
    # In production, these are loaded from os.environ
    API_KEY = "mg_live_demo_agent_key"
    SMART_ACCOUNT = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
    MERCHANT_ADDRESS = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" # Cloud GPU Host
    AGENT_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

    client = MandateGuardClient(
        api_key=API_KEY,
        account_address=SMART_ACCOUNT,
        base_url="http://127.0.0.1:8000",
        rpc_url="http://127.0.0.1:8545"
    )

    # 2. Agent needs to pay $15.00 USDC for GPU instance
    print("\n[+] Agent requesting payment authorization: $15.00 USDC...")
    # Using existing seed mandate or query active
    verdict = await client.request_authorization(
        mandate_id="0x0000000000000000000000000000000000000000000000000000000000000000",
        recipient=MERCHANT_ADDRESS,
        amount_usdc=15.0
    )

    print(f"[+] Policy Evaluation: {verdict.verdict_label}")

    if verdict.allowed:
        print(f"[+] Received Signed EIP-712 Verdict: {verdict.signature[:22]}...")
        print("[+] Submitting to Smart Account on-chain...")
        tx_hash = client.execute_payment_on_chain(verdict, AGENT_KEY)
        print(f"[+] Payment Successful! Transaction Hash: {tx_hash}")

        # Settle with backend
        await client.settle(verdict.authorization_id, tx_hash)
        print("[+] Accounting marked as SETTLED in backend.")
    else:
        print(f"[-] Payment BLOCKED by MandateGuard: {verdict.reason}")

if __name__ == "__main__":
    asyncio.run(main())
