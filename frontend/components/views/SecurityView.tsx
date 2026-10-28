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
  Info,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Modal } from "../ui/Modal";
import { AddressChip } from "../ui/AddressChip";
import { emergencyWithdrawTokenViaWallet } from "../../lib/web3";
import { SystemHealth } from "../../lib/api";
import { FACTORY_ADDRESS, SUPPORTED_CHAINS, DEFAULT_CHAIN_ID } from "../../lib/contracts";

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
  const [confirmationWord, setConfirmationWord] = useState("");
  const [isExecutingWithdraw, setIsExecutingWithdraw] = useState(false);

  const chainConfig =
    SUPPORTED_CHAINS[walletChainId as keyof typeof SUPPORTED_CHAINS] ||
    SUPPORTED_CHAINS[84532];

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
    if (confirmationWord !== "WITHDRAW") {
      showToast("warning", "Please type WITHDRAW to confirm this emergency action");
      return;
    }

    setIsExecutingWithdraw(true);
    try {
      const txHash = await emergencyWithdrawTokenViaWallet(
        activeSmartAccount as `0x${string}`,
        chainConfig.mockUsdc as `0x${string}`,
        recoveryRecipient.trim() as `0x${string}`,
        Number(withdrawAmount),
        walletAddress,
        walletChainId || DEFAULT_CHAIN_ID
      );

      showToast("success", `Emergency withdrawal submitted! Tx Hash: ${txHash.slice(0, 10)}...`);
      setShowEmergencyModal(false);
      setConfirmationWord("");
      onRefresh();
    } catch (err: any) {
      showToast("error", `Emergency withdrawal failed: ${err.message}`);
    } finally {
      setIsExecutingWithdraw(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Finding A1: No duplicate page H1 header. Content starts directly with cards */}

      {/* Grid of Key Infrastructure & Domain Telemetry */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Authorizer Signer Card (Finding C1: Honest badge) */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[var(--accent)]" />
              <h2 className="text-sm font-semibold text-[var(--text)]">Authorizer Key Infrastructure</h2>
            </div>
            {/* Finding C1: Honest label */}
            <Badge variant="warning" size="sm">
              Software key (development)
            </Badge>
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
                <span className="text-xs text-[var(--text-subtle)] font-mono">Offline / Uninitialized</span>
              )}
            </div>

            <div className="p-3 rounded-md bg-[var(--surface-raised)] border border-[var(--border)] text-xs text-[var(--text-muted)] leading-relaxed space-y-1">
              <p className="font-medium text-[var(--text)]">Environment notice:</p>
              <p>
                ECDSA key loaded in backend process. In production, this key must reside inside an isolated Cloud KMS/HSM (e.g. AWS KMS / GCP Cloud KMS) to prevent key exfiltration.
              </p>
            </div>
          </div>
        </div>

        {/* EIP-712 Typed Data Domain Card (Finding C2: Accurate explanation) */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[var(--success-text)]" />
              <h2 className="text-sm font-semibold text-[var(--text)]">EIP-712 Domain Telemetry</h2>
            </div>
            <Badge variant="neutral" size="sm" title="Replay prevention enforced via chainId and unique authorizationId">
              Replay Protected
            </Badge>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-[var(--border)]">
              <span className="text-[var(--text-muted)]">Domain Name</span>
              <span className="text-[var(--text)] font-semibold font-mono">MandateGuard</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-[var(--border)]">
              <span className="text-[var(--text-muted)]">Domain Version</span>
              <span className="text-[var(--text)] font-semibold font-mono">1</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-[var(--border)]">
              <span className="text-[var(--text-muted)]">Target Chain ID</span>
              <span className="text-[var(--text)] font-semibold font-mono tabular-nums">{health?.chain_id ?? DEFAULT_CHAIN_ID}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-[var(--text-muted)]">Verifying Smart Account</span>
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
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4 shadow-xs">
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

      {/* Danger Zone: Emergency Withdrawal (Finding C3: Outlined button, require typing WITHDRAW) */}
      <div className="rounded-lg border border-[var(--danger-border)] bg-[var(--surface)] p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--danger-border)]">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[var(--danger-text)]" />
            <h2 className="text-sm font-semibold text-[var(--danger-text)]">Danger Zone: Emergency Escape Hatch</h2>
          </div>
          <Badge variant="danger" size="sm">Owner signature required</Badge>
        </div>

        <div className="text-xs text-[var(--text-muted)] leading-relaxed space-y-2">
          <p>
            An on-chain emergency fail-safe allowing the verified human owner to withdraw ERC-20 token reserves. This action bypasses AI agent spending mandates and requires a direct private key transaction from the smart account owner.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div className="text-xs">
            <span className="text-[var(--text-muted)]">Vault Balance: </span>
            <strong className="text-[var(--text)] font-semibold tabular-nums">
              {smartAccountBalance !== null ? `$${smartAccountBalance.toFixed(2)} USDC` : "RPC Offline"}
            </strong>
          </div>

          {/* Finding C3: Outlined danger button */}
          <Button
            variant="outline-destructive"
            size="sm"
            onClick={() => {
              setRecoveryRecipient(walletAddress || "");
              setConfirmationWord("");
              setShowEmergencyModal(true);
            }}
            leftIcon={<ShieldAlert className="w-4 h-4" />}
          >
            Initiate emergency withdrawal
          </Button>
        </div>
      </div>

      {/* Emergency Token Withdrawal Confirmation Modal (Finding C3: Requires typing "WITHDRAW") */}
      <Modal
        isOpen={showEmergencyModal}
        onClose={() => setShowEmergencyModal(false)}
        title="Emergency token withdrawal"
        description="Withdraw ERC-20 funds directly from the smart account to a recovery address."
        size="md"
      >
        <form onSubmit={handleEmergencyWithdraw} className="space-y-4">
          <div className="p-3 rounded bg-[var(--danger-subtle)] border border-[var(--danger-border)] text-xs text-[var(--danger-text)] space-y-1">
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Irreversible on-chain action</span>
            </div>
            <p className="leading-relaxed">
              This transaction bypasses the policy engine and transfers funds directly from your smart account. Ensure the destination address is secure.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="emg-token" className="text-xs font-medium text-[var(--text)] block">
              Token contract address
            </label>
            <input
              id="emg-token"
              type="text"
              readOnly
              value={chainConfig.mockUsdc}
              className="w-full bg-[var(--surface-raised)] border border-[var(--border)] rounded px-2.5 py-1.5 font-mono text-xs text-[var(--text-muted)] cursor-not-allowed"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="emg-recipient" className="text-xs font-medium text-[var(--text)] block">
              Destination recovery address <span className="text-[var(--danger-text)]">*</span>
            </label>
            <input
              id="emg-recipient"
              type="text"
              required
              placeholder="0x..."
              value={recoveryRecipient}
              onChange={(e) => setRecoveryRecipient(e.target.value)}
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2.5 py-1.5 font-mono text-xs text-[var(--text)] focus:outline-none focus:border-[var(--danger)]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="emg-amount" className="text-xs font-medium text-[var(--text)] block">
              Withdrawal amount (USDC) <span className="text-[var(--danger-text)]">*</span>
            </label>
            <input
              id="emg-amount"
              type="number"
              required
              min={1}
              step="any"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(Number(e.target.value))}
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2.5 py-1.5 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--danger)] tabular-nums"
            />
          </div>

          {/* Finding C3: Typing "WITHDRAW" required */}
          <div className="space-y-1.5 pt-2 border-t border-[var(--border)]">
            <label htmlFor="emg-confirm" className="text-xs font-medium text-[var(--text)] block">
              Type <strong className="text-[var(--danger-text)] font-mono">WITHDRAW</strong> to confirm
            </label>
            <input
              id="emg-confirm"
              type="text"
              required
              placeholder="WITHDRAW"
              value={confirmationWord}
              onChange={(e) => setConfirmationWord(e.target.value)}
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2.5 py-1.5 font-mono text-xs text-[var(--text)] focus:outline-none focus:border-[var(--danger)]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
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
              disabled={confirmationWord !== "WITHDRAW" || isExecutingWithdraw}
            >
              Sign & withdraw
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
