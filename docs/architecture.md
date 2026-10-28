# MandateGuard System Architecture

**Version**: 1.1  
**Classification**: System Architecture Specification  

---

## 1. Introduction

MandateGuard solves the problem of autonomous AI agent fiscal containment. Rather than granting autonomous agents direct private key access to treasury or hot-wallet funds, MandateGuard introduces a dual-verification workflow:
1. **Off-Chain Semantic & Cumulative Policy Verification**: Handled by an authorization engine maintaining human spending mandates and reservation-based spending caps.
2. **On-Chain Cryptographic & Invariant Verification**: Handled by a guarded smart account holding token custody and executing payments only against valid EIP-712 authorizations.

---

## 2. Component Workflow Diagram

```
+----------------+          +-------------------------+          +-------------------------+
| AI Agent / Sim |          | Authorization Service   |          | Smart Account (On-Chain)|
+-------+--------+          +------------+------------+          +------------+------------+
        |                                |                                    |
        | 1. POST /api/v1/authorize      |                                    |
        | (recipient, amount, mandateId) |                                    |
        |------------------------------->|                                    |
        |                                | 2. Query Mandate Policy            |
        |                                | 3. Atomic SQL Budget Reservation   |
        |                                | 4. Check per-tx limit & cumulative |
        |                                | 5. If valid, sign EIP-712 verdict  |
        | 6. Returns Signed ALLOW Verdict|                                    |
        |<-------------------------------|                                    |
        |                                                                     |
        | 7. executePayment(verdict, signature)                               |
        |-------------------------------------------------------------------->|
        |                                                                     | 8. Verify EIP-712 & Domain
        |                                                                     | 9. Check !used[authId]
        |                                                                     | 10. Check mandate.isRegistered
        |                                                                     | 11. Check !mandate.revoked
        |                                                                     | 12. Check amount & cumulative limits
        |                                                                     | 13. SafeERC20.transfer
        |                                                                     | 14. Emit PaymentExecuted
        |                                15. POST /api/v1/settle (txHash)     |
        |                                ------------------------------------>|
        |                                | 16. Verify Receipt & Event on Chain|
        |                                | 17. Settle Reservation to Spent    |
```

---

## 3. Core Architectural Components

### 3.1 Smart Account Factory (`MandateGuardFactory.sol`)
- Deploys isolated `MandateGuardAccount` instances per user/organization.
- Supports both standard deployment and deterministic CREATE2 deployment (`predictAccountAddress`).
- Maintains an on-chain registry mapping owners to their deployed smart accounts.
- Governs the platform default authorizer signer address (`defaultAuthorizerSigner`).

### 3.2 Guarded Smart Account (`MandateGuardAccount.sol`)
- Custodies ERC-20 tokens (e.g., USDC).
- Enforces on-chain mandate registration: `mandates[mandateId].isRegistered == true` is required for payment execution.
- Verifies EIP-712 domain separation, monotonic mandate versioning, and single-use replay defense (`usedAuthorizations[authId] = true`).
- Protects against reentrancy via OpenZeppelin `ReentrancyGuard` and uses `SafeERC20` for transfers.
- Owner retains emergency token recovery via `emergencyWithdrawToken`.

### 3.3 Authorization Backend (FastAPI)
- Exposes versioned endpoints (`/api/v1/`).
- Validates request payloads with Pydantic v2 schemas.
- Enforces API key authentication (`X-API-Key`) with hashed database storage (`sha256`).
- Implements atomic database reservation queries to eliminate race conditions.
- Verifies transaction receipts and event logs before settling payments.

### 3.4 Cryptographic Signer Subsystem (`app/core/signer.py`)
- Standardized EIP-712 typed-data encoder.
- Provides `BaseVerdictSigner` interface with pluggable drivers:
  - `LocalPrivateKeySigner`: For local development, Anvil, and automated unit testing.
  - `AwsKmsVerdictSigner`: For production cloud HSM deployment where private keys never leave hardware modules.

---

## 4. Key Security Invariants

1. **No Direct Spending**: An agent NEVER has signing authority over the smart account or its tokens.
2. **Mandate Registration Required**: Payments can only execute against mandates registered on-chain by the human owner.
3. **No Secret Exposure**: The human owner and the authorizer service operate separate keys.
4. **Strict Parameter Equality**: The on-chain contract enforces exact equality between the signed fields and the token transfer arguments.
5. **Replay Impossibility**: Every authorization ID can only transition from unused to used once.
6. **No Execution of DENY Verdicts**: If the authorization service issues a DENY verdict, its verdict value is 0, which the smart contract rejects unconditionally.
7. **No Unverified Settlements**: The backend settles payments only after verifying the transaction receipt (`status == 1`) and the matching `PaymentExecuted` event log from the blockchain.
