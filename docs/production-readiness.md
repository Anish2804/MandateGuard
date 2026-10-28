# MandateGuard: Production Readiness & Deployment Checklist

**Version**: 1.0  
**Classification**: Operational Readiness Review  

---

## 1. Production Readiness Scorecard

| Domain | Status | Gap / Requirement for Production |
| :--- | :--- | :--- |
| **Smart Contracts** | **Production-Hardened** | Full Foundry test suite (100% passing), fuzzing (256 runs), on-chain mandate registration enforced, replay defense, EIP-712 domain separation. Requires independent external audit before mainnet deployment. |
| **Key Management (HSM/KMS)** | **Staging-Ready** | AWS KMS integration abstraction implemented in `app/core/signer.py`. Local private key used for Anvil/Base Sepolia testnet. Production requires AWS KMS Key ARN with CloudTrail audit logging. |
| **Concurrency Control** | **Production-Hardened** | Atomic conditional SQL queries prevent TOCTOU overspending across multi-instance backend containers. |
| **Blockchain Reconciliation** | **Production-Hardened** | On-chain transaction receipt & event log verification implemented in `settle_payment`. Reverted or missing transactions cannot settle. |
| **Backend API Security** | **Production-Hardened** | Request correlation IDs (`X-Request-ID`), rate limiting, structured logging, hashed API key authentication (`X-API-Key`). |
| **Database & Migrations** | **Staging-Ready** | SQLite used for local dev/testing; async PostgreSQL supported via SQLAlchemy connection string (`DATABASE_URL`). Production requires PostgreSQL with connection pooling. |
| **Frontend Integration** | **Production-Hardened** | Real Web3 wallet submission (`viem`), zero fake transaction hashes, network switching, and dynamic smart account binding. |

---

## 2. Hard Requirements Before Mainnet Launch

### 1. Independent External Security Audit
- Contract audit by an independent blockchain security firm (e.g., Trail of Bits, OpenZeppelin, Consensys Diligence, or Spearbit).
- Formal verification of smart account invariant: `Token outflow <= Cumulative spending limit`.

### 2. AWS KMS / HSM Key Management
- For production, migrate verdict signing key to an AWS KMS ECC_SECG_P256K1 asymmetric key.
- Set `SIGNER_TYPE=kms` and `AWS_KMS_KEY_ID=arn:aws:kms:...`.
- Enforce IAM policy with least privilege: only the authorization backend worker can call `kms:Sign`.
- Enable AWS CloudTrail to log every invocation of the signing key.

### 3. High-Availability PostgreSQL Database
- Replace local SQLite (`mandateguard.db`) with managed PostgreSQL (e.g., AWS RDS PostgreSQL or Google Cloud SQL).
- Use Alembic migrations for versioned, reproducible schema updates.
- Enable automatic daily backups and Point-In-Time Recovery (PITR).

### 4. Resilient RPC Infrastructure
- Configure dedicated, rate-limit-exempt RPC endpoints (e.g., Alchemy, Infura, QuickNode, or self-hosted RPC nodes) with automated fallback.
- Enforce confirmation thresholds (e.g., 2+ blocks on Base / Arbitrum / Ethereum).

### 5. Monitoring & Alerting
- Sentry or Datadog integration for backend exception monitoring.
- Alerting on:
  - Spike in DENIED verdicts (potential brute-force or bot misconfiguration).
  - Failed settlement receipt verifications.
  - KMS signing latency (> 200ms) or throttling errors.
  - Low ETH balance in owner or gas relayer accounts.
