import { useState, useEffect, useCallback } from "react";
import { SUPPORTED_CHAINS, DEFAULT_CHAIN_ID } from "./contracts";
import { rpcCall, RPC_URL, CHAIN_ID } from "./api";

export interface NetworkState {
  activeChainId: number;
  chainName: string;
  rpcUrl: string;
  currency: string;
  explorerUrl: string;
  factoryAddress: `0x${string}`;
  mockUsdcAddress: `0x${string}`;
  smartAccountAddress: `0x${string}`;
  latencyMs: number | null;
  latencyStatus: "fast" | "moderate" | "slow" | "offline";
  blockHeight: number | null;
  isRpcHealthy: boolean;
  isMismatch: boolean;
  walletChainId: number | null;
}

export function getLatencyStatus(ms: number | null): "fast" | "moderate" | "slow" | "offline" {
  if (ms === null) return "offline";
  if (ms < 300) return "fast";
  if (ms <= 800) return "moderate";
  return "slow";
}

export function useNetworkState(walletChainId: number | null) {
  // Single source of truth: active chain is wallet chain if connected & supported, else default (84532 Base Sepolia)
  const effectiveChainId =
    walletChainId && SUPPORTED_CHAINS[walletChainId as keyof typeof SUPPORTED_CHAINS]
      ? walletChainId
      : DEFAULT_CHAIN_ID;

  const chainConfig =
    SUPPORTED_CHAINS[effectiveChainId as keyof typeof SUPPORTED_CHAINS] ||
    SUPPORTED_CHAINS[84532];

  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [blockHeight, setBlockHeight] = useState<number | null>(null);
  const [isRpcHealthy, setIsRpcHealthy] = useState<boolean>(true);

  // Mismatch check: if wallet is connected on an unsupported chain or different from backend (84532)
  const isMismatch = Boolean(
    walletChainId && walletChainId !== effectiveChainId
  );

  const pingRpc = useCallback(async () => {
    const start = performance.now();
    try {
      const res = await rpcCall("eth_blockNumber", [], chainConfig.rpcUrl);
      const duration = Math.round(performance.now() - start);
      setLatencyMs(duration);
      setBlockHeight(parseInt(res, 16));
      setIsRpcHealthy(true);
    } catch {
      setLatencyMs(null);
      setBlockHeight(null);
      setIsRpcHealthy(false);
    }
  }, [chainConfig.rpcUrl]);

  useEffect(() => {
    pingRpc();
    const interval = setInterval(pingRpc, 15000);
    return () => clearInterval(interval);
  }, [pingRpc]);

  return {
    activeChainId: effectiveChainId,
    chainName: chainConfig.name,
    rpcUrl: chainConfig.rpcUrl,
    currency: chainConfig.currency,
    explorerUrl: chainConfig.explorer,
    factoryAddress: chainConfig.factory,
    mockUsdcAddress: chainConfig.mockUsdc,
    smartAccountAddress: chainConfig.defaultSmartAccount,
    latencyMs,
    latencyStatus: getLatencyStatus(latencyMs),
    blockHeight,
    isRpcHealthy,
    isMismatch,
    walletChainId,
    pingRpc,
  };
}
