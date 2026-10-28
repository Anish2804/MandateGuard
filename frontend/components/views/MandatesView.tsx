"use client";

import React, { useState } from "react";
import {
  FileCheck2,
  PlusCircle,
  Search,
  Filter,
  Check,
  Clock,
  Coins,
  ShieldAlert,
  ArrowRight,
  Layers,
  Trash2,
  AlertTriangle,
  ChevronRight,
  CheckCircle2,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Drawer } from "../ui/Drawer";
import { AddressChip } from "../ui/AddressChip";
import { EmptyState } from "../ui/EmptyState";
import { Mandate } from "../../lib/api";
import { getContractAddresses, DEFAULT_CHAIN_ID } from "../../lib/contracts";

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
    chain_id?: number;
    expiry: number;
  }) => Promise<Mandate>;
  onRevokeMandate: (mandateId: string) => Promise<Mandate>;
  onRegisterOnChain: (mandate: Mandate) => Promise<string>;
  onRevokeOnChain: (mandateId: string) => Promise<string>;
  isCreateOpen?: boolean;
  onCloseCreate?: () => void;
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
  isCreateOpen = false,
  onCloseCreate,
}: MandatesViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "exhausted" | "revoked">("all");
  const [selectedMandate, setSelectedMandate] = useState<Mandate | null>(null);
  const [drawerTab, setDrawerTab] = useState<"overview" | "rules" | "json">("overview");
  const [copiedJson, setCopiedJson] = useState(false);
  const [showCreateDrawer, setShowCreateDrawer] = useState(isCreateOpen);

  // Stepper State: 1 (Basics) -> 2 (Limits) -> 3 (Recipients) -> 4 (Review)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
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

  const counts = {
    all: mandates.length,
    active: mandates.filter((m) => !m.is_revoked && m.remaining_budget > 0).length,
    exhausted: mandates.filter((m) => !m.is_revoked && m.remaining_budget <= 0).length,
    revoked: mandates.filter((m) => m.is_revoked).length,
  };

  const filteredMandates = mandates.filter((m) => {
    const matchesSearch =
      m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.agent.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === "all") return true;
    if (statusFilter === "active") return !m.is_revoked && m.remaining_budget > 0;
    if (statusFilter === "exhausted") return !m.is_revoked && m.remaining_budget <= 0;
    if (statusFilter === "revoked") return m.is_revoked;
    return true;
  });

  const handleRevoke = async (mandateId: string, title: string) => {
    if (!confirm(`Revoke policy "${title}"? Any subsequent payment requests under this mandate will be denied.`)) {
      return;
    }
    setActionLoadingId(mandateId);
    try {
      await onRevokeMandate(mandateId);
      if (selectedMandate?.id === mandateId) {
        setSelectedMandate(null);
      }
      onRefresh();
    } catch (err: any) {
      alert(`Revocation failed: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSyncOnChain = async (mandate: Mandate) => {
    if (!walletAddress) {
      alert("Please connect your Web3 wallet to sign the on-chain registration transaction.");
      return;
    }
    setActionLoadingId(`onchain-${mandate.id}`);
    try {
      const txHash = await onRegisterOnChain(mandate);
      alert(`Policy registered on-chain. Tx: ${txHash}`);
      onRefresh();
    } catch (err: any) {
      alert(`On-chain registration failed: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const expiryTimestamp = currentTimestamp + form.expiryDays * 86400;
      const currentChainId = walletChainId || DEFAULT_CHAIN_ID;
      const addresses = getContractAddresses(currentChainId);

      await onCreateMandate({
        title: form.title.trim(),
        account: activeSmartAccount,
        agent: form.agent.trim(),
        token: addresses.usdc,
        recipient: form.allowAnyRecipient ? null : form.recipient.trim() || null,
        max_amount_per_tx: Number(form.max_amount_per_tx),
        max_cumulative_amount: Number(form.max_cumulative_amount),
        chain_id: currentChainId,
        expiry: expiryTimestamp,
      });

      setShowCreateDrawer(false);
      if (onCloseCreate) onCloseCreate();
      setCurrentStep(1);
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
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2 max-w-xl">
          {/* Finding D7: search input min 280px */}
          <div className="relative flex-1 min-w-[280px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search mandates by title, ID, or agent address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded pl-8 pr-3 py-1.5 text-xs text-[var(--text)] placeholder-[var(--text-subtle)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          {/* Finding D7: segmented control height 32px with counts */}
          <div className="flex items-center gap-1 bg-[var(--surface)] border border-[var(--border)] rounded p-0.5 text-xs h-8">
            {(
              [
                { id: "all", label: "All", count: counts.all },
                { id: "active", label: "Active", count: counts.active },
                { id: "exhausted", label: "Exhausted", count: counts.exhausted },
                { id: "revoked", label: "Revoked", count: counts.revoked },
              ] as const
            ).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStatusFilter(s.id)}
                className={`px-2.5 h-full rounded capitalize text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  statusFilter === s.id
                    ? "bg-[var(--surface-hover)] text-[var(--text)] font-semibold shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                <span>{s.label}</span>
                <span className="text-[10px] px-1 py-0.2 rounded bg-[var(--surface-raised)] text-[var(--text-muted)] tabular-nums">
                  {s.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Finding A4: Only show header CTA if there are filtered items. When 0, empty state provides the CTA */}
        {filteredMandates.length > 0 && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setCurrentStep(1);
              setShowCreateDrawer(true);
            }}
            leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
          >
            Create mandate
          </Button>
        )}
      </div>

      {/* Main Table */}
      <Card>
        <CardContent className="p-0">
          {filteredMandates.length === 0 ? (
            <EmptyState
              icon={<FileCheck2 className="w-4 h-4" />}
              title="No spending mandates found"
              description="Define spending limits and recipient boundaries for autonomous agents."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setCurrentStep(1);
                    setShowCreateDrawer(true);
                  }}
                >
                  Create mandate
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-left text-xs" aria-label="Mandate policies table">
                <thead className="bg-[var(--surface-raised)] border-b border-[var(--border)] text-[var(--text-muted)] text-xs font-medium sticky top-0 z-10">
                  <tr>
                    <th scope="col" className="px-4 py-3">Policy</th>
                    <th scope="col" className="px-4 py-3">Agent</th>
                    <th scope="col" className="px-4 py-3">Per-tx / Cap</th>
                    <th scope="col" className="px-4 py-3">Budget progress</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredMandates.map((m) => {
                    const isRevoked = m.is_revoked;
                    const isExhausted = !m.is_revoked && m.remaining_budget <= 0;
                    const spentPct = m.max_cumulative_amount > 0 ? (m.current_spent / m.max_cumulative_amount) * 100 : 0;

                    return (
                      <tr
                        key={m.id}
                        onClick={() => {
                          setSelectedMandate(m);
                          setDrawerTab("overview");
                        }}
                        className="hover:bg-[var(--surface-hover)] transition-colors cursor-pointer h-10"
                      >
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-[var(--text)] tracking-tight">
                            {m.title}
                          </div>
                          <div className="mt-0.5">
                            <AddressChip address={m.id} truncateLength={4} />
                          </div>
                        </td>

                        <td className="px-4 py-2.5">
                          <AddressChip address={m.agent} truncateLength={4} />
                        </td>

                        <td className="px-4 py-2.5 tabular-nums">
                          <span className="font-semibold text-[var(--text)]">${m.max_amount_per_tx}</span>
                          <span className="text-[var(--text-muted)]"> / ${m.max_cumulative_amount} USDC</span>
                        </td>

                        <td className="px-4 py-2.5">
                          <div className="w-32 space-y-1 text-[11px] tabular-nums">
                            <div className="flex justify-between text-[var(--text-muted)] text-[10px]">
                              <span>${m.current_spent.toFixed(0)} spent</span>
                              <span>${m.remaining_budget.toFixed(0)} left</span>
                            </div>
                            <div className="w-full bg-[var(--surface-hover)] border border-[var(--border)] rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-[var(--accent)] h-full transition-all"
                                style={{ width: `${Math.min(spentPct, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-2.5">
                          {isRevoked ? (
                            <Badge variant="danger" size="sm">Revoked</Badge>
                          ) : isExhausted ? (
                            <Badge variant="warning" size="sm">Exhausted</Badge>
                          ) : (
                            <Badge variant="success" size="sm">Active (v{m.version})</Badge>
                          )}
                        </td>

                        <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-[11px] h-7 px-2"
                              onClick={() => {
                                setSelectedMandate(m);
                                setDrawerTab("overview");
                              }}
                            >
                              Details
                            </Button>
                            {!isRevoked && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-[var(--danger-text)] hover:bg-[var(--danger-subtle)] text-[11px] h-7 px-2"
                                loading={actionLoadingId === m.id}
                                onClick={() => handleRevoke(m.id, m.title)}
                              >
                                Revoke
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Row Detail Drawer (Finding E2: 3-tab drawer) */}
      <Drawer
        isOpen={!!selectedMandate}
        onClose={() => setSelectedMandate(null)}
        title={selectedMandate?.title || "Policy details"}
        description={selectedMandate ? `Mandate ID: ${selectedMandate.id}` : ""}
        width="md"
        footer={
          selectedMandate && (
            <div className="flex items-center justify-between w-full">
              <Button
                variant="secondary"
                size="sm"
                loading={actionLoadingId === `onchain-${selectedMandate.id}`}
                onClick={() => handleSyncOnChain(selectedMandate)}
                leftIcon={<Layers className="w-3.5 h-3.5" />}
              >
                Sync on-chain
              </Button>

              {!selectedMandate.is_revoked && (
                <Button
                  variant="destructive"
                  size="sm"
                  loading={actionLoadingId === selectedMandate.id}
                  onClick={() => handleRevoke(selectedMandate.id, selectedMandate.title)}
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                >
                  Revoke policy
                </Button>
              )}
            </div>
          )
        }
      >
        {selectedMandate && (
          <div className="space-y-4">
            {/* Drawer Tabs */}
            <div className="flex border-b border-[var(--border)] gap-2">
              <button
                type="button"
                onClick={() => setDrawerTab("overview")}
                className={`pb-2.5 text-xs font-medium border-b-2 transition-colors ${
                  drawerTab === "overview"
                    ? "border-[var(--accent)] text-[var(--text)] font-semibold"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => setDrawerTab("rules")}
                className={`pb-2.5 text-xs font-medium border-b-2 transition-colors ${
                  drawerTab === "rules"
                    ? "border-[var(--accent)] text-[var(--text)] font-semibold"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                Rules & limits
              </button>
              <button
                type="button"
                onClick={() => setDrawerTab("json")}
                className={`pb-2.5 text-xs font-medium border-b-2 transition-colors ${
                  drawerTab === "json"
                    ? "border-[var(--accent)] text-[var(--text)] font-semibold"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                Raw JSON
              </button>
            </div>

            {/* TAB 1: OVERVIEW */}
            {drawerTab === "overview" && (
              <div className="space-y-4">
                {/* Status overview */}
                <div className="p-3.5 rounded-lg bg-[var(--surface-raised)] border border-[var(--border)] flex items-center justify-between">
                  <span className="text-xs text-[var(--text-muted)]">Policy status</span>
                  {selectedMandate.is_revoked ? (
                    <Badge variant="danger" size="md">Revoked</Badge>
                  ) : selectedMandate.remaining_budget <= 0 ? (
                    <Badge variant="warning" size="md">Exhausted</Badge>
                  ) : (
                    <Badge variant="success" size="md">Active (Version {selectedMandate.version})</Badge>
                  )}
                </div>

                {/* Budget Breakdown */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-[var(--text)] block">Budget allocation</span>
                  <div className="p-3.5 rounded-lg bg-[var(--surface-raised)] border border-[var(--border)] space-y-2.5">
                    <div className="flex justify-between text-xs tabular-nums">
                      <span className="text-[var(--text-muted)]">Spent: ${selectedMandate.current_spent.toFixed(2)}</span>
                      <span className="font-semibold text-[var(--text)]">Limit: ${selectedMandate.max_cumulative_amount.toFixed(2)} USDC</span>
                    </div>
                    <div className="w-full bg-[var(--surface-hover)] border border-[var(--border)] rounded-full h-2 overflow-hidden flex">
                      <div
                        className="bg-[var(--accent)] h-full"
                        style={{
                          width: `${(selectedMandate.current_spent / selectedMandate.max_cumulative_amount) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-[var(--warning)] h-full"
                        style={{
                          width: `${(selectedMandate.reserved_amount / selectedMandate.max_cumulative_amount) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-[var(--text-muted)] tabular-nums">
                      <span>Reserved: ${selectedMandate.reserved_amount.toFixed(2)}</span>
                      <span className="text-[var(--success-text)] font-semibold">Available: ${selectedMandate.remaining_budget.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: RULES & LIMITS */}
            {drawerTab === "rules" && (
              <div className="space-y-2">
                <div className="p-4 rounded-lg bg-[var(--surface-raised)] border border-[var(--border)] space-y-2.5 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-[var(--border)]">
                    <span className="text-[var(--text-muted)]">Per-tx ceiling:</span>
                    <span className="font-semibold text-[var(--text)] tabular-nums">${selectedMandate.max_amount_per_tx.toFixed(2)} USDC</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[var(--border)]">
                    <span className="text-[var(--text-muted)]">Authorized agent:</span>
                    <AddressChip address={selectedMandate.agent} truncateLength={6} />
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[var(--border)]">
                    <span className="text-[var(--text-muted)]">Allowed destination:</span>
                    {selectedMandate.recipient ? (
                      <AddressChip address={selectedMandate.recipient} truncateLength={6} />
                    ) : (
                      <span className="text-[var(--text)]">Any recipient</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[var(--border)]">
                    <span className="text-[var(--text-muted)]">Smart account:</span>
                    <AddressChip address={selectedMandate.account} truncateLength={6} />
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-[var(--text-muted)]">Expiry timestamp:</span>
                    <span className="text-[var(--text)] tabular-nums">
                      {new Date(selectedMandate.expiry * 1000).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: RAW JSON */}
            {drawerTab === "json" && (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(selectedMandate, null, 2));
                      setCopiedJson(true);
                      setTimeout(() => setCopiedJson(false), 2000);
                    }}
                  >
                    {copiedJson ? "Copied" : "Copy JSON"}
                  </Button>
                </div>
                <pre className="p-3.5 rounded-lg bg-[var(--surface-raised)] border border-[var(--border)] font-mono text-[11px] text-[var(--text)] overflow-x-auto max-h-80 select-all leading-relaxed">
                  {JSON.stringify(selectedMandate, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Create Mandate Stepper Drawer */}
      <Drawer
        isOpen={showCreateDrawer}
        onClose={() => {
          setShowCreateDrawer(false);
          if (onCloseCreate) onCloseCreate();
        }}
        title="Create mandate policy"
        description="Configure spending limits, ceilings, and recipient rules for autonomous agents."
        width="md"
        footer={
          <div className="flex items-center justify-between w-full">
            {currentStep > 1 ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
              >
                Back
              </Button>
            ) : <span />}

            {currentStep < 4 ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  if (currentStep === 1 && (!form.title.trim() || !form.agent.trim())) {
                    alert("Please provide a title and agent address.");
                    return;
                  }
                  if (currentStep === 2 && form.max_amount_per_tx > form.max_cumulative_amount) {
                    alert("Per-transaction limit cannot exceed cumulative spending limit.");
                    return;
                  }
                  setCurrentStep((prev) => (prev + 1) as any);
                }}
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                Next: {currentStep === 1 ? "Limits" : currentStep === 2 ? "Recipients" : "Review"}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                loading={isSubmitting}
                onClick={handleSubmit}
                leftIcon={<Check className="w-3.5 h-3.5" />}
              >
                Activate mandate
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          {/* Stepper Progress */}
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] text-[11px] font-medium text-[var(--text-muted)]">
            {[
              { num: 1, label: "Basics" },
              { num: 2, label: "Limits" },
              { num: 3, label: "Recipients" },
              { num: 4, label: "Review" },
            ].map((s) => (
              <div
                key={s.num}
                className={`flex items-center gap-1.5 ${
                  currentStep === s.num
                    ? "text-[var(--accent-text)] font-semibold"
                    : currentStep > s.num
                    ? "text-[var(--text)]"
                    : "text-[var(--text-subtle)]"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                    currentStep === s.num
                      ? "bg-[var(--accent)] text-white"
                      : currentStep > s.num
                      ? "bg-[var(--surface-hover)] border border-[var(--border)]"
                      : "bg-[var(--surface-hover)] text-[var(--text-subtle)]"
                  }`}
                >
                  {s.num}
                </span>
                <span>{s.label}</span>
              </div>
            ))}
          </div>

          {/* Step 1: Basics */}
          {currentStep === 1 && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="m-title" className="text-xs font-medium text-[var(--text)] block">
                  Policy title <span className="text-[var(--danger-text)]">*</span>
                </label>
                <input
                  id="m-title"
                  type="text"
                  required
                  placeholder="e.g. Server Infrastructure Allowance"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-3 py-1.5 text-xs text-[var(--text)] placeholder-[var(--text-subtle)] focus:outline-none focus:border-[var(--border-strong)]"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="m-agent" className="text-xs font-medium text-[var(--text)] block">
                  Authorized agent address <span className="text-[var(--danger-text)]">*</span>
                </label>
                <input
                  id="m-agent"
                  type="text"
                  required
                  placeholder="0x..."
                  value={form.agent}
                  onChange={(e) => setForm({ ...form, agent: e.target.value })}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-3 py-1.5 text-xs font-mono text-[var(--text)] placeholder-[var(--text-subtle)] focus:outline-none focus:border-[var(--border-strong)]"
                />
              </div>

              <div className="p-2.5 rounded bg-[var(--surface-hover)] border border-[var(--border)] text-xs text-[var(--text-muted)] space-y-1">
                <span className="font-semibold text-[var(--text)] block">Account isolation</span>
                <span>This mandate will bind exclusively to smart account <code>{activeSmartAccount.slice(0, 8)}...</code>.</span>
              </div>
            </div>
          )}

          {/* Step 2: Limits */}
          {currentStep === 2 && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="m-tx-limit" className="text-xs font-medium text-[var(--text)] block">
                  Per-transaction limit (USDC)
                </label>
                <input
                  id="m-tx-limit"
                  type="number"
                  min="1"
                  required
                  value={form.max_amount_per_tx}
                  onChange={(e) => setForm({ ...form, max_amount_per_tx: Number(e.target.value) })}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-3 py-1.5 text-xs font-mono tabular-nums text-[var(--text)] focus:outline-none focus:border-[var(--border-strong)]"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="m-cum-limit" className="text-xs font-medium text-[var(--text)] block">
                  Cumulative spending cap (USDC)
                </label>
                <input
                  id="m-cum-limit"
                  type="number"
                  min="1"
                  required
                  value={form.max_cumulative_amount}
                  onChange={(e) => setForm({ ...form, max_cumulative_amount: Number(e.target.value) })}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-3 py-1.5 text-xs font-mono tabular-nums text-[var(--text)] focus:outline-none focus:border-[var(--border-strong)]"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="m-expiry" className="text-xs font-medium text-[var(--text)] block">
                  Validity duration (days)
                </label>
                <input
                  id="m-expiry"
                  type="number"
                  min="1"
                  max="365"
                  required
                  value={form.expiryDays}
                  onChange={(e) => setForm({ ...form, expiryDays: Number(e.target.value) })}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-3 py-1.5 text-xs font-mono tabular-nums text-[var(--text)] focus:outline-none focus:border-[var(--border-strong)]"
                />
              </div>

              {form.max_amount_per_tx > form.max_cumulative_amount && (
                <div className="p-2 rounded bg-[var(--danger-subtle)] border border-[var(--danger-border)] text-xs text-[var(--danger-text)]">
                  Per-transaction limit cannot exceed cumulative spending cap.
                </div>
              )}
            </div>
          )}

          {/* Step 3: Recipients */}
          {currentStep === 3 && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="m-recipient" className="text-xs font-medium text-[var(--text)] block">
                  Approved recipient address
                </label>
                <input
                  id="m-recipient"
                  type="text"
                  disabled={form.allowAnyRecipient}
                  placeholder={form.allowAnyRecipient ? "Any recipient permitted within budget" : "0x..."}
                  value={form.recipient}
                  onChange={(e) => setForm({ ...form, recipient: e.target.value })}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-3 py-1.5 text-xs font-mono text-[var(--text)] placeholder-[var(--text-subtle)] disabled:opacity-40 focus:outline-none focus:border-[var(--border-strong)]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="m-any-recip"
                  type="checkbox"
                  checked={form.allowAnyRecipient}
                  onChange={(e) => setForm({ ...form, allowAnyRecipient: e.target.checked })}
                  className="rounded border-[var(--border)] text-[var(--accent)]"
                />
                <label htmlFor="m-any-recip" className="text-xs text-[var(--text)] cursor-pointer select-none">
                  Allow any recipient within budget bounds
                </label>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {currentStep === 4 && (
            <div className="space-y-3">
              <div className="p-3 rounded bg-[var(--surface-hover)] border border-[var(--border)] text-xs space-y-2">
                <span className="font-semibold text-[var(--text)] block">Human-readable policy summary:</span>
                <p className="leading-relaxed text-[var(--text)]">
                  Agent <strong className="font-mono">{form.agent.slice(0, 8)}...</strong> can spend up to{" "}
                  <strong className="font-mono text-[var(--success-text)]">${form.max_cumulative_amount}.00 USDC</strong> total, with a maximum of{" "}
                  <strong className="font-mono">${form.max_amount_per_tx}.00 USDC</strong> per payment,{" "}
                  {form.allowAnyRecipient ? (
                    "payable to any recipient"
                  ) : (
                    <span>only to recipient <strong className="font-mono">{form.recipient.slice(0, 8)}...</strong></span>
                  )}
                  , valid for {form.expiryDays} days.
                </p>
              </div>

              <div className="p-2.5 rounded bg-[var(--info-subtle)] border border-[var(--info-border)] text-xs text-[var(--info-text)] flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Activating records this policy in the MandateGuard engine. You can also sync it directly on-chain on your smart account.
                </span>
              </div>
            </div>
          )}
        </div>
      </Drawer>
    </div>
  );
}
