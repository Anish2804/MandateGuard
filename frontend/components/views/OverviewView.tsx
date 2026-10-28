"use client";

import React from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Coins,
  ArrowRightLeft,
  FileCheck2,
  Lock,
  Server,
  Activity,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { StatusBeacon } from "../ui/StatusBeacon";
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
}: OverviewViewProps) {
  // Compute real derived metrics (strict data integrity: derived only from actual data)
  const activeMandates = mandates.filter((m) => !m.is_revoked && m.remaining_budget > 0);
  const totalAuthorized = mandates.reduce((acc, m) => acc + (m.max_cumulative_amount || 0), 0);
  const totalSpent = mandates.reduce((acc, m) => acc + (m.current_spent || 0), 0);
  const totalReserved = mandates.reduce((acc, m) => acc + (m.reserved_amount || 0), 0);
  const totalAvailable = mandates.reduce((acc, m) => acc + (m.remaining_budget || 0), 0);

  const allowedRequests = requests.filter((r) => r.verdict === 1);
  const deniedRequests = requests.filter((r) => r.verdict === 0);
  const settledRequests = requests.filter((r) => r.status === "SETTLED");

  return (
    <div className="space-y-6">
      {/* RPC Offline Alert if balance cannot be verified */}
      {rpcError && (
        <div
          role="alert"
          className="flex items-center gap-3 p-4 rounded-xl bg-amber-950/40 border border-amber-600/40 text-amber-300 text-sm"
        >
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" aria-hidden="true" />
          <div className="flex-1">
            <span className="font-semibold">EVM RPC Notice:</span>{" "}
            <span>Live on-chain balance query could not be completed ({rpcError}). Metric displays are limited to confirmed backend data.</span>
          </div>
        </div>
      )}

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Vault Balance */}
        <Card hoverEffect>
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Vault Token Balance</span>
              <Coins className="w-4 h-4 text-emerald-400" aria-hidden="true" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              {smartAccountBalance !== null ? (
                <span className="text-2xl font-bold font-mono text-white tracking-tight">
                  ${smartAccountBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              ) : (
                <span className="text-sm font-mono text-slate-500 italic">
                  Unavailable (RPC Offline)
                </span>
              )}
              <span className="text-xs text-slate-400">USDC</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Verified on-chain ERC-20 reserve</p>
          </CardContent>
        </Card>

        {/* Active Mandates */}
        <Card hoverEffect>
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Active Mandates</span>
              <FileCheck2 className="w-4 h-4 text-indigo-400" aria-hidden="true" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-white tracking-tight">
                {activeMandates.length}
              </span>
              <span className="text-xs text-slate-400">/ {mandates.length} total</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {mandates.length - activeMandates.length} revoked or exhausted
            </p>
          </CardContent>
        </Card>

        {/* Authorized vs Spent */}
        <Card hoverEffect>
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Spent / Authorized</span>
              <ArrowRightLeft className="w-4 h-4 text-blue-400" aria-hidden="true" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono text-emerald-400 tracking-tight">
                ${totalSpent.toLocaleString()}
              </span>
              <span className="text-xs font-mono text-slate-400">
                / ${totalAuthorized.toLocaleString()}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              ${totalReserved.toLocaleString()} reserved in-flight
            </p>
          </CardContent>
        </Card>

        {/* Payment Verdicts */}
        <Card hoverEffect>
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Authorization Verdicts</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" />
            </div>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-xs font-medium text-emerald-400 flex items-center gap-1 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5" /> {allowedRequests.length} ALLOW
              </span>
              <span className="text-xs font-medium text-rose-400 flex items-center gap-1 font-mono">
                <XCircle className="w-3.5 h-3.5" /> {deniedRequests.length} DENY
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {settledRequests.length} on-chain settlements reconciled
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Middle Section: Budget Allocation & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Budget Allocation Progress */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Cumulative Policy Budget Allocation</CardTitle>
                <CardDescription>
                  Real-time aggregation across all active and historical mandate policies.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate("mandates")}
                rightIcon={<ArrowUpRight className="w-3.5 h-3.5" />}
              >
                View Mandates
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400">Total Spent: ${totalSpent.toFixed(2)} USDC</span>
                <span className="text-slate-400">Available: ${totalAvailable.toFixed(2)} USDC</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden flex">
                <div
                  className="bg-indigo-500 h-full transition-all duration-300"
                  style={{
                    width: `${totalAuthorized > 0 ? (totalSpent / totalAuthorized) * 100 : 0}%`,
                  }}
                  title={`Spent: $${totalSpent.toFixed(2)}`}
                />
                <div
                  className="bg-amber-500 h-full transition-all duration-300"
                  style={{
                    width: `${totalAuthorized > 0 ? (totalReserved / totalAuthorized) * 100 : 0}%`,
                  }}
                  title={`Reserved: $${totalReserved.toFixed(2)}`}
                />
              </div>
              <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" /> Spent ({totalAuthorized > 0 ? ((totalSpent / totalAuthorized) * 100).toFixed(1) : 0}%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Reserved In-Flight ({totalAuthorized > 0 ? ((totalReserved / totalAuthorized) * 100).toFixed(1) : 0}%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-700 inline-block" /> Available Budget
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-800/60 text-center">
              <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/40">
                <span className="text-[11px] text-slate-400 block">Total Authorized</span>
                <span className="text-base font-bold font-mono text-white mt-1 block">
                  ${totalAuthorized.toLocaleString()}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/40">
                <span className="text-[11px] text-slate-400 block">Total Settled</span>
                <span className="text-base font-bold font-mono text-emerald-400 mt-1 block">
                  ${totalSpent.toLocaleString()}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/40">
                <span className="text-[11px] text-slate-400 block">Remaining Buffer</span>
                <span className="text-base font-bold font-mono text-indigo-400 mt-1 block">
                  ${totalAvailable.toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System & Signer Health */}
        <Card>
          <CardHeader>
            <CardTitle>System & Security Infrastructure</CardTitle>
            <CardDescription>Ground-truth telemetry from backend services.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
              <span className="text-slate-400">Signing Service</span>
              <span className="font-mono text-slate-200">
                {health?.authorizer_signer ? (
                  `${health.authorizer_signer.slice(0, 6)}...${health.authorizer_signer.slice(-4)}`
                ) : (
                  <span className="text-rose-400">Offline</span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
              <span className="text-slate-400">Database Engine</span>
              <StatusBeacon
                status={health?.database === "connected" ? "online" : "offline"}
                label={health?.database === "connected" ? "PostgreSQL / SQLite" : "Disconnected"}
                size="sm"
              />
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
              <span className="text-slate-400">Target Chain ID</span>
              <span className="font-mono text-indigo-300 font-semibold">
                {health?.chain_id ?? "Unknown"}
              </span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
              <span className="text-slate-400">Core Service Version</span>
              <span className="font-mono text-slate-300">{health?.version ?? "v0.1.0"}</span>
            </div>

            <div className="pt-2">
              <Button
                variant="primary"
                size="sm"
                className="w-full justify-center"
                onClick={onOpenCreateMandate}
              >
                Create New Mandate Policy
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section: Recent Audit Events */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Security Events</CardTitle>
              <CardDescription>
                Live immutable audit ledger stream captured by the policy engine.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate("audit")}
              rightIcon={<ArrowUpRight className="w-3.5 h-3.5" />}
            >
              Full Audit Trail
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {auditEvents.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              No audit events recorded yet. Perform an action to generate an audit log.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60 font-mono text-xs">
              {auditEvents.slice(0, 5).map((evt) => (
                <div key={evt.id} className="py-2.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                    <span className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">
                      {evt.event_type}
                    </span>
                    <span className="text-slate-500 text-[11px] truncate">
                      {evt.mandate_id ? `Mandate ${evt.mandate_id.slice(0, 8)}...` : ""}
                    </span>
                  </div>
                  <span className="text-slate-500 text-[11px] shrink-0 font-sans">
                    {evt.created_at ? new Date(evt.created_at).toLocaleTimeString() : "Just now"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
