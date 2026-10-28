"use client";

import React, { useState, useEffect } from "react";
import {
  RefreshCw,
  ExternalLink,
  Layers,
  Network,
  Cpu,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { AddressChip } from "../ui/AddressChip";
import {
  SUPPORTED_CHAINS,
  getContractAddresses,
} from "../../lib/contracts";
import { CHAIN_ID, rpcCall } from "../../lib/api";
import { switchWalletNetwork } from "../../lib/web3";

export interface SettingsViewProps {
  walletAddress: `0x${string}` | null;
  walletChainId: number | null;
  activeSmartAccount: string;
  onRefresh: () => void;
  showToast: (type: "success" | "error" | "warning" | "info", message: string) => void;
}

export function SettingsView({
  walletAddress,
  walletChainId,
  activeSmartAccount,
  onRefresh,
  showToast,
}: SettingsViewProps) {
  const currentChainId = walletChainId || CHAIN_ID;
  const currentChain =
    SUPPORTED_CHAINS[currentChainId as keyof typeof SUPPORTED_CHAINS] ||
    SUPPORTED_CHAINS[84532];
  const addresses = getContractAddresses(currentChainId);

  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [blockHeight, setBlockHeight] = useState<number | null>(null);

  const pingRpc = async () => {
    setIsPinging(true);
    const start = performance.now();
    try {
      const res = await rpcCall("eth_blockNumber", [], currentChain.rpcUrl);
      const duration = Math.round(performance.now() - start);
      setLatencyMs(duration);
      setBlockHeight(parseInt(res, 16));
    } catch {
      setLatencyMs(null);
      setBlockHeight(null);
    } finally {
      setIsPinging(false);
    }
  };

  useEffect(() => {
    pingRpc();
  }, []);

  const handleSwitchNetwork = async (targetChainId: number) => {
    try {
      await switchWalletNetwork(targetChainId);
      showToast("success", `Switched network to Chain ID ${targetChainId}`);
      onRefresh();
    } catch (err: any) {
      showToast("error", `Network switch failed: ${err.message}`);
    }
  };

  const getLatencyColor = () => {
    if (latencyMs === null) return "text-[var(--danger-text)]";
    if (latencyMs < 150) return "text-[var(--success-text)]";
    if (latencyMs < 400) return "text-[var(--warning-text)]";
    return "text-[var(--danger-text)]";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--border)]">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)] tracking-tight">Networks & Settings</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            RPC endpoint telemetry, chain configurations, and on-chain contract deployments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={isPinging}
            onClick={pingRpc}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Ping RPC
          </Button>
        </div>
      </div>

      {/* EVM RPC Connectivity Metrics */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-[var(--accent-text)]" />
            <h2 className="text-sm font-semibold text-[var(--text)]">RPC node connectivity</h2>
          </div>
          <span className="text-xs font-mono text-[var(--text-muted)]">JSON-RPC 2.0</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
          <div className="p-3.5 rounded-md bg-[var(--surface-raised)] border border-[var(--border)] space-y-1">
            <span className="text-[11px] text-[var(--text-muted)] font-sans block">Endpoint URL</span>
            <span className="text-[var(--text)] truncate block select-all font-semibold">{currentChain.rpcUrl}</span>
          </div>

          <div className="p-3.5 rounded-md bg-[var(--surface-raised)] border border-[var(--border)] space-y-1">
            <span className="text-[11px] text-[var(--text-muted)] font-sans block">Round-trip latency</span>
            <span className={`font-bold block tabular-nums ${getLatencyColor()}`}>
              {latencyMs !== null ? `${latencyMs} ms` : "Unreachable"}
            </span>
          </div>

          <div className="p-3.5 rounded-md bg-[var(--surface-raised)] border border-[var(--border)] space-y-1">
            <span className="text-[11px] text-[var(--text-muted)] font-sans block">Current block height</span>
            <span className="text-[var(--text)] font-bold block tabular-nums">
              {blockHeight !== null ? `#${blockHeight.toLocaleString()}` : "Offline"}
            </span>
          </div>
        </div>
      </div>

      {/* Supported Chains Table */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text)]">Supported EVM networks</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Available execution environments for mandate verification and settlement.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" aria-label="Supported EVM networks table">
            <thead className="bg-[var(--surface-raised)] border-b border-[var(--border)] text-[var(--text-muted)] font-mono text-[11px] uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-4 py-3">Network</th>
                <th scope="col" className="px-4 py-3">Chain ID</th>
                <th scope="col" className="px-4 py-3">RPC endpoint</th>
                <th scope="col" className="px-4 py-3">Currency</th>
                <th scope="col" className="px-4 py-3 text-right">Wallet state</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {Object.values(SUPPORTED_CHAINS).map((chain) => {
                const isCurrent = walletChainId === chain.id || (!walletChainId && chain.id === CHAIN_ID);

                return (
                  <tr key={chain.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                    <td className="px-4 py-3 font-medium text-[var(--text)]">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isCurrent ? "bg-[var(--success-text)]" : "bg-[var(--text-subtle)]"
                          }`}
                        />
                        <span>{chain.name}</span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[var(--surface-hover)] text-[var(--text-muted)] border border-[var(--border)]">
                          Testnet
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[var(--text-muted)] tabular-nums">{chain.id}</td>
                    <td className="px-4 py-3 font-mono text-[var(--text-muted)] truncate max-w-xs">{chain.rpcUrl}</td>
                    <td className="px-4 py-3 font-mono text-[var(--text)]">{chain.currency}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant={isCurrent ? "ghost" : "secondary"}
                        size="sm"
                        disabled={isCurrent}
                        onClick={() => handleSwitchNetwork(chain.id)}
                      >
                        {isCurrent ? "Connected" : "Switch chain"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Contract Registry List */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[var(--text-muted)]" />
            <h2 className="text-sm font-semibold text-[var(--text)]">Contract registry</h2>
          </div>
          <span className="text-xs text-[var(--text-muted)] font-mono">Verifying contracts</span>
        </div>

        <div className="space-y-3 font-mono text-xs">
          <div className="p-3.5 rounded-md bg-[var(--surface-raised)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-sans text-[var(--text-muted)] block">
                Active Smart Account (MandateGuardAccount)
              </span>
              <span className="text-[var(--text)] font-semibold mt-0.5 block">{activeSmartAccount}</span>
            </div>
            <AddressChip
              address={activeSmartAccount}
              truncateLength={6}
              showExplorer={true}
              explorerUrl={currentChain.explorer}
            />
          </div>

          <div className="p-3.5 rounded-md bg-[var(--surface-raised)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-sans text-[var(--text-muted)] block">
                Account Factory (MandateGuardFactory)
              </span>
              <span className="text-[var(--text)] mt-0.5 block">{addresses.factory}</span>
            </div>
            <AddressChip
              address={addresses.factory}
              truncateLength={6}
              showExplorer={true}
              explorerUrl={currentChain.explorer}
            />
          </div>

          <div className="p-3.5 rounded-md bg-[var(--surface-raised)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-sans text-[var(--text-muted)] block">
                Settlement Token (MockUSDC)
              </span>
              <span className="text-[var(--text)] mt-0.5 block">{addresses.usdc}</span>
            </div>
            <AddressChip
              address={addresses.usdc}
              truncateLength={6}
              showExplorer={true}
              explorerUrl={currentChain.explorer}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
