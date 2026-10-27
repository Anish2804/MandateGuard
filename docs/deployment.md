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
SMART_ACCOUNT_ADDRESS=0xDeployedSmartAccountOnBaseSepolia
MOCK_USDC_ADDRESS=0xDeployedMockUSDCOnBaseSepolia
```
