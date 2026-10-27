# MandateGuard Security Policy & Security Architecture

## 1. Security Philosophy: Defense in Depth

MandateGuard is designed on the principle that **off-chain intelligence (AI agents) cannot be trusted with direct custody or unconditional spending keys**. Even if an LLM is hijacked, hallucinating, or poisoned, funds cannot leave the guarded smart account unless:
1. The request complies with a human-approved on-chain spending mandate.
2. The authorization service verifies cumulative spending caps and signs an EIP-712 structured verdict.
3. The smart account cryptographically verifies the typed data hash, nonces, timestamps, and recipient bindings on-chain.

---

## 2. Cryptographic Bindings Enforced On-Chain

The smart account (`MandateGuardAccount.sol`) mathematically prevents the following attacks:

| Attack Vector | Solidity Defense Mechanism |
| :--- | :--- |
| **Recipient Tampering** | `verdict.recipient` is bound inside `PAYMENT_VERDICT_TYPEHASH`. Any address change causes `ecrecover` to fail. |
| **Amount Tampering** | `verdict.amount` is bound inside the struct hash. Altering the amount breaks the signature. |
| **Replay Attacks** | `usedAuthorizations[authorizationId] = true` marks nonces as used immediately before token transfer. Replayed verdicts revert with `AuthorizationAlreadyUsed`. |
| **Cross-Account / Cross-Chain Replay** | `domainSeparator` explicitly incorporates `block.chainid` and `verifyingContract` (the smart account address). |
| **Verdict Alteration (DENY -> ALLOW)** | The contract strictly enforces `verdict.verdict == 1` (ALLOW). A DENY verdict (0) reverts with `DenyVerdictNotExecutable`. |
| **Expired Approvals** | Requires `block.timestamp <= verdict.expiry`. Expired authorizations cannot be submitted. |
| **Revoked Policies** | On-chain registry checks `!mandates[mandateId].revoked`. Revocation halts all future transfers on-chain regardless of off-chain signatures. |
| **Per-Transaction Overspending** | Contract checks `verdict.amount <= mandate.maxAmountPerTx`. |
| **Cumulative Overspending** | Contract checks `mandate.cumulativeSpent + verdict.amount <= mandate.maxCumulativeAmount`. |
| **Direct Fund Drain / Bypass** | Smart account exposes no arbitrary `call`, `delegatecall`, or unprotected transfer functions. |

---

## 3. Reporting Vulnerabilities

If you discover a security vulnerability in MandateGuard, please do NOT file a public issue. Contact the repository security team privately.
