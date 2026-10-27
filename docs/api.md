# MandateGuard REST API Specification

The Authorization Service exposes RESTful endpoints for mandate creation, payment authorization, verdict verification, and audit event logging.

Base URL: `http://localhost:8000`

---

## Endpoints Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Service, database, and signer health check |
| `POST` | `/api/v1/mandates` | Create and store a new spending mandate |
| `GET` | `/api/v1/mandates` | List all mandates with current spending stats |
| `GET` | `/api/v1/mandates/{mandate_id}` | Retrieve specific mandate by ID |
| `POST` | `/api/v1/mandates/{mandate_id}/revoke` | Revoke a mandate off-chain |
| `POST` | `/api/v1/authorize` | Evaluate payment request and generate signed verdict |
| `GET` | `/api/v1/requests` | List payment authorization requests |
| `GET` | `/api/v1/requests/{request_id}` | Retrieve payment request and verdict details |
| `POST` | `/api/v1/verdicts/verify` | Verify an EIP-712 signed verdict off-chain |
| `POST` | `/api/v1/settle` | Settle an executed on-chain payment with tx hash |
| `GET` | `/api/v1/audit-events` | Retrieve system audit event trail |

---

## 1. Health Check
`GET /health`

**Response `200 OK`**:
```json
{
  "status": "healthy",
  "database": "connected",
  "signer": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "chainId": 31337,
  "timestamp": "2026-10-27T14:45:00Z"
}
```

---

## 2. Create Mandate
`POST /api/v1/mandates`

**Request Body**:
```json
{
  "title": "Cloud Compute & SaaS Budget",
  "account": "0xSmartAccountAddress...",
  "agent": "0xAgentAddress...",
  "token": "0xMockUSDCAddress...",
  "recipient": "0xMerchantAddress...",
  "max_amount_per_tx": 50000000,
  "max_cumulative_amount": 500000000,
  "chain_id": 31337,
  "expiry": 1893456000
}
```

**Response `201 Created`**:
```json
{
  "mandate_id": "0x1234...bytes32",
  "title": "Cloud Compute & SaaS Budget",
  "status": "ACTIVE",
  "current_spent": 0,
  "reserved_amount": 0,
  "created_at": "2026-10-27T14:45:00Z"
}
```

---

## 3. Authorize Payment Request
`POST /api/v1/authorize`

**Request Body**:
```json
{
  "mandate_id": "0x1234...bytes32",
  "account": "0xSmartAccountAddress...",
  "token": "0xMockUSDCAddress...",
  "recipient": "0xMerchantAddress...",
  "amount": 25000000,
  "chain_id": 31337,
  "idempotency_key": "req-uuid-001"
}
```

**Response `200 OK` (ALLOW)**:
```json
{
  "verdict": 1,
  "verdict_label": "ALLOW",
  "authorization_id": "0x9876...bytes32",
  "mandate_id": "0x1234...bytes32",
  "account": "0xSmartAccountAddress...",
  "token": "0xMockUSDCAddress...",
  "recipient": "0xMerchantAddress...",
  "amount": 25000000,
  "chain_id": 31337,
  "expiry": 1793145600,
  "mandate_version": 1,
  "signature": "0xabcd...65bytes",
  "reason": "Payment complies with mandate policy"
}
```

**Response `200 OK` (DENY)**:
```json
{
  "verdict": 0,
  "verdict_label": "DENY",
  "authorization_id": "0x0000...bytes32",
  "mandate_id": "0x1234...bytes32",
  "signature": null,
  "reason": "Requested amount 60000000 exceeds max_amount_per_tx 50000000"
}
```
