"use client";

import React, { useState } from "react";
import {
  Lock,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  KeyRound,
  ExternalLink,
  Coins,
  Cpu,
  Layers,
  ArrowRight,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Modal } from "../ui/Modal";
import { AddressChip } from "../ui/AddressChip";
import { emergencyWithdrawTokenViaWallet } from "../../lib/web3";
import { MOCK_USDC_ADDR, SystemHealth } from "../../lib/api";
import { FACTORY_ADDRESS, SUPPORTED_CHAINS } from "../../lib/contracts";

export interface SecurityViewProps {
  health: SystemHealth | null;
  activeSmartAccount: string;
  walletAddress: `0x${string}` | null;
  walletChainId: number | null;
  smartAccountBalance: number | null;
  onRefresh: () => void;
  showToast: (type: "success" | "error" | "warning" | "info", message: string) => void;
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

  const chainConfig =
    SUPPORTED_CHAINS[walletChainId as keyof typeof SUPPORTED_CHAINS] ||
    SUPPORTED_CHAINS[31337];

  const handleEmergencyWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletAddress) {
      showToast("error", "Please connect your Web3 wallet first");
      return;
    }
    if (!recoveryRecipient.trim() || !recoveryRecipient.startsWith("0x")) {
      showToast("error", "Please specify a valid Ethereum destination address (0x...)");
      return;
    }
    if (!confirmedRisk) {
      showToast("warning", "Please acknowledge the risk confirmation checkbox before proceeding");
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
      showToast("error", `Emergency withdrawal failed: ${err.message}`);
    } finally {
      setIsExecutingWithdraw(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--border)]">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)] tracking-tight">Signers & Security</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Authorizer cryptographic signers, EIP-712 domain telemetry, and emergency escape controls.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="active" size="sm">
            EIP-712 Guard Active
          </Badge>
        </div>
      </div>

      {/* Grid of Telemetry */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Authorizer Signer Card */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[var(--accent-text)]" />
              <h2 className="text-sm font-semibold text-[var(--text)]">Authorizer Key Infrastructure</h2>
            </div>
            <span className="text-[11px] font-mono text-[var(--text-muted)]">HSM Protected</span>
          </div>

          <div className="space-y-3">
            <div>
              <span className="text-xs text-[var(--text-muted)] block mb-1">Authorizer Signer Address</span>
              {health?.authorizer_signer ? (
                <AddressChip
                  address={health.authorizer_signer}
                  truncateLength={8}
                  showExplorer={true}
                  explorerUrl={chainConfig?.explorer}
                />
              ) : (
                <span className="text-xs font-mono text-[var(--text-subtle)]">Offline / Uninitialized</span>
              )}
            </div>

            <div className="p-3 rounded-md bg-[var(--surface-raised)] border border-[var(--border)] text-xs text-[var(--text-muted)] leading-relaxed">
              ECDSA key loaded in backend policy engine. In production environments, this key resides inside an isolated Cloud HSM (AWS KMS / GCP Cloud KMS) to prevent key exfiltration.
            </div>
          </div>
        </div>

        {/* EIP-712 Typed Data Domain Card */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[var(--success-text)]" />
              <h2 className="text-sm font-semibold text-[var(--text)]">EIP-712 Domain Separator</h2>
            </div>
            <span className="text-[11px] font-mono text-[var(--text-muted)]">Replay Protected</span>
          </div>

          <div className="space-y-2.5 font-mono text-xs">
            <div className="flex justify-between items-center py-1 border-b border-[var(--border)]">
              <span className="text-[var(--text-muted)] font-sans">Domain Name</span>
              <span className="text-[var(--text)] font-semibold">MandateGuard</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-[var(--border)]">
              <span className="text-[var(--text-muted)] font-sans">Domain Version</span>
              <span className="text-[var(--text)] font-semibold">1</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-[var(--border)]">
              <span className="text-[var(--text-muted)] font-sans">Chain ID</span>
              <span className="text-[var(--text)] font-semibold tabular-nums">{health?.chain_id ?? 31337}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-[var(--text-muted)] font-sans">Verifying Contract</span>
              <AddressChip
                address={activeSmartAccount}
                truncateLength={6}
                showExplorer={true}
                explorerUrl={chainConfig?.explorer}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Smart Account Governance */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[var(--text-muted)]" />
            <h2 className="text-sm font-semibold text-[var(--text)]">Smart Account Governance</h2>
          </div>
          <span className="text-xs text-[var(--text-muted)]">ERC-4337 / Isolated Vault</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3.5 rounded-md bg-[var(--surface-raised)] border border-[var(--border)] space-y-1.5">
            <span className="text-xs text-[var(--text-muted)] block">Guarded Smart Account</span>
            <AddressChip
              address={activeSmartAccount}
              truncateLength={8}
              showExplorer={true}
              explorerUrl={chainConfig?.explorer}
            />
          </div>

          <div className="p-3.5 rounded-md bg-[var(--surface-raised)] border border-[var(--border)] space-y-1.5">
            <span className="text-xs text-[var(--text-muted)] block">Deployer Factory</span>
            <AddressChip
              address={FACTORY_ADDRESS}
              truncateLength={8}
              showExplorer={true}
              explorerUrl={chainConfig?.explorer}
            />
          </div>
        </div>
      </div>

      {/* Danger Zone: Emergency Token Withdrawal (Restrained, No Neon) */}
      <div className="rounded-lg border border-[var(--danger-border)] bg-[var(--surface)] p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--danger-border)]">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[var(--danger-text)]" />
            <h2 className="text-sm font-semibold text-[var(--text)]">Emergency escape hatch</h2>
          </div>
          <Badge variant="danger" size="sm">Privileged owner only</Badge>
        </div>

        <div className="text-xs text-[var(--text-muted)] leading-relaxed space-y-2">
          <p>
            An on-chain emergency fail-safe allowing the verified human owner to withdraw ERC-20 token reserves. This action completely bypasses AI agent spending mandates and requires a direct private key signature from the account owner.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div className="text-xs font-mono">
            <span className="text-[var(--text-muted)] font-sans">Vault Balance: </span>
            <strong className="text-[var(--text)] font-semibold tabular-nums">
              {smartAccountBalance !== null ? `$${smartAccountBalance.toFixed(2)} USDC` : "RPC Offline"}
            </strong>
          </div>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              setRecoveryRecipient(walletAddress || "");
              setConfirmedRisk(false);
              setShowEmergencyModal(true);
            }}
            leftIcon={<ShieldAlert className="w-4 h-4" />}
          >
            Emergency token withdrawal
          </Button>
        </div>
      </div>

      {/* Emergency Token Withdrawal Confirmation Modal */}
      <Modal
        isOpen={showEmergencyModal}
        onClose={() => setShowEmergencyModal(false)}
        title="Emergency token withdrawal"
        description="Withdraw ERC-20 funds directly from the smart account to a recovery address."
        size="md"
      >
        <form onSubmit={handleEmergencyWithdraw} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="emg-token" className="text-xs font-medium text-[var(--text)] block">
              Token contract address
            </label>
            <input
              id="emg-token"
              type="text"
              readOnly
              value={MOCK_USDC_ADDR}
              className="w-full bg-[var(--surface-raised)] border border-[var(--border)] rounded-md px-3 py-2 text-xs font-mono text-[var(--text-muted)] select-none cursor-not-allowed"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="emg-recipient" className="text-xs font-medium text-[var(--text)] block">
              Destination recovery address
            </label>
            <input
              id="emg-recipient"
              type="text"
              required
              value={recoveryRecipient}
              onChange={(e) => setRecoveryRecipient(e.target.value)}
              placeholder="0x..."
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2 text-xs font-mono text-[var(--text)] placeholder-[var(--text-subtle)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="emg-amount" className="text-xs font-medium text-[var(--text)] block">
              Withdrawal amount (USDC)
            </label>
            <input
              id="emg-amount"
              type="number"
              min="0.01"
              step="any"
              required
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(parseFloat(e.target.value) || 0)}
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2 text-xs font-mono text-[var(--text)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>

          <div className="p-3 rounded-md bg-[var(--danger-bg)] border border-[var(--danger-border)] flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[var(--danger-text)] shrink-0 mt-0.5" />
            <div className="text-xs text-[var(--danger-text)] leading-relaxed">
              This initiates an on-chain state transition requiring your connected Web3 wallet signature. Ensure the destination address is accurate.
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={confirmedRisk}
              onChange={(e) => setConfirmedRisk(e.target.checked)}
              className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)] w-4 h-4 bg-[var(--surface)]"
            />
            <span className="text-xs text-[var(--text)] font-medium">
              I understand this action executes directly on-chain and withdraws token reserves.
            </span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowEmergencyModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              loading={isExecutingWithdraw}
              disabled={!confirmedRisk || isExecutingWithdraw}
            >
              Execute withdrawal
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
