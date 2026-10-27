# Threat Model & Security Architecture

## 1. System Overview

MandateGuard operates as a defense-in-depth gatekeeper for AI agent payments. The core premise is that **an AI agent cannot be trusted with autonomous direct spending authority**. If an agent's prompt, memory, or context is poisoned, or if an agent hallucinates a transaction, the underlying funds must remain strictly protected.

## 2. Trust Boundaries

```
[ Untrusted / Semi-Trusted ]             [ Trusted Off-Chain ]               [ Trustless On-Chain ]
+-------------------------+              +-----------------------+           +----------------------+
| AI Agent Simulator      |              | MandateGuard Service  |           | Guarded Smart        |
| - Can formulate requests|  HTTP POST   | - Policy engine       |  EIP-712  | Account (Solidity)   |
| - Can be compromised    | -----------> | - Reservation manager | --------> | - Signature check    |
| - Can tamper with data  |              | - EIP-712 Signer      |           | - Replay defense     |
+-------------------------+              +-----------------------+           | - Revocation check   |
                                                                             | - SafeERC20 transfer |
                                                                             +----------------------+
```

1. **AI Agent Simulator (Untrusted / Adversarial)**:
   - Capable of sending arbitrary, malformed, or malicious payment payloads.
   - May attempt:
     - Requesting higher amounts than allowed.
     - Changing the recipient address to an attacker's wallet.
     - Submitting stale or expired requests.
     - Replaying previously successful authorizations.
     - Altering signed parameters prior to on-chain execution.

2. **Backend Authorization Service (Trusted Off-Chain Component)**:
   - Holds the `AUTHORIZER_PRIVATE_KEY`.
   - Evaluates business rules and cumulative period spending.
   - Issues EIP-712 typed-data signatures.
   - *Security Assumption*: The backend service runs in an isolated, secure environment. If the authorizer private key is compromised, an attacker could sign verdicts, but they are still constrained by on-chain mandate registration and transaction limits.

3. **Guarded Smart Account (Trustless On-Chain Final Verifier)**:
   - Holds token custody (e.g., Mock USDC).
   - Verifies cryptographic validity, nonces, timestamps, and on-chain mandate parameters.
   - Transfers tokens ONLY upon satisfying all checks.
   - Does NOT expose arbitrary external execution paths (`delegatecall`, unconstrained `call`).

## 3. Threat Vectors & Mitigations

| Threat | Attack Scenario | Mitigation |
| :--- | :--- | :--- |
| **Tampered Recipient** | Agent requests payment to Alice, gets authorization, but submits tx directing funds to Eve. | The EIP-712 payload cryptographically binds `recipient`. Any alteration causes ECDSA signer recovery to yield an invalid address, reverting on-chain. |
| **Tampered Amount** | Agent gets approval for $10 USDC, but submits tx claiming $1000 USDC. | `amount` is bound into the EIP-712 typed-data hash and checked against on-chain mandate limits. Altering the amount invalidates the signature. |
| **Replay Attack** | Agent re-submits a previously executed signed verdict to drain funds again. | Each verdict contains a unique `authorizationId` (UUID/hash). The smart account records `usedAuthorizations[authId] = true` and reverts if called again. |
| **Expired Verdict** | Agent intercepts an old verdict and executes it weeks later after market conditions change. | Verdict contains `expiry` timestamp. The smart account strictly requires `block.timestamp <= verdict.expiry`. |
| **Cross-Chain / Cross-Account Replay** | Attacker takes a verdict signed for Account A on Base Sepolia and executes it on Account B on Mainnet. | EIP-712 Domain Separator includes `chainId` and `verifyingContract` (the smart account address), plus `account` and `chainId` in the struct fields. |
| **Revoked Mandate** | Human revokes a compromised mandate, but an agent has a pending signed verdict. | Smart account maintains an on-chain mandate registry and revocation mapping. Even with a valid off-chain signature, the smart account checks `!mandates[mandateId].revoked`. |
| **DENY Verdict Abuse** | Attacker takes a signed DENY verdict and attempts to submit it to trigger a transfer. | Contract explicitly requires `verdict.verdict == Verdict.ALLOW (1)`. A DENY verdict (0) reverts immediately. |
| **Concurrent Spending Race Condition** | Agent sends multiple parallel requests to exceed cumulative limit. | Backend uses database row-level locking (`SELECT ... FOR UPDATE`) and reservations to enforce cumulative spending limits atomically. |
| **Direct Fund Drain / Bypass** | Attacker tries calling `transfer` directly on the smart account. | The smart account only exposes `executePayment` (guarded by EIP-712) and owner-scoped administrative functions. No unrestricted external transfer or arbitrary execution functions exist. |

## 4. Residual Risks & Future Production Improvements

1. **Off-Chain Signer Compromise**: In this prototype, a single private key signs verdicts. In production, this should be an MPC threshold network, a HSM, or an off-chain TEE (Trusted Execution Environment).
2. **Cumulative Period Roll-overs**: Cumulative period limits tracked off-chain rely on the authorization service maintaining consistent database state. On-chain period roll-overs can be added via epoch-based storage buckets.
3. **ERC-4337 Full Account Abstraction**: For this prototype, a direct smart contract account is implemented. Adapting to ERC-4337 `validateUserOp` with a Paymaster is a logical roadmap step.
