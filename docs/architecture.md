# MandateGuard System Architecture

## 1. Introduction

MandateGuard solves the problem of autonomous AI agent fiscal containment. Rather than granting autonomous agents direct private key access to treasury or hot-wallet funds, MandateGuard introduces a dual-verification workflow:
1. **Off-Chain Semantic & Cumulative Policy Verification**: Handled by an authorization engine maintaining human spending mandates and reservation-based spending caps.
2. **On-Chain Cryptographic & Invariant Verification**: Handled by a guarded smart account holding token custody and executing payments only against valid EIP-712 authorizations.

---

## 2. Component Workflow Diagram

```
+----------------+          +-------------------------+          +-------------------------+
| AI Agent / Sim |          | Authorization Service   |          | Smart Account (On-Chain)|
+-------+--------+          +------------+------------+          +------------+------------+
        |                                |                                    |
        | 1. POST /api/v1/authorize      |                                    |
        | (recipient, amount, mandateId) |                                    |
        |------------------------------->|                                    |
        |                                | 2. Query Mandate Policy            |
        |                                | 3. Acquire Row-Lock on Spent Limit |
        |                                | 4. Check per-tx limit & cumulative |
        |                                | 5. If valid, sign EIP-712 verdict  |
        | 6. Returns Signed ALLOW Verdict|                                    |
        |<-------------------------------|                                    |
        |                                                                     |
        | 7. executePayment(verdict, signature)                               |
        |-------------------------------------------------------------------->|
        |                                                                     | 8. Verify EIP-712
        |                                                                     | 9. Check !used[authId]
        |                                                                     | 10. Check !revoked
        |                                                                     | 11. SafeERC20.transfer
        |                                                                     | 12. Emit PaymentExecuted
        |                                13. Settle Reservation               |
        |                                    (or periodic sync)               |
        |                                <------------------------------------|
```

---

## 3. Data Flow & State Lifecycle

### Payment Reservation & Settlement Lifecycle
```
[ Payment Requested ]
         |
         v
[ Authorization Evaluation ]
   |                  |
   | (Violates limit) | (Satisfies mandate policy)
   v                  v
[ DENIED ]      [ ALLOWED: Funds Reserved in DB ]
                      |
                      v
             [ Submitted On-Chain ]
               |               |
               | (Reverted)    | (Mined successfully)
               v               v
          [ RELEASED ]    [ SETTLED: Cumulative spent updated ]
```

1. **Reservation**: When an authorization is granted, the backend creates a `RESERVED` spend record. This prevents concurrent requests from double-spending the cumulative budget before transactions confirm on-chain.
2. **Settlement**: Upon confirmed on-chain execution with a valid transaction hash, the status advances to `SETTLED`.
3. **Expiration / Release**: If an authorization is not mined before `verdict.expiry`, the reserved amount is released back to the available budget.

---

## 4. Key Security Invariants

1. **No Direct Spending**: An agent NEVER has signing authority over the smart account or its tokens.
2. **No Secret Exposure**: The human owner and the authorizer service operate separate keys.
3. **Strict Parameter Equality**: The on-chain contract enforces exact equality between the signed fields and the token transfer arguments.
4. **Replay Impossibility**: Every authorization ID can only transition from unused to used once.
5. **No Execution of DENY Verdicts**: If the authorization service issues a DENY verdict (e.g. for auditable logging), its verdict value is 0, which the smart contract rejects unconditionally.
