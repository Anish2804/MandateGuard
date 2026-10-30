# Deployment Guide: Local Anvil & Base Sepolia

MandateGuard supports deterministic local development via Anvil (default) and public testnet verification on Base Sepolia.

---

## 1. Local Anvil Deployment (Default)

### Step 1: Start Anvil
```bash
anvil --chain-id 31337 --port 8545
```

### Step 2: Run Deployment Script
From `contracts/`:
```bash
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

### Output Contracts
- MockUSDC: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- Smart Account: `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`
- Deployed Owner: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- Authorizer Signer: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`

---

## 2. Optional: Base Sepolia Deployment

### Prerequisites
1. Base Sepolia RPC URL (e.g. from Alchemy, Infura, or QuickNode).
2. Funded Deployer Wallet Private Key (with Base Sepolia ETH for gas).
3. Authorizer Signer Address (the public address matching `AUTHORIZER_PRIVATE_KEY`).

### Configuration
Set the following environment variables:
```bash
export RPC_URL="https://sepolia.base.org"
export CHAIN_ID=84532
export DEPLOYER_PRIVATE_KEY="0xYourDeployerPrivateKey"
export AUTHORIZER_ADDRESS="0xYourAuthorizerPublicAddress"
export ETHERSCAN_API_KEY="YourBasescanApiKey"
```

### Deploy & Verify on Base Sepolia
```bash
cd contracts
forge script script/Deploy.s.sol \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

### Update Backend & Frontend Configuration
Update `.env` with the newly deployed addresses:
```env
CHAIN_ID=84532
RPC_URL=https://sepolia.base.org
SMART_ACCOUNT_ADDRESS=0x99F586Cc654DBcf073cf9593e8ec4C4037d85936
MOCK_USDC_ADDRESS=0xa25C3a6A13F32Ac8142CDc232164f16311640dF7
FACTORY_ADDRESS=0x3F577D49773Fc45526181534f8E67B8CD806b176
```

---

## 3. Verified Base Sepolia Live Deployment (October 30, 2026)

- **Network:** Base Sepolia (Chain ID `84532`)
- **Deployer / Owner:** `0x9264Ac745C4d55435b483C76b1811bB726E7B77c`
- **Smart Account (`MandateGuardAccount`):** [`0x99F586Cc654DBcf073cf9593e8ec4C4037d85936`](https://sepolia.basescan.org/address/0x99F586Cc654DBcf073cf9593e8ec4C4037d85936)
- **Factory (`MandateGuardFactory`):** [`0x3F577D49773Fc45526181534f8E67B8CD806b176`](https://sepolia.basescan.org/address/0x3F577D49773Fc45526181534f8E67B8CD806b176)
- **MockUSDC Token:** [`0xa25C3a6A13F32Ac8142CDc232164f16311640dF7`](https://sepolia.basescan.org/address/0xa25C3a6A13F32Ac8142CDc232164f16311640dF7)
- **Authorizer Signer:** `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`
- **Sample Seed Mandate ID:** `0x81045690a5a041937002eebf7e54bd85cb48d48d2712836a743e39e9ba85e0b8`
- **Account Initial Balance:** `50,000.00 mUSDC` ($50k funded for testing)
