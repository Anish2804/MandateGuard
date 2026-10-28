# Threat Model & Security Architecture

**Version**: 1.1  
**Classification**: Threat Modeling & Security Analysis  

---

## 1. System Overview

MandateGuard operates as a defense-in-depth gatekeeper for AI agent payments. The core premise is that **an AI agent cannot be trusted with autonomous direct spending authority**. If an agent's prompt, memory, or context is poisoned, or if an agent hallucinates a transaction, the underlying funds must remain strictly protected.

---

## 2. STRIDE Threat Analysis

| Category | Threat Description | Attack Vector | Mitigating Controls | Residual Risk |
| :--- | :--- | :--- | :--- | :--- |
| **Spoofing** | Attacker impersonates an approved AI agent | Stolen API key or forged headers | SHA-256 hashed API keys stored in DB; accounts are locked to specific API keys. | API key leakage permits authorized requests up to the mandate limit. |
| **Tampering** | Recipient, amount, or token altered in flight | MITM alters payload between signer and blockchain | EIP-712 typed-data hash binds all 10 fields into ECDSA digest. Modifying any field invalidates the signature. | None. Cryptographically impossible to tamper without authorizer key. |
| **Repudiation** | Agent denies requesting a payment or owner disputes execution | Unlogged transactions | Immutable on-chain `PaymentExecuted` event log with `mandateId`, `authorizationId`, `recipient`, and `amount`. | Chain reorgs on poorly finalized testnets. |
| **Information Disclosure** | Leakage of private authorizer keys or sensitive policies | Secrets committed to git or exposed via logs | Fail-closed startup checks; KMS/HSM abstraction; authorizer private keys never logged. | Misconfigured environment file on developer workstation. |
| **Denial of Service** | Bot floods `/api/v1/authorize` with concurrent requests | Database connection starvation or budget lock exhaustion | Rate limiting, request timeouts, and atomic conditional SQL queries. | Network-level DDoS requiring Cloudflare / WAF. |
| **Elevation of Privilege** | Attacker bypasses mandate limits to drain smart account | Unregistered mandate ID or calling non-owner functions | Strict smart account check: `mandates[mandateId].isRegistered == true` and `onlyOwner` modifiers on admin methods. | Compromise of owner private key. |

---

## 3. Threat Vectors & Deep Mitigations

| Threat | Attack Scenario | Mitigation |
| :--- | :--- | :--- |
| **Tampered Recipient** | Agent requests payment to Alice, gets authorization, but submits tx directing funds to Eve. | The EIP-712 payload cryptographically binds `recipient`. Any alteration causes ECDSA signer recovery to yield an invalid address, reverting on-chain. |
| **Tampered Amount** | Agent gets approval for $10 USDC, but submits tx claiming $1000 USDC. | `amount` is bound into the EIP-712 typed-data hash and checked against on-chain mandate limits. Altering the amount invalidates the signature. |
| **Replay Attack** | Agent re-submits a previously executed signed verdict to drain funds again. | Each verdict contains a unique `authorizationId` (UUID/hash). The smart account records `usedAuthorizations[authId] = true` and reverts if called again. |
| **Expired Verdict** | Agent intercepts an old verdict and executes it weeks later after market conditions change. | Verdict contains `expiry` timestamp. The smart account strictly requires `block.timestamp <= verdict.expiry`. |
| **Cross-Chain / Cross-Account Replay** | Attacker takes a verdict signed for Account A on Base Sepolia and executes it on Account B on Mainnet. | EIP-712 Domain Separator includes `chainId` and `verifyingContract` (the smart account address), plus `account` and `chainId` in the struct fields. |
| **Revoked Mandate** | Human revokes a compromised mandate, but an agent has a pending signed verdict. | Smart account maintains an on-chain mandate registry and revocation mapping. Even with a valid off-chain signature, the smart account checks `!mandates[mandateId].revoked`. |
| **DENY Verdict Abuse** | Attacker takes a signed DENY verdict and attempts to submit it to trigger a transfer. | Contract explicitly requires `verdict.verdict == Verdict.ALLOW (1)`. A DENY verdict (0) reverts immediately. |
| **Concurrent Spending Race Condition** | Agent sends multiple parallel requests to exceed cumulative limit. | Backend uses atomic conditional SQL updates (`UPDATE ... WHERE remaining_budget >= amount`) to enforce cumulative spending limits atomically. |
| **Direct Fund Drain / Bypass** | Attacker tries calling `transfer` directly on the smart account. | The smart account only exposes `executePayment` (guarded by EIP-712) and owner-scoped administrative functions. No unrestricted external transfer or arbitrary execution functions exist. |
| **Unregistered Mandate Exploitation** | Attacker crafts a verdict with an unregistered mandate to bypass limits. | Smart account requires `mandate.isRegistered == true`. Unregistered mandates revert with `MandateNotRegistered`. |
| **Settlement Fabrication** | Attacker sends a fake transaction hash to `/settle` to manipulate accounting. | Backend queries RPC node via Web3 for `eth_getTransactionReceipt` and parses `PaymentExecuted` event log before settling. |
| **Emergency Withdrawal Abuse** | Compromised non-owner attempts to call `emergencyWithdrawToken`. | Enforced strictly by `onlyOwner` modifier and `nonReentrant`. Emits `EmergencyWithdrawalExecuted`. |

---

## 4. Residual Risks & Production Mitigations

1. **Off-Chain Signer Compromise**: In development, a local private key is used. In production, an AWS KMS ECC_SECG_P256K1 key with CloudTrail audit logging must be used.
2. **Reorganizations & Mempool Drops**: Transactions submitted by agents may be dropped if gas prices surge. The SDK implements receipt polling and retry logic.
3. **Smart Account Upgradeability**: MandateGuard smart accounts are intentionally non-upgradeable to eliminate proxy hijacking and storage collision vulnerabilities. If new functionality is required, a new account instance is deployed via the factory.
