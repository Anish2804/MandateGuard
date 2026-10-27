import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  formatUnits,
  parseUnits,
  type Address,
  type Hash,
} from "viem";
import {
  SUPPORTED_CHAINS,
  DEFAULT_CHAIN_ID,
  FACTORY_ADDRESS,
  FACTORY_ABI,
  MOCK_USDC_ADDRESS,
  ERC20_ABI,
  SMART_ACCOUNT_ABI,
  DEFAULT_SMART_ACCOUNT_ADDRESS,
} from "./contracts";

// Public RPC client for read-only queries
export function getPublicClient(chainId: number = DEFAULT_CHAIN_ID) {
  const chainConfig =
    SUPPORTED_CHAINS[chainId as keyof typeof SUPPORTED_CHAINS] ||
    SUPPORTED_CHAINS[31337];

  return createPublicClient({
    transport: http(chainConfig.rpcUrl),
  });
}

// Check if browser has an injected Ethereum provider (MetaMask, Coinbase Wallet, etc.)
export function hasInjectedProvider(): boolean {
  return typeof window !== "undefined" && typeof (window as any).ethereum !== "undefined";
}

// Request wallet connection and return user's selected address
export async function connectInjectedWallet(): Promise<{
  address: `0x${string}`;
  chainId: number;
}> {
  if (!hasInjectedProvider()) {
    throw new Error(
      "No Web3 wallet found! Please install MetaMask or another Web3 browser extension."
    );
  }

  const ethereum = (window as any).ethereum;
  const accounts: string[] = await ethereum.request({
    method: "eth_requestAccounts",
  });

  if (!accounts || accounts.length === 0) {
    throw new Error("No accounts found. Please unlock your wallet.");
  }

  const chainIdHex: string = await ethereum.request({
    method: "eth_chainId",
  });
  const chainId = parseInt(chainIdHex, 16);

  return {
    address: accounts[0] as `0x${string}`,
    chainId,
  };
}

// Switch wallet network to target chain (e.g. Base Sepolia or Local Anvil)
export async function switchWalletNetwork(targetChainId: number): Promise<void> {
  if (!hasInjectedProvider()) return;
  const ethereum = (window as any).ethereum;
  const chainHex = `0x${targetChainId.toString(16)}`;

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainHex }],
    });
  } catch (switchError: any) {
    // Error 4902 means the chain has not been added to the wallet yet
    if (switchError.code === 4902) {
      const config = SUPPORTED_CHAINS[targetChainId as keyof typeof SUPPORTED_CHAINS];
      if (!config) throw switchError;

      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: chainHex,
            chainName: config.name,
            rpcUrls: [config.rpcUrl],
            nativeCurrency: {
              name: config.currency,
              symbol: config.currency,
              decimals: 18,
            },
            blockExplorerUrls: config.explorer ? [config.explorer] : [],
          },
        ],
      });
    } else {
      throw switchError;
    }
  }
}

// Get all smart accounts owned by a wallet address from MandateGuardFactory
export async function getFactoryAccountsForOwner(
  ownerAddress: `0x${string}`,
  chainId: number = DEFAULT_CHAIN_ID
): Promise<`0x${string}`[]> {
  try {
    const client = getPublicClient(chainId);
    const accounts = (await client.readContract({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: "getAccountsByOwner",
      args: [ownerAddress],
    })) as `0x${string}`[];

    return accounts;
  } catch (err) {
    console.warn("Could not query factory accounts:", err);
    return [];
  }
}

// Deploy a new isolated Smart Account for the connected user via Factory
export async function deploySmartAccountViaWallet(
  ownerAddress: `0x${string}`
): Promise<{ txHash: Hash; accountAddress?: `0x${string}` }> {
  if (!hasInjectedProvider()) {
    throw new Error("No Web3 wallet detected");
  }

  const ethereum = (window as any).ethereum;
  const walletClient = createWalletClient({
    account: ownerAddress,
    transport: custom(ethereum),
  });

  const txHash = await walletClient.writeContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "createAccount",
    chain: null,
  });

  return { txHash };
}

// Claim testnet USDC from MockUSDC faucet
export async function claimFaucetTokens(
  recipient: `0x${string}`,
  amountUsdc: number = 1000,
  userWallet: `0x${string}`
): Promise<Hash> {
  if (!hasInjectedProvider()) {
    throw new Error("No Web3 wallet detected");
  }

  const ethereum = (window as any).ethereum;
  const walletClient = createWalletClient({
    account: userWallet,
    transport: custom(ethereum),
  });

  const amountUnits = parseUnits(amountUsdc.toString(), 6);

  const txHash = await walletClient.writeContract({
    address: MOCK_USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "mint",
    args: [recipient, amountUnits],
    chain: null,
  });

  return txHash;
}

// Query live on-chain token balance for an address
export async function getTokenBalance(
  accountAddress: `0x${string}`,
  chainId: number = DEFAULT_CHAIN_ID
): Promise<number> {
  try {
    const client = getPublicClient(chainId);
    const balUnits = (await client.readContract({
      address: MOCK_USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [accountAddress],
    })) as bigint;

    return Number(formatUnits(balUnits, 6));
  } catch (err) {
    console.warn(`Balance query failed for ${accountAddress}:`, err);
    return 0;
  }
}

export interface VerdictInput {
  verdict: number;
  chain_id?: number;
  chainId?: number;
  account: string;
  token: string;
  recipient: string;
  amount: number;
  mandate_id?: string;
  mandateId?: string;
  authorization_id?: string;
  authorizationId?: string;
  expiry: number;
  mandate_version?: number;
  mandateVersion?: number;
}

// Execute verified payment on-chain via user wallet or backend relayer
export async function executePaymentViaWallet(
  smartAccountAddress: `0x${string}`,
  verdictData: VerdictInput,
  signatureHex: `0x${string}`,
  senderAddress: `0x${string}`
): Promise<Hash> {
  if (!hasInjectedProvider()) {
    throw new Error("No Web3 wallet detected");
  }

  const ethereum = (window as any).ethereum;
  const walletClient = createWalletClient({
    account: senderAddress,
    transport: custom(ethereum),
  });

  const chainId = verdictData.chainId ?? verdictData.chain_id ?? 31337;
  const mandateId = (verdictData.mandateId ?? verdictData.mandate_id ?? "0x0000000000000000000000000000000000000000000000000000000000000000") as `0x${string}`;
  const authorizationId = (verdictData.authorizationId ?? verdictData.authorization_id ?? "0x0000000000000000000000000000000000000000000000000000000000000000") as `0x${string}`;
  const mandateVersion = verdictData.mandateVersion ?? verdictData.mandate_version ?? 1;

  const verdictTuple = {
    verdict: verdictData.verdict,
    chainId: BigInt(chainId),
    account: verdictData.account as `0x${string}`,
    token: verdictData.token as `0x${string}`,
    recipient: verdictData.recipient as `0x${string}`,
    amount: parseUnits(verdictData.amount.toString(), 6),
    mandateId,
    authorizationId,
    expiry: BigInt(verdictData.expiry),
    mandateVersion: BigInt(mandateVersion),
  };

  const txHash = await walletClient.writeContract({
    address: smartAccountAddress,
    abi: SMART_ACCOUNT_ABI,
    functionName: "executePayment",
    args: [verdictTuple, signatureHex],
    chain: null,
  });

  return txHash;
}
