# System Limitations & Production Gap Analysis

> **Disclaimer**: MandateGuard is a learning and portfolio prototype demonstrating cryptographic AI agent containment and smart account security. It is NOT audited for production funds.

---

## 1. Prototype Scope vs. Production System

| Dimension | MandateGuard Prototype | Production Hardened Target |
| :--- | :--- | :--- |
| **Signer Architecture** | Single EIP-712 ECDSA private key held in backend env. | Multi-party computation (MPC) threshold cluster (e.g., 3-of-5), AWS KMS / Google Cloud HSM, or SGX/TDX Trusted Execution Environment. |
| **Account Model** | Standalone smart contract account with owner and authorizer controls. | ERC-4337 Account Abstraction with Paymaster gas sponsorship, modular plugins (ERC-6900), and social recovery. |
| **Cumulative Limits** | Concurrency-controlled reservations in relational database. | Hybrid on-chain epoch buckets (e.g., rolling 24-hour limits on-chain) plus off-chain rate-limiting. |
| **Revocation Propagation** | Dual-track: Immediate off-chain API revocation + on-chain `revokeMandate()` transaction by owner. | Instant decentralized revocation via state-proof or peer-to-peer p2p validator synchronization. |
| **Oracle Independence** | The backend authorizer acts as the trusted authority. If the backend key leaks, it can forge verdicts up to on-chain registered limits. | Decentralized consensus or zk-STARK proof of human policy compliance. |

---

## 2. Known Operational Limitations

1. **Local Anvil Reset**:
   When Anvil restarts, on-chain contract state and nonces reset. The backend SQLite database should be cleared or re-migrated to match fresh local chain state.
2. **Clock Discrepancy**:
   Anvil block timestamps track real-time unless manipulated with `evm_increaseTime`. Verdicts must be executed before `verdict.expiry` (default 1 hour).
3. **Integer Precision**:
   All monetary values represent base token units (e.g., Mock USDC uses 6 decimals: `1_000_000` = 1 USDC). Floating point values are strictly forbidden in core accounting calculations.
4. **Single Merchant per Mandate**:
   In the minimal account contract, a mandate binds to a designated recipient address or a zero address (allowing any recipient subject to amount and cumulative limits). Future iterations support dynamic merkle trees of approved merchants.
