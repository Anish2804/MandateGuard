# MandateGuard — CTO Interview Briefing & 5-Minute Technical Demonstration

**Target Audience:** CTO & Principal Security Engineers at Saifuro  
**Role:** Senior Smart-Account / Wallet Infrastructure Engineer  
**Date:** November 4, 2026  
**System:** MANDATEGUARD — AI-Agent Payment Authorization & Enforceable Smart Account Architecture  

---

## 1. Executive Summary & Value Proposition

Traditional AI agent wallets suffer from a fundamental security dilemma:
- **Custodial Bottleneck:** Storing customer private keys in cloud databases or agent backends creates catastrophic custody risk and single-point-of-failure key compromise.
- **Unrestricted Agent Wallets:** Giving an autonomous LLM direct signing keys allows prompt injections, hallucinations, or agent bugs to drain customer treasuries.

**MANDATEGUARD** solves this via **Cryptographically Guarded Smart Accounts**:
1. **Human Authority:** The human principal sets granular spending mandates (per-tx limits, cumulative budget, token address, whitelisted merchants, expiry).
2. **Deterministic Signed Verdicts:** When an agent attempts a payment, an independent authorization engine validates policy compliance and signs an atomic EIP-712 `PaymentVerdict`.
3. **Smart-Account Enforcement Boundary:** The smart account (`MandateGuardAccount.sol`) cryptographically enforces that no protected tokens move unless an authentic, unexpired, non-replayed verdict signature from the authorized verifier is provided onchain.
4. **Bypass Resistance:** The agent cannot execute arbitrary calls or token transfers; every payment path is strictly gated.

---

## 2. Five-Minute Live Technical Walkthrough (Script)

### Minute 0:00 – 1:00: Problem & Trust Boundaries
> *"In enterprise agent systems, an autonomous agent must be able to pay for APIs and compute without holding unlimited private keys. MandateGuard introduces a three-party trust model:  
> 1. The **Human Owner** who controls the smart account and registers spending mandates.  
> 2. The **Authorizer Service**, which acts as a policy oracle holding an isolated signing key or MPC share.  
> 3. The **AI Agent**, which possesses its own execution key but zero authority to move funds without an offchain verdict signature.*"

### Minute 1:00 – 2:00: Inspecting the Human Spending Mandate
> *"Here on the dashboard (or via contract call `registerMandate`), the human principal has registered Mandate `0xaa...aa` on Base Sepolia. It permits payments exclusively in USDC (`0x9CA7...`), capped at 50 USDC per payment and 500 USDC cumulative, expiring in December 2026. This mandate is stored in onchain contract storage."*

### Minute 2:00 – 3:00: Valid Payment Authorization & Onchain Execution
> *"The agent wants to pay 20 USDC to Anthropic API (`0x7099...`).  
> 1. The agent calls `/api/v1/authorize`. The authorization service acquires a database row lock, verifies per-tx and cumulative limits, and produces an EIP-712 typed signature over `(verdict=ALLOW, chainId=84532, account, token, recipient, amount, mandateId, authorizationId, expiry, mandateVersion)`.  
> 2. The agent submits `executePayment(...)` to Base Sepolia.  
> 3. The contract verifies the authorizer's signature using OpenZeppelin `SignatureChecker`, marks `usedAuthorizationIds[authorizationId] = true`, increments `cumulativeSpent`, and safely transfers 20 USDC to Anthropic."*

### Minute 3:00 – 4:00: Live Attack Demonstration (Adversarial Bypass Rejections)
> *"Now we demonstrate how the smart account rejects adversarial tampering:*
> - **Attack 1 (Over-Limit Attempt):** The agent requests 60 USDC (exceeding the 50 USDC limit). The backend denies the verdict; if the agent attempts to force execution onchain, `MandateGuardAccount` reverts with `AmountExceedsLimitError`.
> - **Attack 2 (Tampered Recipient / Amount):** Suppose the agent alters the recipient address to attacker wallet `0xdead...`. The EIP-712 hash mismatches the authorizer's signature. The contract reverts with `InvalidSignatureError`.
> - **Attack 3 (Replay Attack):** The agent attempts to resubmit the valid 20 USDC verdict a second time. The contract detects that `usedAuthorizationIds[authorizationId] == true` and reverts with `AuthorizationAlreadyUsedError`.
> - **Attack 4 (Direct Arbitrary Call):** The agent tries calling `emergencyWithdrawToken`. The contract reverts with `OnlyOwnerError`."*

