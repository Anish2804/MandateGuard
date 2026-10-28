"use client";

import React, { useState, useEffect } from "react";
import {
  Network,
  Cpu,
  Layers,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { StatusBeacon } from "../ui/StatusBeacon";
import { SUPPORTED_CHAINS, FACTORY_ADDRESS, MOCK_USDC_ADDRESS, DEFAULT_SMART_ACCOUNT_ADDRESS } from "../../lib/contracts";
import { API_URL, RPC_URL, CHAIN_ID, rpcCall } from "../../lib/api";
import { switchWalletNetwork } from "../../lib/web3";

export interface SettingsViewProps {
  walletAddress: `0x${string}` | null;
  walletChainId: number | null;
  activeSmartAccount: string;
  onRefresh: () => void;
  showToast: (type: "success" | "error" | "info", message: string) => void;
}

export function SettingsView({
  walletAddress,
  walletChainId,
  activeSmartAccount,
  onRefresh,
  showToast,
}: SettingsViewProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [blockHeight, setBlockHeight] = useState<number | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const pingRpc = async () => {
    setIsPinging(true);
    const start = performance.now();
    try {
      const res = await rpcCall("eth_blockNumber", []);
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

  return (
    <div className="space-y-6">
      {/* Network Connectivity Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>EVM RPC Connectivity & Latency</CardTitle>
              <CardDescription>Real-time health ping to the active JSON-RPC node.</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              loading={isPinging}
              onClick={pingRpc}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Ping RPC
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400 font-sans block">Configured RPC URL:</span>
              <span className="text-slate-200 truncate block">{RPC_URL}</span>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400 font-sans block">Round-Trip Latency:</span>
              <span className="text-emerald-400 font-bold block">
                {latencyMs !== null ? `${latencyMs} ms` : "Unreachable"}
              </span>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400 font-sans block">Current Block Height:</span>
              <span className="text-indigo-400 font-bold block">
                {blockHeight !== null ? `#${blockHeight.toLocaleString()}` : "Offline"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Supported Chains Table */}
      <Card>
        <CardHeader>
          <CardTitle>Supported EVM Chains</CardTitle>
          <CardDescription>
            MandateGuard smart contracts and authorization services support the following networks.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300" aria-label="Supported EVM networks">
              <thead className="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 uppercase font-mono text-[11px]">
                <tr>
                  <th scope="col" className="px-5 py-3">Network Name</th>
                  <th scope="col" className="px-5 py-3">Chain ID</th>
                  <th scope="col" className="px-5 py-3">RPC Endpoint</th>
                  <th scope="col" className="px-5 py-3">Currency</th>
                  <th scope="col" className="px-5 py-3 text-right">Switch Wallet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {Object.values(SUPPORTED_CHAINS).map((chain) => {
                  const isCurrent = walletChainId === chain.id || (!walletChainId && chain.id === CHAIN_ID);

                  return (
                    <tr key={chain.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-slate-100 flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isCurrent ? "bg-emerald-400" : "bg-slate-500"}`} />
                        <span>{chain.name}</span>
                        {isCurrent && (
                          <span className="text-[10px] bg-indigo-950 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-800/40 font-sans">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-indigo-300">{chain.id}</td>
                      <td className="px-5 py-3.5 text-slate-400 truncate max-w-xs">{chain.rpcUrl}</td>
                      <td className="px-5 py-3.5 text-slate-300">{chain.currency}</td>
                      <td className="px-5 py-3.5 text-right font-sans">
                        <Button
                          variant={isCurrent ? "secondary" : "outline"}
                          size="sm"
                          disabled={isCurrent}
                          onClick={() => handleSwitchNetwork(chain.id)}
                        >
                          {isCurrent ? "Connected" : "Switch Chain"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Contract Addresses Registry */}
      <Card>
        <CardHeader>
          <CardTitle>Deployed Smart Contract Registry</CardTitle>
          <CardDescription>
            On-chain verifying contracts enforcing mandate policies and payment execution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 font-mono text-xs">
          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-slate-400 font-sans block text-[11px]">MandateGuardAccount (Current Active):</span>
              <span className="text-slate-100 font-semibold">{activeSmartAccount}</span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(activeSmartAccount, "activeAccount")}
              className="p-1 text-slate-400 hover:text-white shrink-0"
              title="Copy Address"
            >
              {copiedKey === "activeAccount" ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-slate-400 font-sans block text-[11px]">MandateGuardFactory:</span>
              <span className="text-indigo-300">{FACTORY_ADDRESS}</span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(FACTORY_ADDRESS, "factory")}
              className="p-1 text-slate-400 hover:text-white shrink-0"
              title="Copy Address"
            >
              {copiedKey === "factory" ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-slate-400 font-sans block text-[11px]">MockUSDC Token:</span>
              <span className="text-slate-300">{MOCK_USDC_ADDRESS}</span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(MOCK_USDC_ADDRESS, "usdc")}
              className="p-1 text-slate-400 hover:text-white shrink-0"
              title="Copy Address"
            >
              {copiedKey === "usdc" ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
