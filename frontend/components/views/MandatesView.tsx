"use client";

import React, { useState } from "react";
import {
  FileCheck2,
  PlusCircle,
  Copy,
  Check,
  Clock,
  Coins,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Send,
  Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Modal } from "../ui/Modal";
import { Mandate, MOCK_USDC_ADDR } from "../../lib/api";
import { SUPPORTED_CHAINS } from "../../lib/contracts";

export interface MandatesViewProps {
  mandates: Mandate[];
  activeSmartAccount: string;
  walletAddress: `0x${string}` | null;
  walletChainId: number | null;
  onRefresh: () => void;
  onCreateMandate: (data: {
    title: string;
    account: string;
    agent: string;
    token: string;
    recipient?: string | null;
    max_amount_per_tx: number;
    max_cumulative_amount: number;
    expiry: number;
  }) => Promise<Mandate>;
  onRevokeMandate: (mandateId: string) => Promise<Mandate>;
  onRegisterOnChain: (mandate: Mandate) => Promise<string>;
  onRevokeOnChain: (mandateId: string) => Promise<string>;
}

export function MandatesView({
  mandates,
  activeSmartAccount,
  walletAddress,
  walletChainId,
  onRefresh,
  onCreateMandate,
  onRevokeMandate,
  onRegisterOnChain,
  onRevokeOnChain,
}: MandatesViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "revoked" | "exhausted">("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [step, setStep] = useState<"form" | "review">("form");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form State adhering to Sections A-F
  const [form, setForm] = useState({
    title: "",
    agent: "",
    recipient: "",
    allowAnyRecipient: true,
    max_amount_per_tx: 50,
    max_cumulative_amount: 500,
    expiryDays: 30,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const filteredMandates = mandates.filter((m) => {
    const matchesSearch =
      m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.agent.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === "all") return true;
    if (statusFilter === "active") return !m.is_revoked && m.remaining_budget > 0;
    if (statusFilter === "revoked") return m.is_revoked;
    if (statusFilter === "exhausted") return !m.is_revoked && m.remaining_budget <= 0;
    return true;
  });

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevoke = async (mandateId: string, title: string) => {
    if (!confirm(`Are you sure you want to revoke mandate "${title}"? Any future payment requests matching this mandate will be denied.`)) {
      return;
    }
    setActionLoadingId(mandateId);
    try {
      await onRevokeMandate(mandateId);
      onRefresh();
    } catch (err: any) {
      alert(`Revocation failed: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRegisterOnChainClick = async (mandate: Mandate) => {
    if (!walletAddress) {
      alert("Please connect your Web3 wallet first to sign the on-chain registration transaction.");
      return;
    }
    setActionLoadingId(`onchain-${mandate.id}`);
    try {
      const txHash = await onRegisterOnChain(mandate);
      alert(`On-chain registration submitted! Transaction Hash: ${txHash}`);
      onRefresh();
    } catch (err: any) {
      alert(`On-chain registration failed: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSubmitForm = async () => {
    if (!form.title.trim() || !form.agent.trim()) {
      alert("Please provide a title and agent address");
      return;
    }
    if (form.max_amount_per_tx > form.max_cumulative_amount) {
      alert("Per-transaction limit cannot exceed cumulative spending limit");
      return;
    }

    setIsSubmitting(true);
    try {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const expiryTimestamp = currentTimestamp + form.expiryDays * 86400;

      await onCreateMandate({
        title: form.title.trim(),
        account: activeSmartAccount,
        agent: form.agent.trim(),
        token: MOCK_USDC_ADDR,
        recipient: form.allowAnyRecipient ? null : form.recipient.trim() || null,
        max_amount_per_tx: Number(form.max_amount_per_tx),
        max_cumulative_amount: Number(form.max_cumulative_amount),
        expiry: expiryTimestamp,
      });

      setShowCreateModal(false);
      setStep("form");
      setForm({
        title: "",
        agent: "",
        recipient: "",
        allowAnyRecipient: true,
        max_amount_per_tx: 50,
        max_cumulative_amount: 500,
        expiryDays: 30,
      });
      onRefresh();
    } catch (err: any) {
      alert(`Mandate creation failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3 max-w-lg">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title, ID, or agent address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
            {(["all", "active", "exhausted", "revoked"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-2.5 py-1 rounded-md capitalize font-medium transition-colors ${
                  statusFilter === status
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            setStep("form");
            setShowCreateModal(true);
          }}
          leftIcon={<PlusCircle className="w-4 h-4" />}
        >
          Create Mandate Policy
        </Button>
      </div>

      {/* Mandate List */}
      {filteredMandates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <FileCheck2 className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-300">No mandate policies matching criteria</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Mandate policies establish verifiable human bounds (per-transaction ceilings, cumulative caps, recipient whitelists) enforced by the cryptographic signing service.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStep("form");
                setShowCreateModal(true);
              }}
            >
              Define First Mandate
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredMandates.map((m) => {
            const isExhausted = !m.is_revoked && m.remaining_budget <= 0;
            const isRevoked = m.is_revoked;
            const spentPercent = m.max_cumulative_amount > 0 ? (m.current_spent / m.max_cumulative_amount) * 100 : 0;
            const reservedPercent = m.max_cumulative_amount > 0 ? (m.reserved_amount / m.max_cumulative_amount) * 100 : 0;

            return (
              <Card key={m.id} className="flex flex-col justify-between" hoverEffect>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{m.title}</CardTitle>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[11px] font-mono text-slate-400">
                          {`${m.id.slice(0, 10)}...${m.id.slice(-6)}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(m.id, m.id)}
                          className="p-0.5 text-slate-500 hover:text-indigo-400"
                          title="Copy Mandate ID"
                        >
                          {copiedId === m.id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                    {isRevoked ? (
                      <Badge variant="revoked" size="sm">Revoked</Badge>
                    ) : isExhausted ? (
                      <Badge variant="exhausted" size="sm">Exhausted</Badge>
                    ) : (
                      <Badge variant="active" size="sm">Active (v{m.version})</Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 py-3">
                  {/* Budget Allocation Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-400">Spent: ${m.current_spent.toFixed(2)}</span>
                      <span className="text-slate-200 font-semibold">
                        Cap: ${m.max_cumulative_amount.toFixed(2)} USDC
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden flex">
                      <div
                        className="bg-indigo-500 h-full transition-all"
                        style={{ width: `${Math.min(spentPercent, 100)}%` }}
                      />
                      <div
                        className="bg-amber-500 h-full transition-all"
                        style={{ width: `${Math.min(reservedPercent, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                      <span>Per-Tx Max: ${m.max_amount_per_tx.toFixed(2)}</span>
                      <span className="text-emerald-400 font-semibold">
                        Available: ${m.remaining_budget.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Attributes Details */}
                  <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/40 text-xs space-y-1.5 font-mono">
                    <div className="flex justify-between items-center text-slate-400">
                      <span>Agent:</span>
                      <span className="text-indigo-300 font-medium truncate max-w-[150px]">
                        {`${m.agent.slice(0, 8)}...${m.agent.slice(-6)}`}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400">
                      <span>Recipient:</span>
                      <span className="text-slate-200 truncate max-w-[150px]">
                        {m.recipient ? `${m.recipient.slice(0, 8)}...${m.recipient.slice(-6)}` : "Any Recipient"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400">
                      <span>Expires:</span>
                      <span className="text-slate-300">
                        {new Date(m.expiry * 1000).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </CardContent>

                {/* Card Actions */}
                <div className="p-3 border-t border-slate-800/60 bg-slate-950/30 flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    loading={actionLoadingId === `onchain-${m.id}`}
                    onClick={() => handleRegisterOnChainClick(m)}
                    leftIcon={<Layers className="w-3.5 h-3.5 text-indigo-400" />}
                    title="Register policy parameters on-chain in MandateGuardAccount"
                  >
                    Sync On-Chain
                  </Button>

                  {!isRevoked && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 text-xs"
                      loading={actionLoadingId === m.id}
                      onClick={() => handleRevoke(m.id, m.title)}
                    >
                      Revoke Policy
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Guided 7-Step Mandate Creation Modal (A to G) */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={step === "form" ? "Create New Mandate Policy" : "Review & Activate Mandate"}
        description={
          step === "form"
            ? "Configure human-approved payment boundaries according to sections A through F."
            : "Section G: Explicitly review policy boundaries before cryptographic activation."
        }
        size="lg"
      >
        {step === "form" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setStep("review");
            }}
            className="space-y-4"
          >
            {/* Section A: Agent and Account */}
            <div className="space-y-3 pb-3 border-b border-slate-800/80">
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider block font-mono">
                Section A: Agent & Smart Account
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="form-title" className="text-xs text-slate-300 block font-medium">
                    Policy Title <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id="form-title"
                    type="text"
                    required
                    placeholder="e.g. Travel Booking Allowance"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="form-agent" className="text-xs text-slate-300 block font-medium">
                    Agent Address <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id="form-agent"
                    type="text"
                    required
                    placeholder="0x..."
                    value={form.agent}
                    onChange={(e) => setForm({ ...form, agent: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Section B & C: Network, Token & Approved Recipients */}
            <div className="space-y-3 pb-3 border-b border-slate-800/80">
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider block font-mono">
                Section B & C: Token & Recipient Rules
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 block font-medium">Payment Token</label>
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 flex items-center justify-between">
                    <span>Mock USDC (6 Decimals)</span>
                    <span className="text-[10px] text-indigo-400 font-semibold">Verified</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="form-recipient" className="text-xs text-slate-300 block font-medium">
                    Approved Recipient
                  </label>
                  <input
                    id="form-recipient"
                    type="text"
                    disabled={form.allowAnyRecipient}
                    placeholder={form.allowAnyRecipient ? "Any recipient permitted within budget" : "0x..."}
                    value={form.recipient}
                    onChange={(e) => setForm({ ...form, recipient: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      id="form-any-recip"
                      type="checkbox"
                      checked={form.allowAnyRecipient}
                      onChange={(e) => setForm({ ...form, allowAnyRecipient: e.target.checked })}
                      className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="form-any-recip" className="text-[11px] text-slate-400 cursor-pointer">
                      Allow any recipient (enforced by per-tx and cumulative limits)
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Section D, E & F: Limits and Expiry */}
            <div className="space-y-3 pb-3 border-b border-slate-800/80">
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider block font-mono">
                Section D, E & F: Limits & Expiration
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label htmlFor="form-tx-limit" className="text-xs text-slate-300 block font-medium">
                    Max Per Transaction (USDC)
                  </label>
                  <input
                    id="form-tx-limit"
                    type="number"
                    min="1"
                    required
                    value={form.max_amount_per_tx}
                    onChange={(e) => setForm({ ...form, max_amount_per_tx: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="form-cum-limit" className="text-xs text-slate-300 block font-medium">
                    Cumulative Cap (USDC)
                  </label>
                  <input
                    id="form-cum-limit"
                    type="number"
                    min="1"
                    required
                    value={form.max_cumulative_amount}
                    onChange={(e) => setForm({ ...form, max_cumulative_amount: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="form-expiry" className="text-xs text-slate-300 block font-medium">
                    Duration (Days)
                  </label>
                  <input
                    id="form-expiry"
                    type="number"
                    min="1"
                    max="365"
                    required
                    value={form.expiryDays}
                    onChange={(e) => setForm({ ...form, expiryDays: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Proceed to Review (Section G)
              </Button>
            </div>
          </form>
        ) : (
          /* Section G: Review and Confirmation */
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-slate-400">Policy Title:</span>
                <span className="font-semibold text-slate-100">{form.title}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800 font-mono">
                <span className="text-slate-400 font-sans">Smart Account:</span>
                <span className="text-indigo-300">{`${activeSmartAccount.slice(0, 10)}...${activeSmartAccount.slice(-6)}`}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800 font-mono">
                <span className="text-slate-400 font-sans">Authorized Agent:</span>
                <span className="text-slate-200">{form.agent}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800 font-mono">
                <span className="text-slate-400 font-sans">Approved Destination:</span>
                <span className="text-slate-200">
                  {form.allowAnyRecipient ? "Any recipient permitted" : form.recipient}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block font-sans">Per-Tx Ceiling:</span>
                  <span className="text-sm font-bold font-mono text-emerald-400">
                    ${form.max_amount_per_tx} USDC
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block font-sans">Total Cumulative Cap:</span>
                  <span className="text-sm font-bold font-mono text-indigo-400">
                    ${form.max_cumulative_amount} USDC
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-600/30 text-indigo-300 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Activating this mandate records it in the MandateGuard policy engine. You may also sync it on-chain to the smart account contract after creation.
              </span>
            </div>

            <div className="pt-2 flex justify-between gap-3">
              <Button variant="outline" onClick={() => setStep("form")}>
                Back to Edit
              </Button>
              <Button
                variant="primary"
                loading={isSubmitting}
                onClick={handleSubmitForm}
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
              >
                Activate Mandate Policy
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
