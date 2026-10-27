# EIP-712 Signed Verdict Specification

## 1. Design Rationale

MandateGuard uses **EIP-712 Typed Structured Data Hashing and Signing** for payment authorizations. This ensures:
- Full cryptographic binding between every payment parameter (token, amount, recipient, account, mandate, expiry, nonce).
- Human readability in modern wallet prompts (if inspected in MetaMask, Rainbow, or Ledger).
- Hardware security module (HSM) compatibility.
- Resistance against cross-contract and cross-chain replay attacks.

---

## 2. EIP-712 Domain Separator

```json
{
  "name": "MandateGuard",
  "version": "1",
  "chainId": 31337,
  "verifyingContract": "0xSmartAccountAddress..."
}
```

### Solidity Domain Separator Definition
```solidity
bytes32 public constant DOMAIN_TYPEHASH = keccak256(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
);
```

---

## 3. PaymentVerdict Schema

### EIP-712 Type Definition
```
PaymentVerdict(
    uint8 verdict,
    uint256 chainId,
    address account,
    address token,
    address recipient,
    uint256 amount,
    bytes32 mandateId,
    bytes32 authorizationId,
    uint256 expiry,
    uint256 mandateVersion
)
```

### TypeHash in Solidity
```solidity
bytes32 public constant PAYMENT_VERDICT_TYPEHASH = keccak256(
    "PaymentVerdict(uint8 verdict,uint256 chainId,address account,address token,address recipient,uint256 amount,bytes32 mandateId,bytes32 authorizationId,uint256 expiry,uint256 mandateVersion)"
);
```

---

## 4. Field Descriptions

| Field | Type | Description |
| :--- | :--- | :--- |
| `verdict` | `uint8` | `0 = DENY`, `1 = ALLOW`. Smart contract strictly checks `verdict == 1`. |
| `chainId` | `uint256` | Target EVM chain ID (e.g., `31337` for local Anvil, `84532` for Base Sepolia). |
| `account` | `address` | The smart account that will execute the payment and hold funds. |
| `token` | `address` | Address of the ERC-20 token contract (e.g., Mock USDC). |
| `recipient` | `address` | The only address permitted to receive the token transfer. |
| `amount` | `uint256` | Exact transfer amount in base token units (e.g., 6 decimals for USDC). |
| `mandateId` | `bytes32` | Unique identifier of the human-approved spending mandate. |
| `authorizationId` | `bytes32` | Unique single-use nonce/identifier for replay defense (`usedAuthorizations`). |
| `expiry` | `uint256` | Unix timestamp in seconds after which the verdict is expired. |
| `mandateVersion` | `uint256` | Monotonically increasing version number for the mandate policy. |

---

## 5. Verification Invariants

1. **Signer Recovery**:
   ```solidity
   bytes32 digest = keccak256(
       abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash)
   );
   address recoveredSigner = ECDSA.recover(digest, signature);
   require(recoveredSigner == authorizerSigner, "InvalidSigner");
   ```

2. **Binding Checks**:
   - `verdict == 1` (ALLOW)
   - `block.chainid == verdict.chainId`
   - `address(this) == verdict.account`
   - `block.timestamp <= verdict.expiry`
   - `!usedAuthorizations[verdict.authorizationId]`
   - `!mandates[verdict.mandateId].revoked`

Any modification to any field by an agent or man-in-the-middle causes `recoveredSigner != authorizerSigner`, terminating execution before any token moves.
