# MandateGuard — AI Agent Payment Authorization & Smart Account Security

> **"No valid authorization, no payment."**

MandateGuard is an end-to-end security layer that prevents autonomous AI agents from spending funds unless their requested payment strictly complies with a human-approved mandate and is verified both off-chain by an authorization service and on-chain by a guarded smart account.

---

## High-Level Architecture

```
+-----------------------------------------------------------------------------------------+
|                                    HUMAN OWNER                                          |
|  - Creates & approves spending mandates (recipients, limits, token, chain, expiry)       |
|  - Can instantly revoke mandates via on-chain smart account or backend API              |
+--------------------------------------------+--------------------------------------------+
                                             |
                                             v
+-----------------------------------------------------------------------------------------+
|                           MANDATEGUARD AUTHORIZATION SERVICE                            |
|  - Evaluates payment requests against active policy & cumulative spending limits        |
|  - Tracks reservations & settlements with concurrency control                           |
|  - Issues cryptographically signed EIP-712 Verdicts (ALLOW / DENY)                      |
|  - Signs with dedicated authorizer key (separate from agent and account keys)           |
+--------------------------------------------+--------------------------------------------+
                                             |
                   Signed Verdict (ALLOW)    |    (DENY verdicts fail on-chain)
                                             v
+-----------------------------------------------------------------------------------------+
|                              GUARDED SMART ACCOUNT (EVM)                                |
|  - Enforces authorization before ANY token outflow                                      |
|  - Recomputes EIP-712 Typed Data Hash and recovers signer via ECDSA                     |
|  - Rejects: expired verdicts, invalid signers, replayed authorizations, revoked         |
|    mandates, altered amounts/recipients/tokens, and unauthorized bypass attempts        |
|  - SafeERC20 token transfer execution to recipient                                      |
+-----------------------------------------------------------------------------------------+
```

---

## Core Components

1. **Smart Contracts (`contracts/`)**:
   - `MandateGuardAccount.sol`: Guarded smart account with EIP-712 verification, replay defense, and on-chain mandate checks.
   - `MockUSDC.sol`: ERC-20 token with 6 decimals for deterministic local testing.
   - Comprehensive test suite with Foundry (`forge test`).

2. **Authorization Backend (`backend/`)**:
   - Python 3.11+ / FastAPI / SQLAlchemy / Pydantic.
   - EIP-712 signature generation using `eth_account`.
   - Concurrency-safe spending reservations and settlement lifecycle.
   - SQLite / PostgreSQL-ready storage with full audit logging.

3. **Frontend Dashboard (`frontend/`)**:
   - Next.js / TypeScript / React / Tailwind CSS.
   - Real-time policy simulator, mandate management, signed verdict inspector, and audit explorer.

---

## Quick Start (Local Development)

### Prerequisites
- Node.js v20+ & npm
- Python 3.11+
- Foundry (`forge`, `anvil`) or Docker / Docker Compose

### Option A: Windows PowerShell (Native 1-Command Runner)
If running directly in **Windows PowerShell**:
```powershell
# Run the entire test suite (Contracts + Backend + Live E2E)
.\scripts\test.ps1

# Or launch all services (Anvil + Backend + Frontend) in separate windows
.\scripts\dev.ps1
```

### Option B: WSL Ubuntu / Linux (Makefile)
If running inside **WSL** (`wsl -d Ubuntu-D`):
```bash
# Run complete test suite (Contracts + Backend + E2E)
make test

# Start the full stack locally with hot reload
make dev
```

