# MandateGuard: Repository Gap Analysis & Security Audit

**Audit Date**: October 2026  
**Auditor**: Principal Blockchain Security Engineer & Systems Architect  
**Classification**: Highly Confidential / Engineering Specification  
**Baseline Commit**: `origin/main`  

---

## 1. Executive Summary

MandateGuard is an AI-agent payment authorization platform designed to bridge off-chain autonomous agent spending with on-chain cryptographic enforcement via smart accounts.

This gap analysis establishes the baseline findings from an exhaustive review of:
- Smart contracts (`contracts/src/MandateGuardAccount.sol`, `contracts/src/MandateGuardFactory.sol`, `contracts/src/MockUSDC.sol`).
- Foundry test suites and fuzzing configurations (`contracts/test/`).
- Python backend services (`backend/app/`).
- Database repositories, schemas, and concurrency controls (`backend/app/repositories/`, `backend/app/models/`).
- Python SDK (`sdk/python/`).
- Next.js Web3 frontend (`frontend/`).
- Deployment scripts and CI workflows.

While the core cryptographic foundations (EIP-712 typed-data hashing, replay protection mappings, and basic checks) are established, multiple critical and high-severity violations of the **Non-Negotiable Engineering Rules** were identified.

---

## 2. Findings Matrix

| ID | Component | Severity | Description | Exploitability | Remediation Priority |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **MG-GAP-01** | Frontend & Backend | **CRITICAL** | Fabricated transaction hash generation (`mockTxHash`) and unverified settlement | High | **P0 (Immediate)** |
| **MG-GAP-02** | Smart Contract | **HIGH** | Optional on-chain mandate registration allows bypass of limits if signer is compromised | Medium | **P0 (Immediate)** |
| **MG-GAP-03** | Backend Database | **HIGH** | TOCTOU race condition in budget reservation (`reserve_budget`) | High | **P0 (Immediate)** |
| **MG-GAP-04** | Backend Config | **HIGH** | Insecure fallback private keys in production configuration | Medium | **P1 (High)** |
| **MG-GAP-05** | Backend Settlement | **HIGH** | Lack of on-chain transaction receipt & event log verification | High | **P1 (High)** |
| **MG-GAP-06** | Frontend Web3 | **MEDIUM** | Frontend lacks on-chain `registerMandate` and `revokeMandate` wallet triggers | Low | **P1 (High)** |
| **MG-GAP-07** | Backend API | **MEDIUM** | Missing request correlation IDs (`X-Request-ID`) and rate limiting | Medium | **P2 (Medium)** |
| **MG-GAP-08** | Testing Suite | **MEDIUM** | `test_sdk.py` requires live running external server during unit test runs | Low | **P2 (Medium)** |
| **MG-GAP-09** | Database Schema | **MEDIUM** | Lack of version-controlled Alembic migrations (relying on `create_all`) | Low | **P2 (Medium)** |
| **MG-GAP-10** | Smart Contract | **LOW** | `emergencyWithdrawToken` lacks a time-lock for non-owner fund protection | Low | **P3 (Informational)** |

---

## 3. Detailed Audit Findings

### MG-GAP-01: Fabricated Transaction Hashes (Rule 3 Violation)
- **File**: `frontend/app/page.tsx:449`
- **Pattern**:
  ```typescript
  const mockTxHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;
  await settlePayment(simVerdict.authorization_id, mockTxHash);
  setSimTxHash(mockTxHash);
  ```
- **Analysis**: If wallet execution fails or wallet is disconnected, the frontend creates a random 32-byte hex string, sends it to the settlement endpoint, and renders "On-chain payment verified!". This directly violates Rule 3 ("No fake transactions, fabricated hashes, invented account balances, simulated confirmations presented as real").
- **Remediation**: Remove mock hash generation entirely. If wallet execution is requested, require a valid Web3 provider or backend relayer. If execution is rejected, display a clear error message.

---

### MG-GAP-02: Optional On-Chain Mandate Registration (Rule 10 & 14 Violation)
- **File**: `contracts/src/MandateGuardAccount.sol:238-264`
- **Pattern**:
  ```solidity
  Mandate storage mandate = mandates[verdict.mandateId];
  if (mandate.isRegistered) {
      if (mandate.revoked) revert MandateRevokedError(verdict.mandateId);
      // checks limits, recipient, token, expiry...
  }
  // Proceeds to verify signature and transfer tokens even if isRegistered == false!
  ```
- **Analysis**: If `mandate.isRegistered` is false, all on-chain policy enforcement (spending limits, recipient restrictions, token whitelist) is skipped. The contract relies exclusively on the authorizer signature. If an authorizer key is leaked or a backend database is compromised, an attacker can drain tokens using an unregistered mandate ID.
- **Remediation**: Enforce `if (!mandate.isRegistered) revert MandateNotRegistered(verdict.mandateId);`. Ensure all mandates executed through the smart account must be registered by the owner.

---

