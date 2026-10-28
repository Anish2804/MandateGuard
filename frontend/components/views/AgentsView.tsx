"use client";

import React, { useState } from "react";
import {
  Bot,
  KeyRound,
  PlusCircle,
  Copy,
  Check,
  Trash2,
  Lock,
  Search,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Drawer } from "../ui/Drawer";
import { AddressChip } from "../ui/AddressChip";
import { EmptyState } from "../ui/EmptyState";
import { ApiKeyItem, ApiKeyCreatedResult } from "../../lib/api";

export interface AgentsViewProps {
  apiKeys: ApiKeyItem[];
  activeSmartAccount: string;
  onRefresh: () => void;
  onCreateApiKey: (name: string, account: string) => Promise<ApiKeyCreatedResult>;
  onRevokeApiKey: (id: string) => Promise<boolean>;
  isProvisionOpen?: boolean;
  onCloseProvision?: () => void;
}

export function AgentsView({
  apiKeys,
  activeSmartAccount,
  onRefresh,
  onCreateApiKey,
  onRevokeApiKey,
  isProvisionOpen = false,
  onCloseProvision,
}: AgentsViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDrawer, setShowDrawer] = useState(isProvisionOpen);
  const [agentName, setAgentName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdResult, setCreatedResult] = useState<ApiKeyCreatedResult | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const filtered = apiKeys.filter(
    (k) =>
      k.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      k.key_prefix.toLowerCase().includes(searchTerm.toLowerCase()) ||
      k.account_address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentName.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await onCreateApiKey(agentName.trim(), activeSmartAccount);
      setCreatedResult(res);
      setAgentName("");
    } catch (err: any) {
      alert(`Failed to create API key: ${err?.message || "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (id: string, name: string) => {
    if (!confirm(`Revoke credentials for agent "${name}"? The agent will immediately lose access to request payments.`)) {
      return;
    }
    setRevokingId(id);
    try {
      await onRevokeApiKey(id);
      onRefresh();
    } finally {
      setRevokingId(null);
    }
  };

  const handleCopyKey = () => {
    if (createdResult?.api_key) {
      navigator.clipboard.writeText(createdResult.api_key);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search agents by name or key prefix..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded pl-8 pr-3 py-1.5 text-xs text-[var(--text)] placeholder-[var(--text-subtle)] focus:outline-none focus:border-[var(--border-strong)]"
          />
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setCreatedResult(null);
            setShowDrawer(true);
          }}
          leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
        >
          Provision agent
        </Button>
      </div>

      {/* Agents Table */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Bot className="w-4 h-4" />}
              title="No agent credentials found"
              description="Provision an API key for your autonomous AI agent to request payment verdicts."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setCreatedResult(null);
                    setShowDrawer(true);
                  }}
                >
                  Provision agent
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs" aria-label="Provisioned agents table">
                <thead className="bg-[var(--surface-hover)] border-b border-[var(--border)] text-[var(--text-muted)] font-medium">
                  <tr>
                    <th scope="col" className="px-4 py-2.5">Agent identifier</th>
                    <th scope="col" className="px-4 py-2.5">Key prefix</th>
                    <th scope="col" className="px-4 py-2.5">Bound smart account</th>
                    <th scope="col" className="px-4 py-2.5">Status</th>
                    <th scope="col" className="px-4 py-2.5">Created</th>
                    <th scope="col" className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filtered.map((k) => (
                    <tr key={k.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                      <td className="px-4 py-2.5 font-medium text-[var(--text)] flex items-center gap-2">
                        <Bot className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                        <span>{k.name}</span>
                      </td>

                      <td className="px-4 py-2.5 font-mono text-[var(--text-muted)] text-[11px]">
                        {k.key_prefix}...
                      </td>

                      <td className="px-4 py-2.5">
                        <AddressChip address={k.account_address} truncateLength={4} />
                      </td>

                      <td className="px-4 py-2.5">
                        {k.is_active ? (
                          <Badge variant="success" size="sm">Active</Badge>
                        ) : (
                          <Badge variant="danger" size="sm">Revoked</Badge>
                        )}
                      </td>

                      <td className="px-4 py-2.5 text-[var(--text-muted)] font-mono text-[11px]">
                        {new Date(k.created_at).toLocaleDateString()}
                      </td>

                      <td className="px-4 py-2.5 text-right">
                        {k.is_active && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[var(--danger-text)] hover:bg-[var(--danger-subtle)] text-[11px] h-7 px-2"
                            loading={revokingId === k.id}
                            onClick={() => handleRevoke(k.id, k.name)}
                          >
                            Revoke key
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Provision Drawer */}
      <Drawer
        isOpen={showDrawer}
        onClose={() => {
          setShowDrawer(false);
          setCreatedResult(null);
          if (onCloseProvision) onCloseProvision();
        }}
        title={createdResult ? "Agent credentials created" : "Provision agent"}
        description={
          createdResult
            ? "Copy and securely store this key now. It cannot be shown again."
            : "Bind an autonomous agent to your guarded smart account."
        }
        width="md"
        footer={
          createdResult ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setShowDrawer(false);
                setCreatedResult(null);
                onRefresh();
              }}
            >
              Done
            </Button>
          ) : (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowDrawer(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={isSubmitting}
                onClick={handleCreate}
              >
                Generate key
              </Button>
            </div>
          )
        }
      >
        {createdResult ? (
          <div className="space-y-4">
            <div className="p-3 rounded bg-[var(--success-subtle)] border border-[var(--success-border)] text-xs text-[var(--success-text)] space-y-1">
              <span className="font-semibold block">Key generated for {createdResult.name}</span>
              <p>Locked to smart account {createdResult.account_address.slice(0, 10)}...</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text)] block">
                Agent API key
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  readOnly
                  value={createdResult.api_key}
                  className="w-full bg-[var(--surface-hover)] border border-[var(--border)] rounded px-2.5 py-1.5 font-mono text-xs text-[var(--text)] select-all focus:outline-none"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyKey}
                  leftIcon={copiedKey ? <Check className="w-3.5 h-3.5 text-[var(--success-text)]" /> : <Copy className="w-3.5 h-3.5" />}
                >
                  {copiedKey ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>

            <div className="p-2.5 rounded bg-[var(--warning-subtle)] border border-[var(--warning-border)] text-xs text-[var(--warning-text)] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Pass this key via the <code>X-API-Key</code> HTTP header in your agent SDK calls. For security reasons, it cannot be displayed again after closing this drawer.
              </span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="agent-name" className="text-xs font-medium text-[var(--text)] block">
                Agent name or identifier <span className="text-[var(--danger-text)]">*</span>
              </label>
              <input
                id="agent-name"
                type="text"
                required
                placeholder="e.g. TravelPlannerAgent, DevOpsRelayer"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-3 py-1.5 text-xs text-[var(--text)] placeholder-[var(--text-subtle)] focus:outline-none focus:border-[var(--border-strong)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text-muted)] block">
                Account binding
              </label>
              <div className="p-2.5 rounded bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-mono text-[var(--text)]">
                {activeSmartAccount}
              </div>
              <span className="text-[11px] text-[var(--text-muted)] block">
                The agent will be strictly constrained to spend from this account.
              </span>
            </div>
          </form>
        )}
      </Drawer>
    </div>
  );
}
