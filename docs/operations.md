# MandateGuard: Operations Runbook & Incident Response

**Version**: 1.0  
**Classification**: DevSecOps & SRE Operational Guide  

---

## 1. Key Management Lifecycle

### 1.1 Key Generation
- **Development / Local Testing**:
  - Generated via `cast wallet new` or standard Anvil determinism.
  - Stored in `.env` (never committed to version control).
- **Production / KMS**:
  - Provision an asymmetric key pair in AWS KMS:
    ```bash
    aws kms create-key \
      --key-spec ECC_SECG_P256K1 \
      --key-usage SIGN_VERIFY \
      --origin AWS_KMS \
      --description "MandateGuard Production Verdict Signer"
    ```
  - Derive the Ethereum checksum address from the KMS public key.
  - Configure `MandateGuardFactory` and accounts with this authorizer address.

### 1.2 Key Rotation Procedure
1. Provision new KMS key `KMS_KEY_V2`.
2. Compute new Ethereum address `AUTHORIZER_V2`.
3. Account owners or platform admin execute on-chain:
   - Factory: `MandateGuardFactory.setDefaultAuthorizerSigner(AUTHORIZER_V2)`.
   - Accounts: `MandateGuardAccount.setAuthorizerSigner(AUTHORIZER_V2)`.
4. Update backend configuration `AWS_KMS_KEY_ID` to `KMS_KEY_V2`.
5. Verify new verdict signatures with `POST /api/v1/verdicts/verify`.
6. Deprecate `KMS_KEY_V1` after all outstanding verdicts have expired (typically 1 hour).

---

## 2. Emergency Incident Response

### 2.1 Compromise of Authorizer Key
- **Threat**: Attacker obtains authorizer signing key and can forge ALLOW verdicts.
- **Immediate Response Actions**:
  1. **Revoke Signer On-Chain**:
     - Platform admin calls `MandateGuardFactory.setDefaultAuthorizerSigner(EMERGENCY_RESCUE_ADDRESS)`.
     - Account owners call `MandateGuardAccount.setAuthorizerSigner(EMERGENCY_RESCUE_ADDRESS)`.
  2. **Emergency Revoke Active Mandates**:
     - Owners call `MandateGuardAccount.revokeMandate(mandateId)` on-chain.
  3. **Halt Backend Signing**:
     - Stop backend containers immediately:
       ```bash
       docker compose stop backend
       ```
  4. **Emergency Token Recovery**:
     - If funds are at risk, owners call `emergencyWithdrawToken(token, cold_wallet, amount)` to sweep assets to cold storage.

### 2.2 Compromise of AI Agent API Key
- **Immediate Response**:
  - Call `DELETE /api/v1/auth/api-keys/{key_id}`.
  - The API key hash is instantly marked `is_active = false` in the database, rejecting all subsequent requests with HTTP 401.

---

## 3. Monitoring & Health Checks

- **Health Endpoint**: `GET /health` returns status of database, chain connectivity, and authorizer address.
- **Audit Logs**: Query `GET /api/v1/audit-events` to inspect chronological audit records of verdict generation and settlements.
- **Log Correlation**: Every request includes `X-Request-ID` in HTTP headers and structured application logs.
