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

  // Getting started checklist evaluation
  const step1Done = Boolean(health?.authorizer_signer);
  const step2Done = mandates.length > 0;
  const step3Done = requests.length > 0;
  const step4Done = requests.some((r) => r.status === "SETTLED");
  const allStepsComplete = step1Done && step2Done && step3Done && step4Done;

  const [dismissChecklist, setDismissChecklist] = useState(allStepsComplete);

  const spentPercent = totalAuthorized > 0 ? (totalSpent / totalAuthorized) * 100 : 0;
  const reservedPercent = totalAuthorized > 0 ? (totalReserved / totalAuthorized) * 100 : 0;

  return (
    <div className="space-y-5">
      {/* RPC Offline Notice if applicable */}
      {rpcError && (
        <div
          role="alert"
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-md bg-[var(--warning-subtle)] border border-[var(--warning-border)] text-xs text-[var(--warning-text)]"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>
            <strong>EVM RPC notice:</strong> On-chain balance query could not be completed ({rpcError}). Metric displays are limited to confirmed backend data.
          </span>
        </div>
      )}

      {/* 4-Stat Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Stat 1: Vault Balance */}
        <div className="p-3.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] text-xs">
            <span>Vault balance</span>
            <Coins className="w-3.5 h-3.5" aria-hidden="true" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            {smartAccountBalance !== null ? (
              <span className="text-xl font-semibold font-mono tabular-nums text-[var(--text)] tracking-tight">
                ${smartAccountBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            ) : (
              <span className="text-xs font-mono text-[var(--text-subtle)] italic">
                Offline
              </span>
            )}
            <span className="text-xs text-[var(--text-subtle)] font-medium">USDC</span>
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-muted)]">
            Verified on-chain reserve
          </div>
        </div>

        {/* Stat 2: Active Mandates */}
        <div className="p-3.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] text-xs">
            <span>Active mandates</span>
            <FileCheck2 className="w-3.5 h-3.5 text-[var(--text-muted)]" aria-hidden="true" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-xl font-semibold font-mono tabular-nums text-[var(--text)] tracking-tight">
              {activeMandates.length}
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">
              / {mandates.length} total
            </span>
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-muted)]">
            {mandates.length - activeMandates.length} revoked or expired
          </div>
        </div>

        {/* Stat 3: Spent / Authorized */}
        <div className="p-3.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] text-xs">
            <span>Spent / Authorized</span>
            <ArrowRightLeft className="w-3.5 h-3.5 text-[var(--text-muted)]" aria-hidden="true" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-xl font-semibold font-mono tabular-nums text-[var(--text)] tracking-tight">
              ${totalSpent.toLocaleString()}
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">
              / ${totalAuthorized.toLocaleString()}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-muted)]">
            ${totalReserved.toLocaleString()} reserved in-flight
          </div>
        </div>

        {/* Stat 4: Verdicts Allow / Deny */}
        <div className="p-3.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] text-xs">
            <span>Verdicts</span>
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--text-muted)]" aria-hidden="true" />
          </div>
          <div className="mt-1.5 flex items-center gap-3">
            <span className="text-xs font-mono font-medium text-[var(--success-text)] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
              {allowedRequests.length} ALLOW
            </span>
            <span className="text-xs font-mono font-medium text-[var(--danger-text)] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--danger)]" />
              {deniedRequests.length} DENY
            </span>
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-muted)]">
            {requests.filter((r) => r.status === "SETTLED").length} settled on-chain
          </div>
        </div>
      </div>

      {/* Getting Started Checklist (Auto-hides when complete, or dismissible) */}
      {!dismissChecklist && (
        <Card className="border-[var(--border)] bg-[var(--surface)]">
          <CardHeader className="py-2.5">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
                <CardTitle className="text-xs">Getting started with MandateGuard</CardTitle>
              </div>
              <button
                type="button"
                onClick={() => setDismissChecklist(true)}
                className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              >
                Dismiss
              </button>
            </div>
          </CardHeader>
          <CardContent className="py-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
              <div
                onClick={() => onNavigate("agents")}
                className={`p-2.5 rounded border transition-colors cursor-pointer ${
                  step1Done
                    ? "bg-[var(--success-subtle)] border-[var(--success-border)] text-[var(--success-text)]"
                    : "bg-[var(--surface-hover)] border-[var(--border)] text-[var(--text)]"
                }`}
              >
                <div className="flex items-center gap-1.5 font-medium">
                  {step1Done ? <Check className="w-3.5 h-3.5" /> : <span className="font-mono text-[10px]">1.</span>}
                  <span>Provision agent</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">Bind agent API key to account</p>
              </div>

              <div
                onClick={onOpenCreateMandate}
                className={`p-2.5 rounded border transition-colors cursor-pointer ${
                  step2Done
                    ? "bg-[var(--success-subtle)] border-[var(--success-border)] text-[var(--success-text)]"
                    : "bg-[var(--surface-hover)] border-[var(--border)] text-[var(--text)]"
                }`}
              >
                <div className="flex items-center gap-1.5 font-medium">
                  {step2Done ? <Check className="w-3.5 h-3.5" /> : <span className="font-mono text-[10px]">2.</span>}
                  <span>Create mandate</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">Define spending bounds</p>
              </div>

              <div
                onClick={() => {
                  onNavigate("requests");
                  if (onOpenSimulator) onOpenSimulator();
                }}
                className={`p-2.5 rounded border transition-colors cursor-pointer ${
                  step3Done
                    ? "bg-[var(--success-subtle)] border-[var(--success-border)] text-[var(--success-text)]"
                    : "bg-[var(--surface-hover)] border-[var(--border)] text-[var(--text)]"
                }`}
              >
                <div className="flex items-center gap-1.5 font-medium">
                  {step3Done ? <Check className="w-3.5 h-3.5" /> : <span className="font-mono text-[10px]">3.</span>}
                  <span>Simulate payment</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">Test policy evaluation</p>
              </div>

              <div
                onClick={() => onNavigate("verdict")}
                className={`p-2.5 rounded border transition-colors cursor-pointer ${
                  step4Done
                    ? "bg-[var(--success-subtle)] border-[var(--success-border)] text-[var(--success-text)]"
                    : "bg-[var(--surface-hover)] border-[var(--border)] text-[var(--text)]"
                }`}
              >
                <div className="flex items-center gap-1.5 font-medium">
                  {step4Done ? <Check className="w-3.5 h-3.5" /> : <span className="font-mono text-[10px]">4.</span>}
                  <span>Verify verdict</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">Inspect EIP-712 signature</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Middle Grid: Budget Utilization + System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Budget Utilization Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <div>
                <CardTitle>Budget utilization</CardTitle>
                <CardDescription>
                  Cumulative spending across all active mandate policies.
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
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono tabular-nums">
                <span className="text-[var(--text-muted)]">
                  Spent: <strong className="text-[var(--text)] font-semibold">${totalSpent.toFixed(2)}</strong>
                </span>
                <span className="text-[var(--text-muted)]">
                  Remaining: <strong className="text-[var(--text)] font-semibold">${totalAvailable.toFixed(2)} USDC</strong>
                </span>
              </div>

              {/* Slim Stacked Progress Bar */}
              <div className="w-full bg-[var(--surface-hover)] border border-[var(--border)] rounded-full h-2 overflow-hidden flex">
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

              {/* Clean Legend */}
              <div className="flex items-center gap-4 text-[11px] text-[var(--text-muted)] pt-0.5">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--accent)] inline-block" />
                  <span>Spent ({spentPercent.toFixed(1)}%)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--warning)] inline-block" />
                  <span>Reserved ({reservedPercent.toFixed(1)}%)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--border)] inline-block" />
                  <span>Available buffer</span>
                </span>
              </div>
            </div>

            {/* Quick Metrics Key-Value List */}
            <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-[var(--border)] text-center text-xs">
              <div className="p-2.5 rounded bg-[var(--surface-hover)] border border-[var(--border)]">
                <span className="text-[11px] text-[var(--text-muted)] block">Total authorized</span>
                <span className="font-semibold font-mono tabular-nums text-[var(--text)] mt-0.5 block">
                  ${totalAuthorized.toLocaleString()}
                </span>
              </div>
              <div className="p-2.5 rounded bg-[var(--surface-hover)] border border-[var(--border)]">
                <span className="text-[11px] text-[var(--text-muted)] block">Settled volume</span>
                <span className="font-semibold font-mono tabular-nums text-[var(--success-text)] mt-0.5 block">
                  ${totalSpent.toLocaleString()}
                </span>
              </div>
              <div className="p-2.5 rounded bg-[var(--surface-hover)] border border-[var(--border)]">
                <span className="text-[11px] text-[var(--text-muted)] block">Buffer available</span>
                <span className="font-semibold font-mono tabular-nums text-[var(--text)] mt-0.5 block">
                  ${totalAvailable.toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Status Key-Value List */}
        <Card>
          <CardHeader>
            <CardTitle>System status</CardTitle>
            <CardDescription>Core security service parameters.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-[var(--border)]">
              <span className="text-[var(--text-muted)]">Signing service</span>
              <span className="font-mono text-[var(--text)] text-[11px]">
                {health?.authorizer_signer ? (
                  <AddressChip address={health.authorizer_signer} truncateLength={4} />
                ) : (
                  <span className="text-[var(--danger-text)]">Offline</span>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-[var(--border)]">
              <span className="text-[var(--text-muted)]">Database</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-[var(--success-text)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
                <span>Connected</span>
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-[var(--border)]">
              <span className="text-[var(--text-muted)]">Chain ID</span>
              <span className="font-mono font-medium text-[var(--text)]">
                {health?.chain_id ?? "84532"}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-[var(--border)]">
              <span className="text-[var(--text-muted)]">Version</span>
              <span className="font-mono text-[var(--text-muted)]">
                {health?.version ?? "v0.1.0"}
              </span>
            </div>

            <div className="pt-2">
              <Button
                variant="primary"
                size="sm"
                className="w-full justify-center"
                onClick={onOpenCreateMandate}
              >
                Create new mandate
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <div>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>
                Chronological stream of authorization decisions and security events.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate("audit")}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Full audit trail
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {auditEvents.length === 0 ? (
            <div className="text-center py-8 text-xs text-[var(--text-muted)]">
              No recent events recorded.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs" aria-label="Recent activity table">
                <thead className="bg-[var(--surface-hover)] border-b border-[var(--border)] text-[var(--text-muted)] font-medium">
                  <tr>
                    <th scope="col" className="px-4 py-2.5">Time</th>
                    <th scope="col" className="px-4 py-2.5">Event</th>
                    <th scope="col" className="px-4 py-2.5">Mandate reference</th>
                    <th scope="col" className="px-4 py-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] font-mono text-[11px]">
                  {auditEvents.slice(0, 5).map((evt) => (
                    <tr key={evt.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                      <td className="px-4 py-2.5 text-[var(--text-muted)] font-sans">
                        {evt.created_at ? new Date(evt.created_at).toLocaleTimeString() : "-"}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-[var(--text)]">
                        {evt.event_type}
                      </td>
                      <td className="px-4 py-2.5 text-[var(--text-muted)]">
                        {evt.mandate_id ? (
                          <AddressChip address={evt.mandate_id} truncateLength={4} />
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-sans">
                        <Badge
                          variant={
                            evt.event_type.includes("CREATED") || evt.event_type.includes("AUTHORIZED")
                              ? "success"
                              : evt.event_type.includes("DENIED") || evt.event_type.includes("REVOKED")
                              ? "danger"
                              : "neutral"
                          }
                          size="sm"
                        >
                          {evt.event_type.includes("DENIED") ? "Denied" : "Recorded"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
