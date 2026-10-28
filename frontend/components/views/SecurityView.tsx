"use client";

import React, { useState } from "react";
import {
  Lock,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Key,
  KeyRound,
  Coins,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  Cpu,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Modal } from "../ui/Modal";
import { emergencyWithdrawTokenViaWallet } from "../../lib/web3";
import { MOCK_USDC_ADDR, SystemHealth } from "../../lib/api";
import { FACTORY_ADDRESS } from "../../lib/contracts";

export interface SecurityViewProps {
  health: SystemHealth | null;
  activeSmartAccount: string;
  walletAddress: `0x${string}` | null;
  walletChainId: number | null;
  smartAccountBalance: number | null;
  onRefresh: () => void;
  showToast: (type: "success" | "error" | "info", message: string) => void;
}

export function SecurityView({
  health,
  activeSmartAccount,
  walletAddress,
  walletChainId,
  smartAccountBalance,
  onRefresh,
  showToast,
}: SecurityViewProps) {
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [recoveryRecipient, setRecoveryRecipient] = useState(walletAddress || "");
  const [withdrawAmount, setWithdrawAmount] = useState(10);
  const [confirmedRisk, setConfirmedRisk] = useState(false);
  const [isExecutingWithdraw, setIsExecutingWithdraw] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleEmergencyWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletAddress) {
      alert("Please connect your Web3 wallet first");
      return;
    }
    if (!recoveryRecipient.trim() || !recoveryRecipient.startsWith("0x")) {
      alert("Please specify a valid Ethereum destination address");
      return;
    }
    if (!confirmedRisk) {
      alert("Please confirm that you understand the risk before proceeding");
      return;
    }

    setIsExecutingWithdraw(true);
    try {
      const txHash = await emergencyWithdrawTokenViaWallet(
        activeSmartAccount as `0x${string}`,
        MOCK_USDC_ADDR as `0x${string}`,
        recoveryRecipient.trim() as `0x${string}`,
        Number(withdrawAmount),
        walletAddress,
        walletChainId || 31337
      );

      showToast("success", `Emergency withdrawal submitted! Tx Hash: ${txHash.slice(0, 10)}...`);
      setShowEmergencyModal(false);
      setConfirmedRisk(false);
      onRefresh();
    } catch (err: any) {
      alert(`Emergency withdrawal failed: ${err.message}`);
    } finally {
      setIsExecutingWithdraw(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Signer Infrastructure Card */}
      <Card>
        <CardHeader>
          <CardTitle>Signing Service Configuration & HSM Telemetry</CardTitle>
          <CardDescription>
            Cryptographic key configuration verified against the active MandateGuard policy backend.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-xs text-slate-400 font-sans block">Authorizer Signer Key</span>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-indigo-300 break-all">
                  {health?.authorizer_signer || "Offline / Not Derived"}
                </span>
                {health?.authorizer_signer && (
                  <button
                    type="button"
                    onClick={() => handleCopy(health.authorizer_signer, "signer")}
                    className="p-1 text-slate-400 hover:text-white shrink-0 ml-2"
                  >
                    {copiedKey === "signer" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-sans">
                ECDSA key loaded in backend. In production, this runs inside AWS KMS / GCP Cloud KMS HSM.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-xs text-slate-400 font-sans block">EIP-712 Typed Data Domain</span>
              <div className="font-mono text-xs text-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Domain Name:</span>
                  <span>MandateGuard</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Domain Version:</span>
                  <span>1</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Target Chain ID:</span>
                  <span className="text-indigo-400 font-semibold">{health?.chain_id ?? 31337}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Smart Account Governance */}
      <Card>
        <CardHeader>
          <CardTitle>Smart Account Governance & Replay Defense</CardTitle>
          <CardDescription>
            On-chain parameter security for the current isolated account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 font-mono text-xs">
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-slate-400 block font-sans">Guarded Smart Account:</span>
              <span className="text-slate-100 font-semibold">{activeSmartAccount}</span>
            </div>
            <Badge variant="active" size="sm">EIP-712 Guard Active</Badge>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-slate-400 block font-sans">Factory Registry:</span>
              <span className="text-indigo-300">{FACTORY_ADDRESS}</span>
            </div>
            <span className="text-slate-500 text-[11px] font-sans">MandateGuardFactory</span>
          </div>
        </CardContent>
      </Card>

      {/* Emergency Escape Hatch Card (Visually Distinct & High Security) */}
      <Card className="border-rose-900/60 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-rose-950/20">
        <CardHeader className="border-b border-rose-900/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-rose-200">Owner Emergency Token Escape Hatch</CardTitle>
              <CardDescription className="text-rose-300/70">
                Audited fail-safe allowing the verified human owner to withdraw funds during emergency or decommissioning.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/40 text-xs text-rose-200 space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Privileged Operation Warning:</span>
            </div>
            <p className="leading-relaxed">
              This function bypasses AI-agent spending limits and requires the private key signature of the smart account owner on-chain. It is intended only for contract decommissioning or recovering mis-sent tokens.
            </p>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="text-xs font-mono">
              <span className="text-slate-400 font-sans">Current Vault Reserve: </span>
              <strong className="text-emerald-400">
                {smartAccountBalance !== null ? `$${smartAccountBalance.toFixed(2)} USDC` : "RPC Offline"}
              </strong>
            </div>

            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setRecoveryRecipient(walletAddress || "");
                setConfirmedRisk(false);
                setShowEmergencyModal(true);
              }}
              leftIcon={<ShieldAlert className="w-4 h-4" />}
            >
              Emergency Token Withdrawal
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Emergency Token Withdrawal Modal */}
      <Modal
        isOpen={showEmergencyModal}
        onClose={() => setShowEmergencyModal(false)}
        title="Confirm Emergency Token Withdrawal"
        description="This action executes emergencyWithdrawToken on the MandateGuardAccount contract."
        size="md"
      >
        <form onSubmit={handleEmergencyWithdraw} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="emg-token" className="text-xs font-medium text-slate-300 block">
              Token Contract Address
            </label>
            <input
              id="emg-token"
              type="text"
              readOnly
              value={MOCK_USDC_ADDR}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-400 select-none cursor-not-allowed"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="emg-recipient" className="text-xs font-medium text-slate-300 block">
              Recovery Destination Address <span className="text-rose-400">*</span>
            </label>
            <input
              id="emg-recipient"
              type="text"
              required
              placeholder="0x..."
              value={recoveryRecipient}
              onChange={(e) => setRecoveryRecipient(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="emg-amount" className="text-xs font-medium text-slate-300 block">
              Withdrawal Amount (USDC) <span className="text-rose-400">*</span>
            </label>
            <input
              id="emg-amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/40 text-xs text-rose-300 space-y-2">
            <div className="flex items-start gap-2">
              <input
                id="emg-confirm"
                type="checkbox"
                required
                checked={confirmedRisk}
                onChange={(e) => setConfirmedRisk(e.target.checked)}
                className="mt-0.5 rounded border-slate-800 text-rose-600 focus:ring-rose-500"
              />
              <label htmlFor="emg-confirm" className="cursor-pointer text-[11px] leading-relaxed">
                I understand that this transfers funds immediately out of the guarded smart account, and that I must be the connected owner of this contract.
              </label>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-3 border-t border-slate-800">
            <Button variant="outline" onClick={() => setShowEmergencyModal(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={!confirmedRisk}
              loading={isExecutingWithdraw}
              leftIcon={<ShieldAlert className="w-4 h-4" />}
            >
              Confirm & Execute Withdrawal
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