### MG-GAP-03: TOCTOU Concurrency in Budget Reservation (Rule 8 & Section 6 Violation)
- **File**: `backend/app/repositories/mandate_repo.py:34-49`
- **Pattern**:
  ```python
  mandate = await self.get_by_id(mandate_id)
  if mandate.remaining_budget < amount:
      return False
  mandate.reserved_amount += amount
  await self.db.commit()
  ```
- **Analysis**: Read-then-write pattern in async Python. Two concurrent requests arriving at the same millisecond read the same remaining budget. Both pass the budget check, leading to reservation exceeding `max_cumulative_amount`.
- **Remediation**: Execute an atomic SQL `UPDATE` statement with a conditional `WHERE` clause:
  ```python
  stmt = (
      update(MandateModel)
      .where(
          MandateModel.id == mandate_id,
          MandateModel.is_revoked == False,
          (MandateModel.max_cumulative_amount - MandateModel.current_spent - MandateModel.reserved_amount) >= amount
      )
      .values(reserved_amount=MandateModel.reserved_amount + amount)
  )
  ```

---

### MG-GAP-04: Insecure Fallback Secrets in Production Config (Rule 2 Violation)
- **File**: `backend/app/core/config.py:24-27`
- **Pattern**:
  ```python
  AUTHORIZER_PRIVATE_KEY: str = Field(
      default="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
  )
  ```
- **Analysis**: Anvil Account #1 private key is hardcoded as default. If `ENVIRONMENT=production` is deployed without explicitly providing a key, the backend signs production verdicts using a publicly known Anvil test key.
- **Remediation**: Add a `@model_validator` in `Settings` that raises `RuntimeError` if `ENVIRONMENT == "production"` and `AUTHORIZER_PRIVATE_KEY` equals the Anvil default or `AWS_KMS_KEY_ID` is missing when `SIGNER_TYPE == "kms"`.

---

### MG-GAP-05: Unverified Payment Settlement (Rule 7 & 14 Violation)
- **File**: `backend/app/services/authorization_service.py:279-298`
- **Pattern**:
  ```python
  async def settle_payment(self, auth_id: str, tx_hash: str) -> bool:
      req = await self.request_repo.get_by_authorization_id(auth_id)
      await self.request_repo.mark_settled(auth_id, tx_hash)
      await self.mandate_repo.settle_budget(req.mandate_id, req.amount)
  ```
- **Analysis**: The service updates the database budget and marks the payment `SETTLED` without validating whether `tx_hash` exists on the blockchain, whether the receipt succeeded (`status == 1`), or whether the `PaymentExecuted` event log was emitted.
- **Remediation**: Integrate Web3 transaction receipt inspection:
  1. Fetch `eth_getTransactionReceipt(tx_hash)`.
  2. Verify `receipt.status == 1`.
  3. Verify contract address matches `req.account`.
  4. Parse event logs to confirm `PaymentExecuted(mandateId, authId, recipient, token, amount)` matches the stored authorization.
  5. Reject settlement if verification fails.

---

### MG-GAP-06: Frontend Lacks On-Chain Mandate Operations
- **File**: `frontend/lib/contracts.ts` & `frontend/app/page.tsx`
- **Analysis**: The frontend only persists mandates to the backend database. It never prompts the user's wallet to execute `registerMandate` on `MandateGuardAccount`. Similarly, mandate revocation only flips a database boolean without revoking on-chain.
- **Remediation**: Add `registerMandate` and `revokeMandate` to `SMART_ACCOUNT_ABI`. Add interactive wallet transaction buttons in the UI for registering and revoking mandates directly on-chain.

---

### MG-GAP-07: Missing Correlation IDs & Rate Limiting (Section 8 Violation)
- **File**: `backend/app/main.py`
- **Analysis**: HTTP requests lack `X-Request-ID` correlation middleware and rate limiting. In an automated AI agent payment platform, high-frequency bot calls can overwhelm the signing service or exhaust database connections.
- **Remediation**: Add correlation ID middleware and rate-limiting middleware (`slowapi` or token bucket).

---

### MG-GAP-08: Test Suite Coupling to External Processes
- **File**: `backend/tests/test_sdk.py`
- **Analysis**: `test_sdk.py` hardcodes `http://127.0.0.1:8000` and attempts network connections during standard `pytest` runs, failing if an external server is not listening.
- **Remediation**: Mark end-to-end network tests with `@pytest.mark.integration` and provide ASGI transport fixtures for offline unit test execution.

---

## 4. Remediation Roadmap

1. **Phase 1**: Harden `MandateGuardAccount.sol` by requiring on-chain mandate registration (`MandateNotRegistered`) and verify all 25 contract tests.
2. **Phase 2**: Harden `MandateRepository` with atomic SQL queries for budget reservations, avoiding concurrency overspending.
3. **Phase 3**: Harden backend startup configuration with fail-closed production checks, add correlation IDs, and fix test fixtures.
4. **Phase 4**: Implement blockchain receipt and event log verification in `AuthorizationService.settle_payment`.
5. **Phase 5**: Update frontend UI to eliminate fake tx hashes, add on-chain mandate registration/revocation wallet prompts, and test against Base Sepolia.
