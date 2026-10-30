# MandateGuard — Session Keys & Granular Spending Limits Specification

## Overview (Requirement 8)

In autonomous AI-agent workflows, an AI agent must not hold the master private key of an enterprise treasury or user account. While MandateGuard's primary enforcement layer relies on **human-approved mandates and signed verdicts**, **Session Keys** provide a defense-in-depth mechanism to restrict the agent's broad transaction capabilities at the account layer.

This document specifies the architectural model, permission boundaries, and roadmap for session-key enforcement within MandateGuard.

---

## 1. Threat Model Addressed by Session Keys

Without session keys, an agent might:
1. **Drain Gas**: Broadcast thousands of failing transactions or gas-guzzling operations, draining native ETH/gas tokens.
2. **Interact with Unintended Contracts**: Attempt to call external protocols, DEXes, or flash loan pools using the account's authority.
3. **Execute Outside Time Windows**: Submit delayed transactions outside of the agent's scheduled operating window.

---

## 2. Session Key Permission Tuple

A production-grade Session Key in MandateGuard is defined by the following cryptographic and policy tuple:

```solidity
struct SessionKeyPolicy {
    address sessionSigner;        // Ephemeral agent key
    uint48 validAfter;            // Start timestamp
    uint48 validUntil;            // Expiry timestamp
    address targetAccount;        // User's MandateGuardAccount
    bytes4 allowedSelector;       // Restricted to executePayment (0x3e18a992)
    address token;                // Restricted token address (e.g. USDC)
    uint256 maxCumulativeGasWei;  // Gas consumption limit
    bool isRevoked;               // Immediate revocation flag
}
```

### Key Security Invariants
1. **Target Whitelist**: The session key is strictly unauthorized to call `emergencyWithdrawToken`, `setAuthorizerSigner`, `pause`, `unpause`, or any administrative function.
2. **Function Locking**: The session key can ONLY invoke `executePayment(...)`.
3. **Verdict Requirement Preserved**: Possessing a valid session key does **NOT** grant authority to move tokens. The session key merely authorizes the agent to *deliver* the transaction. The smart account still cryptographically verifies the independent **Authorizer Verdict**.

---

## 3. Account Abstraction (ERC-4337 / ERC-7579) Compatibility

MandateGuard can be deployed as an execution module or validator under standard account abstraction frameworks:

### Option A: ERC-7579 Execution Validator Module
- Implement `IERC7579Module` on `MandateGuardAccount`.
- The human owner installs MandateGuard as an execution hook on their Biconomy, ZeroDev, or Safe smart account.
- When `executeFromExecutor` or `executeUserOp` runs, the pre-check validates both:
  1. The UserOp signature from the agent's Session Key.
  2. The EIP-712 `PaymentVerdict` signature from MandateGuard's authorizer service.

### Option B: Biconomy Session Validation Module (SVM)
- Leverages Biconomy's audited `ERC20SessionValidationModule`.
- Encodes session rules: `token = USDC`, `recipient = approvedMerchant`, `maxAmount = mandateLimit`.

---

## 4. Current Implementation Status vs. Production Roadmap

| Feature | Current Status in Repo | Production Requirement |
|---|---|---|
| **Agent Key Separation** | ✅ Implemented & Tested | Agent holds distinct key; cannot call admin functions |
| **Spending Caps & Expiry** | ✅ Implemented & Invariant-Tested | Onchain cumulative & per-tx limits enforced |
| **EIP-712 Verdict Binding** | ✅ Implemented & Invariant-Tested | Chain ID, contract, token, recipient, amount bound |
| **Native UserOp Validation** | 🟡 Design Specification (ERC-4337) | Requires full EntryPoint v0.7 integration |
| **Session Key Ephemeral Storage** | 🟡 Documented Adapter (Turnkey/Privy) | Enclave-backed session key generation |

---

## 5. Implementation Roadmap for Full Session-Key Deployment
1. Import `@zerodev/permissions` or Biconomy SDK into frontend client.
2. Enable 1-click ephemeral session key generation in browser local storage or WebAuthn.
3. Register the session key via a signed owner transaction in `MandateGuardAccount.registerSessionKey(address key, uint48 validUntil)`.
4. Validate `msg.sender == owner || sessionKeys[msg.sender].validUntil >= block.timestamp` in `executePayment`.
