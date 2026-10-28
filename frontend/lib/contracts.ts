export const SUPPORTED_CHAINS = {
  84532: {
    id: 84532,
    name: "Base Sepolia",
    rpcUrl: "https://sepolia.base.org",
    currency: "ETH",
    explorer: "https://sepolia.basescan.org",
    factory: "0xc1715490738Ec42fc975B704Cb1542edf46368C9" as `0x${string}`,
    mockUsdc: "0x9CA71737B76EE51d2366C53CC8CdF21DC5246097" as `0x${string}`,
    defaultSmartAccount: "0xB07e049cc3245e8a765bA9bfb537CF5D5fFd4D68" as `0x${string}`,
  },
  31337: {
    id: 31337,
    name: "Local Anvil",
    rpcUrl: "http://127.0.0.1:8545",
    currency: "ETH",
    explorer: "",
    factory: "0x70e0bA845a1A0F2DA3359C97E0285013525FFC49" as `0x${string}`,
    mockUsdc: "0x5FbDB2315678afecb367f032d93F642f64180aa3" as `0x${string}`,
    defaultSmartAccount: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512" as `0x${string}`,
  },
} as const;

export const DEFAULT_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 84532);

export const FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS ||
  "0xc1715490738Ec42fc975B704Cb1542edf46368C9") as `0x${string}`;

export const MOCK_USDC_ADDRESS = (process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS ||
  "0x9CA71737B76EE51d2366C53CC8CdF21DC5246097") as `0x${string}`;

export const DEFAULT_SMART_ACCOUNT_ADDRESS = (process.env.NEXT_PUBLIC_SMART_ACCOUNT_ADDRESS ||
  "0xB07e049cc3245e8a765bA9bfb537CF5D5fFd4D68") as `0x${string}`;

export function getContractAddresses(chainId: number = DEFAULT_CHAIN_ID) {
  const config =
    SUPPORTED_CHAINS[chainId as keyof typeof SUPPORTED_CHAINS] ||
    SUPPORTED_CHAINS[84532];
  return {
    factory: config.factory,
    usdc: config.mockUsdc,
    defaultAccount: config.defaultSmartAccount,
  };
}

// --- Minimal ABIs ---

export const FACTORY_ABI = [
  {
    type: "function",
    name: "createAccount",
    inputs: [],
    outputs: [{ name: "account", type: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getAccountsByOwner",
    inputs: [{ name: "_owner", type: "address" }],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalAccounts",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "defaultAuthorizerSigner",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "AccountCreated",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "account", type: "address", indexed: true },
      { name: "authorizerSigner", type: "address", indexed: true },
      { name: "accountIndex", type: "uint256", indexed: false },
      { name: "salt", type: "bytes32", indexed: false },
    ],
  },
] as const;

export const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "pure",
  },
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

export const SMART_ACCOUNT_ABI = [
  {
    type: "function",
    name: "executePayment",
    inputs: [
      {
        name: "verdict",
        type: "tuple",
        components: [
          { name: "verdict", type: "uint8" },
          { name: "chainId", type: "uint256" },
          { name: "account", type: "address" },
          { name: "token", type: "address" },
          { name: "recipient", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "mandateId", type: "bytes32" },
          { name: "authorizationId", type: "bytes32" },
          { name: "expiry", type: "uint256" },
          { name: "mandateVersion", type: "uint256" },
        ],
      },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "authorizerSigner",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "usedAuthorizations",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "registerMandate",
    inputs: [
      { name: "mandateId", type: "bytes32" },
      { name: "agent", type: "address" },
      { name: "token", type: "address" },
      { name: "recipient", type: "address" },
      { name: "maxAmountPerTx", type: "uint256" },
      { name: "maxCumulativeAmount", type: "uint256" },
      { name: "startTime", type: "uint256" },
      { name: "expiry", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "revokeMandate",
    inputs: [{ name: "mandateId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "emergencyWithdrawToken",
    inputs: [
      { name: "token", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setAuthorizerSigner",
    inputs: [{ name: "newSigner", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transferOwnership",
    inputs: [{ name: "newOwner", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;
