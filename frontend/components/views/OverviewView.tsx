"use client";

import React, { useState } from "react";
import {
  Coins,
  FileCheck2,
  ArrowRightLeft,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Sparkles,
  Bot,
  AlertTriangle,
  Play,
  Check,
  Wallet,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { AddressChip } from "../ui/AddressChip";
import { Mandate, PaymentRequestItem, AuditEventItem, SystemHealth } from "../../lib/api";

export interface OverviewViewProps {
  health: SystemHealth | null;
  mandates: Mandate[];
  requests: PaymentRequestItem[];
  auditEvents: AuditEventItem[];
  smartAccountBalance: number | null;
  rpcError: string | null;
  walletAddress?: `0x${string}` | null;
  isMismatch?: boolean;
  onConnectWallet?: () => void;
  agentCount?: number;
  onNavigate: (route: any) => void;
  onOpenCreateMandate: () => void;
  onOpenProvisionAgent?: () => void;
  onOpenSimulator?: () => void;
}

export function OverviewView({
  health,
  mandates,
  requests,
  auditEvents,
  smartAccountBalance,
  rpcError,
  walletAddress,
  isMismatch = false,
  onConnectWallet,
  agentCount = 0,
  onNavigate,
  onOpenCreateMandate,
  onOpenProvisionAgent,
  onOpenSimulator,
}: OverviewViewProps) {
  const activeMandates = mandates.filter((m) => !m.is_revoked && m.remaining_budget > 0);
  const totalAuthorized = mandates.reduce((acc, m) => acc + (m.max_cumulative_amount || 0), 0);
  const totalSpent = mandates.reduce((acc, m) => acc + (m.current_spent || 0), 0);
  const totalReserved = mandates.reduce((acc, m) => acc + (m.reserved_amount || 0), 0);
  const totalAvailable = mandates.reduce((acc, m) => acc + (m.remaining_budget || 0), 0);

  const allowedRequests = requests.filter((r) => r.verdict === 1);
  const deniedRequests = requests.filter((r) => r.verdict === 0);

  // Finding B1: Ground-truth checklist derivation
  const step1Done = agentCount > 0;
  const step2Done = mandates.length > 0;
  const step3Done = requests.length > 0;
  const step4Done = requests.some((r) => r.status === "SETTLED" || r.verdict === 1);
  
  const completedStepsCount = [step1Done, step2Done, step3Done, step4Done].filter(Boolean).length;
  const allStepsComplete = completedStepsCount === 4;

  const [dismissChecklist, setDismissChecklist] = useState(allStepsComplete);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(() => {
    if (!step1Done) return 0;
    if (!step2Done) return 1;
    if (!step3Done) return 2;
    if (!step4Done) return 3;
    return 0;
  });

  const spentPercent = totalAuthorized > 0 ? (totalSpent / totalAuthorized) * 100 : 0;
  const reservedPercent = totalAuthorized > 0 ? (totalReserved / totalAuthorized) * 100 : 0;

  const checklistSteps = [
    {
      id: "agent",
      title: "Provision AI agent",
      desc: "Generate an API key bound to your smart account for cryptographic authorization requests.",
      done: step1Done,
      ctaLabel: "Provision agent",
      action: () => {
        if (onOpenProvisionAgent) onOpenProvisionAgent();
        else onNavigate("agents");
      },
    },
    {
      id: "mandate",
      title: "Define spending mandate",
      desc: "Specify per-transaction limits, cumulative caps, and recipient whitelists.",
      done: step2Done,
      ctaLabel: "Create mandate",
      action: onOpenCreateMandate,
    },
    {
      id: "simulator",
      title: "Simulate payment authorization",
      desc: "Issue an agent payment request and verify the policy engine's signed verdict.",
      done: step3Done,
      ctaLabel: "Launch simulator",
      action: () => {
        onNavigate("requests");
        if (onOpenSimulator) onOpenSimulator();
      },
    },
    {
      id: "verdict",
      title: "Verify cryptographic verdict",
      desc: "Inspect the EIP-712 ECDSA signature mathematically against the authorizer key.",
      done: step4Done,
      ctaLabel: "Verify verdict",
      action: () => onNavigate("verdict"),
    },
  ];

  return (
    <div className="space-y-6">
      {/* RPC Notice */}
      {rpcError && (
        <div
          role="alert"
          className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-[var(--warning-subtle)] border border-[var(--warning-border)] text-xs text-[var(--warning-text)]"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>
            <strong>EVM RPC notice:</strong> On-chain balance query could not be completed ({rpcError}). Telemetry reflects confirmed backend state.
          </span>
        </div>
      )}

      {/* Hero Metric & Stats Grid (Finding D2) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* HERO Metric: Vault Balance (5 cols on desktop) */}
        <div className="lg:col-span-5 p-5 rounded-lg bg-[var(--surface)] border border-[var(--border)] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span className="font-medium text-[var(--text-subtle)]">Smart account vault reserve</span>
              <Coins className="w-4 h-4 text-[var(--text-muted)]" aria-hidden="true" />
            </div>

            {/* Explicit Vault Balance States (Finding B2) */}
            <div className="mt-3">
              {!walletAddress ? (
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-semibold tracking-tight text-[var(--text-subtle)] tabular-nums">
                      --
                    </span>
                    <span className="text-sm font-medium text-[var(--text-subtle)]">USDC</span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    Connect wallet to view verified vault reserve on Base Sepolia.
                  </p>
                  {onConnectWallet && (
                    <div className="pt-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={onConnectWallet}
                        leftIcon={<Wallet className="w-3.5 h-3.5" />}
                      >
                        Connect wallet
                      </Button>
                    </div>
                  )}
                </div>
              ) : isMismatch ? (
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-semibold tracking-tight text-[var(--warning-text)] tabular-nums">
                      Mismatch
                    </span>
                  </div>
                  <p className="text-xs text-[var(--warning-text)]">
                    Wallet is connected to another network. Switch to Base Sepolia (84532) to view on-chain balance.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-semibold tracking-tight text-[var(--text)] tabular-nums">
                      ${smartAccountBalance !== null ? smartAccountBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                    </span>
                    <span className="text-sm font-medium text-[var(--text-subtle)]">USDC</span>
                  </div>
                  <div className="flex items-center gap-2 pt-1 text-[11px] text-[var(--text-muted)]">
                    <span className="w-2 h-2 rounded-full bg-[var(--success)] inline-block" />
                    <span>Verified on-chain · Base Sepolia (84532)</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--text-subtle)]">
            <span>Isolation: EIP-712 Guarded Smart Account</span>
            <span className="tabular-nums">Last checked: Just now</span>
          </div>
        </div>

        {/* 3 Secondary Stats (7 cols on desktop) */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Stat 1: Active Mandates */}
          <div className="p-4 rounded-lg bg-[var(--surface)] border border-[var(--border)] shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span className="font-medium text-[var(--text-subtle)]">Active mandates</span>
                <FileCheck2 className="w-3.5 h-3.5" aria-hidden="true" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold text-[var(--text)] tabular-nums">
                  {activeMandates.length}
                </span>
                <span className="text-xs text-[var(--text-muted)] tabular-nums">
                  / {mandates.length} total
                </span>
              </div>
            </div>
            <div className="mt-3 text-[11px] text-[var(--text-muted)]">
              {mandates.length - activeMandates.length} revoked or exhausted
            </div>
          </div>

          {/* Stat 2: Spent / Authorized */}
          <div className="p-4 rounded-lg bg-[var(--surface)] border border-[var(--border)] shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span className="font-medium text-[var(--text-subtle)]">Spent / Authorized</span>
                <ArrowRightLeft className="w-3.5 h-3.5" aria-hidden="true" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold text-[var(--text)] tabular-nums">
                  ${totalSpent.toLocaleString()}
                </span>
                <span className="text-xs text-[var(--text-muted)] tabular-nums">
                  / ${totalAuthorized.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="mt-3 text-[11px] text-[var(--text-muted)]">
              ${totalReserved.toLocaleString()} reserved in-flight
            </div>
          </div>

          {/* Stat 3: Verdicts */}
          <div className="p-4 rounded-lg bg-[var(--surface)] border border-[var(--border)] shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span className="font-medium text-[var(--text-subtle)]">Authorization verdicts</span>
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              </div>
              <div className="mt-2 flex items-center gap-3">
                <span className="text-xs font-semibold text-[var(--success-text)] flex items-center gap-1.5 tabular-nums">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
                  {allowedRequests.length} ALLOW
                </span>
                <span className="text-xs font-semibold text-[var(--danger-text)] flex items-center gap-1.5 tabular-nums">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--danger)]" />
                  {deniedRequests.length} DENY
                </span>
              </div>
            </div>
            <div className="mt-3 text-[11px] text-[var(--text-muted)]">
              {requests.filter((r) => r.status === "SETTLED").length} settled on-chain
            </div>
          </div>
        </div>
      </div>

      {/* Getting Started Vertical Stepper Card (Finding D4: auto-hide at 4/4) */}
      {!dismissChecklist && !allStepsComplete && (
        <Card className="border-[var(--border)] bg-[var(--surface)]">
          <CardHeader className="py-3 px-5 border-b border-[var(--border)]">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-[var(--accent)]" />
                <div>
                  <CardTitle className="text-xs font-semibold text-[var(--text)]">
                    Setup & Onboarding Progress
                  </CardTitle>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {completedStepsCount} of 4 steps completed
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDismissChecklist(true)}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors px-2 py-1 rounded"
              >
                Dismiss
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-3">
            <div className="space-y-2">
              {checklistSteps.map((step, idx) => {
                const isCurrent = activeStepIndex === idx;
                return (
                  <div
                    key={step.id}
                    className={`rounded-lg border transition-all ${
                      isCurrent
                        ? "border-[var(--border-strong)] bg-[var(--surface-hover)] p-3.5"
                        : "border-[var(--border)] bg-[var(--surface)] p-3 cursor-pointer hover:bg-[var(--surface-hover)]"
                    }`}
                    onClick={() => setActiveStepIndex(idx)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-medium tabular-nums ${
                            step.done
                              ? "bg-[var(--success-subtle)] text-[var(--success-text)] border border-[var(--success-border)]"
                              : isCurrent
                              ? "bg-[var(--accent)] text-white"
                              : "bg-[var(--surface-hover)] text-[var(--text-muted)] border border-[var(--border)]"
                          }`}
                        >
                          {step.done ? <Check className="w-3 h-3" /> : idx + 1}
                        </span>
                        <span
                          className={`text-xs font-medium ${
                            step.done ? "text-[var(--text-muted)] line-through" : "text-[var(--text)]"
                          }`}
                        >
                          {step.title}
                        </span>
                      </div>

                      {step.done ? (
                        <Badge variant="success" size="sm">Completed</Badge>
                      ) : isCurrent ? (
                        <Badge variant="active" size="sm">Next step</Badge>
                      ) : null}
                    </div>

                    {isCurrent && !step.done && (
                      <div className="mt-2.5 pt-2.5 border-t border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-xl">
                          {step.desc}
                        </p>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            step.action();
                          }}
                          rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                        >
                          {step.ctaLabel}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Middle Grid: Budget Utilization + Activity Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Budget Utilization Card (Finding D2: No card-in-card, clean dividers) */}
        <Card className="lg:col-span-2">
          <CardHeader className="py-4 px-5 border-b border-[var(--border)]">
            <div className="flex items-center justify-between w-full">
              <div>
                <CardTitle className="text-sm font-semibold text-[var(--text)]">Budget utilization</CardTitle>
                <CardDescription className="text-xs text-[var(--text-muted)]">
                  Cumulative spending vs authorized buffer across active mandate policies.
                </CardDescription>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onNavigate("mandates")}
              >
                Manage policies
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between text-xs tabular-nums font-sans">
                <span className="text-[var(--text-muted)]">
                  Spent: <strong className="text-[var(--text)] font-semibold">${totalSpent.toFixed(2)}</strong>
                </span>
                <span className="text-[var(--text-muted)]">
                  Remaining buffer: <strong className="text-[var(--text)] font-semibold">${totalAvailable.toFixed(2)} USDC</strong>
                </span>
              </div>

              {/* Slim Stacked Progress Bar */}
              <div className="w-full bg-[var(--surface-hover)] border border-[var(--border)] rounded-full h-2.5 overflow-hidden flex">
                <div
                  className="bg-[var(--accent)] h-full transition-all duration-300"
                  style={{ width: `${Math.min(spentPercent, 100)}%` }}
                  title={`Spent: $${totalSpent.toFixed(2)} (${spentPercent.toFixed(1)}%)`}
                />
                <div
                  className="bg-[var(--warning)] h-full transition-all duration-300"
                  style={{ width: `${Math.min(reservedPercent, 100)}%` }}
                  title={`Reserved: $${totalReserved.toFixed(2)} (${reservedPercent.toFixed(1)}%)`}
                />
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 text-xs text-[var(--text-muted)] pt-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--accent)] inline-block" />
                  <span>Settled ({spentPercent.toFixed(1)}%)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--warning)] inline-block" />
                  <span>In-flight reserved ({reservedPercent.toFixed(1)}%)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--border)] inline-block" />
                  <span>Available reserve</span>
                </span>
              </div>
            </div>

            {/* 3-Column Row Separated by Dividers (NO card-in-card boxes) */}
            <div className="grid grid-cols-3 divide-x divide-[var(--border)] pt-3 border-t border-[var(--border)]">
              <div className="px-3 text-center">
                <span className="text-[11px] text-[var(--text-muted)] block">Total authorized</span>
                <span className="text-sm font-semibold tabular-nums text-[var(--text)] mt-1 block">
                  ${totalAuthorized.toLocaleString()}
                </span>
              </div>
              <div className="px-3 text-center">
                <span className="text-[11px] text-[var(--text-muted)] block">Settled volume</span>
                <span className="text-sm font-semibold tabular-nums text-[var(--success-text)] mt-1 block">
                  ${totalSpent.toLocaleString()}
                </span>
              </div>
              <div className="px-3 text-center">
                <span className="text-[11px] text-[var(--text-muted)] block">Buffer available</span>
                <span className="text-sm font-semibold tabular-nums text-[var(--text)] mt-1 block">
                  ${totalAvailable.toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System & Verification Status Card */}
        <Card>
          <CardHeader className="py-4 px-5 border-b border-[var(--border)]">
            <CardTitle className="text-sm font-semibold text-[var(--text)]">Guard telemetry</CardTitle>
            <CardDescription className="text-xs text-[var(--text-muted)]">
              Live authorization engine state.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-3.5 text-xs">
            <div className="flex items-center justify-between pb-2.5 border-b border-[var(--border)]">
              <span className="text-[var(--text-muted)]">Policy engine</span>
              <Badge variant={health?.status === "healthy" ? "success" : "danger"} size="sm">
                {health?.status === "healthy" ? "Healthy" : "Offline"}
              </Badge>
            </div>

            <div className="flex items-center justify-between pb-2.5 border-b border-[var(--border)]">
              <span className="text-[var(--text-muted)]">Signing key mode</span>
              <Badge variant="warning" size="sm">
                Software key (dev)
              </Badge>
            </div>

            <div className="flex items-center justify-between pb-2.5 border-b border-[var(--border)]">
              <span className="text-[var(--text-muted)]">Active chain</span>
              <span className="font-semibold text-[var(--text)]">Base Sepolia</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[var(--text-muted)]">Settlement asset</span>
              <span className="font-semibold text-[var(--text)]">USDC (6 decimals)</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
