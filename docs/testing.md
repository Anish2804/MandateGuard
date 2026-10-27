# Testing Strategy & Verification Report

## 1. Multi-Tier Testing Pyramid

MandateGuard implements three distinct, rigorous testing tiers:
1. **Smart Contract Unit, Fuzz, and Adversarial Tests (Foundry)**
2. **Backend Engine, Signer Math, and Concurrency Tests (pytest)**
3. **End-to-End Live Chain Integration Tests (Python / Web3.py / Anvil)**

---

## 2. Smart Contract Tests (`contracts/test/MandateGuardAccount.t.sol`)

### Execution Command
```bash
cd contracts && forge test -vvv
```

### Test Results
```
Ran 16 tests for test/MandateGuardAccount.t.sol:MandateGuardAccountTest
[PASS] testFuzz_ValidAmountsWithinLimit(uint32) (runs: 256, μ: 196890, ~: 196893)
[PASS] test_OwnerEmergencyWithdrawToken() (gas: 77120)
[PASS] test_RevertWhen_AmountAlteredAfterSigning() (gas: 93210)
[PASS] test_RevertWhen_AmountExceedsTxLimit() (gas: 79904)
[PASS] test_RevertWhen_AuthorizationReplayed() (gas: 202761)
[PASS] test_RevertWhen_CumulativeLimitExceeded() (gas: 459213)
[PASS] test_RevertWhen_DenyVerdictSubmitted() (gas: 62552)
[PASS] test_RevertWhen_MandateRevoked() (gas: 103781)
[PASS] test_RevertWhen_NonOwnerCallsAdminFunctions() (gas: 120072)
[PASS] test_RevertWhen_RecipientAlteredAfterSigning() (gas: 79588)
[PASS] test_RevertWhen_SignedByUnauthorizedKey() (gas: 98094)
[PASS] test_RevertWhen_TokenMismatch() (gas: 78396)
[PASS] test_RevertWhen_VerdictExpired() (gas: 63575)
[PASS] test_RevertWhen_WrongAccountSpecified() (gas: 63424)
[PASS] test_RevertWhen_WrongChainId() (gas: 63245)
[PASS] test_ValidAllowVerdictSucceeds() (gas: 240523)
Suite result: ok. 16 passed; 0 failed; 0 skipped
```

---

## 3. Backend Authorization Tests (`backend/tests/`)

### Execution Command
```bash
cd backend && pytest -v
```

### Test Results
```
tests/test_api.py::test_api_health_endpoint PASSED                       [  9%]
tests/test_api.py::test_api_mandate_lifecycle_and_authorization PASSED   [ 18%]
tests/test_authorization_service.py::test_authorization_allowed_for_valid_request PASSED [ 27%]
tests/test_authorization_service.py::test_authorization_denied_when_mandate_not_found PASSED [ 36%]
tests/test_authorization_service.py::test_authorization_denied_for_revoked_mandate PASSED [ 45%]
tests/test_authorization_service.py::test_authorization_denied_for_unapproved_recipient PASSED [ 54%]
tests/test_authorization_service.py::test_authorization_denied_when_exceeding_per_tx_limit PASSED [ 63%]
tests/test_authorization_service.py::test_cumulative_spending_cap_enforcement PASSED [ 72%]
tests/test_authorization_service.py::test_idempotency_returns_identical_verdict PASSED [ 81%]
tests/test_signer.py::test_signature_and_recovery_consistency PASSED     [ 90%]
tests/test_signer.py::test_recovery_fails_if_any_parameter_is_tampered PASSED [100%]

============================= 11 passed in 5.13s ==============================
```

---

## 4. End-to-End Live Chain Integration Test (`scripts/test_e2e.py`)

### Execution Command
```bash
python scripts/test_e2e.py
```

### Verification Flow
1. **Live Connection**: Connected to local Anvil node (Chain ID: 31337).
2. **Mandate Creation**: Registered mandate policy on-chain and off-chain.
3. **Authorization Evaluation**: Simulated AI agent requested $35.00 USDC payment -> Issued signed EIP-712 ALLOW verdict.
4. **On-Chain Execution**: Submitted verdict to `MandateGuardAccount.executePayment(...)` -> Mined on Anvil.
5. **Verified Balances**: Merchant balance increased by $35.00 USDC; Smart account custody decreased by $35.00 USDC.
6. **Settlement**: Mined tx hash settled with backend authorization engine.
7. **Adversarial Verification**:
   - Replaying the authorization was rejected on-chain (`AuthorizationAlreadyUsed`).
   - Tampered destination address was rejected on-chain (Signature verification failed).
   - $60.00 USDC request was denied by policy engine (Per-tx limit exceeded).
   - Revoked mandate requests were rejected.