### Option C: Docker Compose
```bash
docker-compose up --build
```
- Frontend Dashboard: [http://localhost:3000](http://localhost:3000)
- Backend OpenAPI Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- Local Anvil Node: [http://localhost:8545](http://localhost:8545)

### Option C: Manual Setup

1. **Start Anvil local EVM chain:**
   ```bash
   anvil --chain-id 31337 --port 8545
   ```

2. **Deploy Smart Contracts:**
   ```bash
   cd contracts
   forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
   ```

3. **Start Authorization Backend:**
   ```bash
   cd backend
   python -m venv .venv
   # Windows: .venv\Scripts\activate | Linux: source .venv/bin/activate
   pip install -e .
   uvicorn app.main:app --reload --port 8000
   ```

4. **Start Frontend Dashboard:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---

## 3–5 Minute End-to-End Demo Script

To demonstrate the full fiscal containment lifecycle to stakeholders or in a video walkthrough:

### Step 1: Open the Dashboard
Navigate to [http://localhost:3000](http://localhost:3000). Inspect the **System Health** card:
- Verify that **Local EVM Chain** (31337), **Authorization Backend** (v1.0.0), and **Smart Account Balance** (~$50,000.00 USDC) are online and active.

### Step 2: Create a Spending Mandate (Human Owner)
1. Go to the **Mandates** tab.
2. Click **Create Spending Mandate**.
3. Configure the policy:
   - **Agent Address**: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`
   - **Approved Recipient / Merchant**: `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`
   - **Max Per Transaction**: `50` ($50.00 USDC)
   - **Cumulative Spending Limit**: `500` ($500.00 USDC)
   - **Duration**: `24` Hours
4. Click **Create & Approve Mandate**. Observe that the mandate is registered both in the off-chain authorization database and directly on-chain on `MandateGuardAccount`.

### Step 3: Simulate a Valid Payment Request (AI Agent)
1. Navigate to the **Simulator** tab.
2. Select your newly created Mandate.
3. Keep the default preset: **Valid Payment ($25.00 USDC)** to the approved merchant.
4. Click **Submit Payment Request & Authorize**.
5. Observe the result:
   - **Backend Verdict**: Returns `ALLOW`.
   - **Cryptographic Proof**: Inspect the generated EIP-712 signature in the **Verdict Inspector**.
   - **On-Chain Execution**: Click **Execute Transfer on Smart Account**.
   - Observe the live transaction confirmation, updated block number, and the smart account and merchant balances updating in real time!

### Step 4: Adversarial Test 1 — Limit Breach ($100.00 USDC)
1. In the **Simulator**, select the **Limit Breach** preset.
2. Observe the requested amount is `$100.00 USDC` (exceeding the `$50.00 USDC` per-transaction mandate cap).
3. Click **Submit Payment Request & Authorize**.
4. Observe the result: **DENIED**. The policy engine refuses to sign, preventing any on-chain execution attempt.

### Step 5: Adversarial Test 2 — Unapproved Recipient / Phishing
1. In the **Simulator**, select the **Unapproved Recipient** preset (`0x90F79bf6EB2c4f870365E785982E1f101E93b906`).
2. Click **Submit Payment Request & Authorize**.
3. Observe the result: **DENIED**. The recipient does not exist in the mandate's approved recipient set.

### Step 6: Adversarial Test 3 — Replay Attack
1. In the **Simulator**, click **Replay Attack**.
2. Notice the simulator attempts to submit an already-executed authorization ID directly to the smart account on-chain.
3. Observe the smart contract execution reverts with `AuthorizationAlreadyUsed`!

### Step 7: Revocation
1. Go to **Mandates** and click **Revoke Mandate**.
2. Return to the **Simulator** and attempt any payment under this mandate.
3. Observe that both the authorization engine and smart contract reject any further token outflow.

---

## Verified Quality Gates & Test Results

| Test Category | Suite / Runner | Results | Status |
| :--- | :--- | :--- | :--- |
| **Smart Contracts** | Foundry `forge test -vvv` | **16 passed, 0 failed, 256 fuzz runs** | Passed |
| **Backend API & Signer** | Pytest `pytest backend/tests -v` | **11 passed, 0 failed** | Passed |
| **End-to-End Suite** | Python Web3 `python scripts/test_e2e.py` | **8 steps passed (100% success on live Anvil)** | Passed |
| **Frontend Production Build** | Next.js `npm run build` | **Compiled in 5.5s with zero errors** | Passed |

---

## Documentation Index

- [Architecture & Design](file:///e:/MandateGuard/docs/architecture.md)
- [Threat Model & Security Assumptions](file:///e:/MandateGuard/docs/threat-model.md)
- [EIP-712 Signed Verdict Specification](file:///e:/MandateGuard/docs/signed-verdict-spec.md)
- [REST API Reference](file:///e:/MandateGuard/docs/api.md)
- [Testing & Quality Assurance Guide](file:///e:/MandateGuard/docs/testing.md)
- [Deployment Guide (Local & Base Sepolia)](file:///e:/MandateGuard/docs/deployment.md)
- [Security Limitations & Production Roadmap](file:///e:/MandateGuard/docs/limitations.md)
- [Security Policy & Disclosures](file:///e:/MandateGuard/SECURITY.md)
- [Project Status & Implementation Log](file:///e:/MandateGuard/PROJECT_STATUS.md)

---

## Production Improvements Roadmap

MandateGuard is designed as an educational and portfolio prototype. Before deploying into a production multi-million dollar environment, implement the following roadmap items:

1. **ERC-4337 Account Abstraction Integration**: Wrap `MandateGuardAccount` as an ERC-4337 `IAccount` validating UserOperations through an EntryPoint contract.
2. **Hardware Security Module (HSM) / AWS KMS Signer**: Replace the software private key with AWS KMS, Google Cloud KMS, or a Turnkey MPC signer with automated key rotation.
3. **Decentralized Multi-Party Computation (MPC) Oracles**: Distribute verdict signing across an oracle network (e.g. Chainlink CRE / decentralized validators) to remove the single-point-of-failure centralized backend authorizer.
4. **Time-Weighted Rate Limiting & Epoch Roll-over**: Implement automated epoch rollover on-chain for daily and weekly recurring limits.
5. **Formal Verification**: Run Certora Prover or Halmos formal verification on the smart account bytecode to mathematically prove that unauthorized token outflow is impossible.