### Minute 4:00 – 5:00: Cryptographic Correctness & Invariant Testing
> *"To ensure mathematical correctness, we implemented Foundry stateful invariant testing (`MandateGuardAccountInvariant.t.sol`). Across 64 runs and 2,048 stateful fuzzing calls, zero invariants were violated: cumulative spend never exceeded the cap, and balance integrity remained 100% sound. The contracts also support EIP-1271 for multisig authorizers and include emergency pause controls."*

---

## 3. Key Architectural Trade-Offs

| Decision | Chosen Approach | Alternative Considered | Engineering Rationale |
|---|---|---|---|
| **Cryptographic Verdict Standard** | **EIP-712 Typed Data** | EIP-191 personal_sign or raw hash | EIP-712 provides domain separation (prevents cross-chain replay between Base and Ethereum), field readability, and structured type-safety. |
| **Signature Verification Engine** | **OZ `SignatureChecker` (EIP-1271)** | Raw `ecrecover` | Raw `ecrecover` fails if the authorizer is a Gnosis Safe or enterprise MPC smart wallet. `isValidSignatureNow` transparently supports both EOA keys and EIP-1271 contract wallets. |
| **Stateful Replay Tracking** | **Deterministic `authorizationId` mapping** | Sequential Account Nonce | A sequential nonce forces transactions to be strictly serialized. A unique 32-byte `authorizationId` permits concurrent authorized payments across multiple agent sub-tasks without head-of-line blocking. |
| **Spending Cap Tracking** | **Hybrid (Offchain reservation + Onchain tracking)** | Pure offchain or Pure onchain | Offchain reservation prevents concurrent agent requests from race-draining the budget, while onchain tracking provides zero-trust enforcement even if the backend is compromised. |

---

## 4. Likely Technical Follow-Up Questions & Model Answers

### Q1: "Why does `executePayment` require onchain verification if your backend already validated the policy?"
**Answer:** *"In a zero-trust model, the backend API is an untrusted entity from the smart account's perspective. If an attacker compromises the backend server or API keys, they could manipulate the database state. By requiring the smart account to independently verify the authorizer's signature, token address, recipient address, mandate limits, and cumulative spend onchain, the smart contract remains the final, incorruptible security barrier."*

### Q2: "How do you prevent spending-limit races when multiple agent tasks request authorization concurrently?"
**Answer:** *"We implement concurrency-safe atomic spending reservations at the database layer using `SELECT ... FOR UPDATE` row-level locking on the mandate record. When an authorization request arrives, the engine locks the mandate row, validates `remaining_budget >= amount`, reserves the amount, and commits the updated balance within an ACID transaction. In our stress test (`test_concurrency.py`), 10 concurrent requests of 20 USDC against a 100 USDC mandate resulted in exactly 5 approvals and 5 rejections, with zero overspend."*

### Q3: "What happens if the Authorizer signing key is compromised?"
**Answer:** *"If the authorizer key is suspected to be compromised:
1. The human owner calls `pause()` on `MandateGuardAccount.sol`, instantly freezing all payment executions.
2. The owner calls `setAuthorizerSigner(newAuthorizerAddress)` to rotate the trusted verification key.
3. Once rotated, any verdicts signed by the old compromised key will immediately fail `isValidSignatureNow` and revert.
4. For high-security environments, we support rotating the authorizer key to a multi-sig or Turnkey enclave (Requirement 9)."*

### Q4: "Why did you remove claims of ERC-4337 compatibility from your UI?"
**Answer:** *"Because honesty in engineering claims is non-negotiable. Our current smart account is an EIP-712 guarded smart account executed via standard transactions. It is not currently registered as an ERC-4337 `IAccount` with a `validateUserOp` EntryPoint loop. Claiming ERC-4337 support without an active Bundler and EntryPoint deployment would be misleading. We have clearly specified the ERC-4337 and ERC-7579 module architecture in `docs/session-keys.md` as our production roadmap."*

### Q5: "How does this translate to Solana and Squads?"
**Answer:** *"An EVM contract cannot protect Solana. Solana requires a native Anchor program utilizing Program-Derived Addresses (PDAs) for spending mandates and receipts. For signature verification, Solana uses Ed25519 instruction introspection (`sysvar::instructions`). In a Squads setup, the MandateGuard Anchor program would act as a spending policy delegate, issuing Cross-Program Invocations (CPIs) to the Squads v4 vault program only when an authorized verdict instruction is present in the transaction batch. We have documented this complete comparative architecture in `docs/solana-squads-architecture.md`."*
