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
  ShieldCheck,
  AlertTriangle,
  Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Modal } from "../ui/Modal";
import { ApiKeyItem, ApiKeyCreatedResult } from "../../lib/api";

export interface AgentsViewProps {
  apiKeys: ApiKeyItem[];
  activeSmartAccount: string;
  onRefresh: () => void;
  onCreateApiKey: (name: string, account: string) => Promise<ApiKeyCreatedResult>;
  onRevokeApiKey: (id: string) => Promise<boolean>;
}

export function AgentsView({
  apiKeys,
  activeSmartAccount,
  onRefresh,
  onCreateApiKey,
  onRevokeApiKey,
}: AgentsViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdKeyResult, setCreatedKeyResult] = useState<ApiKeyCreatedResult | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const filteredKeys = apiKeys.filter((k) =>
    k.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    k.account_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    k.key_prefix.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentName.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await onCreateApiKey(agentName.trim(), activeSmartAccount);
      setCreatedKeyResult(res);
      setAgentName("");
    } catch (err: any) {
      alert(`Failed to create API key: ${err?.message || "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = () => {
    if (createdKeyResult?.api_key) {
      navigator.clipboard.writeText(createdKeyResult.api_key);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleRevoke = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to revoke API key for agent "${name}"? It will immediately lose authorization to spend from this smart account.`)) {
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

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search agents by name, prefix, or account..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <Button
          variant="primary"
          onClick={() => {
            setCreatedKeyResult(null);
            setShowCreateModal(true);
          }}
          leftIcon={<PlusCircle className="w-4 h-4" />}
        >
          Provision New Agent
        </Button>
      </div>

      {/* Agents Table / Cards */}
      <Card>
        <CardHeader>
          <CardTitle>Autonomous Agent Identity & Permissions</CardTitle>
          <CardDescription>
            Agents are provisioned with cryptographic API keys and locked strictly to designated smart accounts.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filteredKeys.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <Bot className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-300">No agent credentials found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Provision an agent API key to allow autonomous AI agents (LangChain, AutoGen, CrewAI) to request payment verdicts securely.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCreatedKeyResult(null);
                  setShowCreateModal(true);
                }}
              >
                Provision First Agent
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300" aria-label="Agent credentials table">
                <thead className="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 uppercase font-mono text-[11px]">
                  <tr>
                    <th scope="col" className="px-5 py-3">Agent Identifier</th>
                    <th scope="col" className="px-5 py-3">Key Prefix</th>
                    <th scope="col" className="px-5 py-3">Locked Smart Account</th>
                    <th scope="col" className="px-5 py-3">Status</th>
                    <th scope="col" className="px-5 py-3">Created</th>
                    <th scope="col" className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredKeys.map((k) => (
                    <tr key={k.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-slate-100 flex items-center gap-2">
                        <Bot className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span>{k.name}</span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-400">
                        {k.key_prefix}...
                      </td>
                      <td className="px-5 py-3.5 font-mono text-indigo-300 text-[11px]">
                        {k.account_address}
                      </td>
                      <td className="px-5 py-3.5">
                        {k.is_active ? (
                          <Badge variant="active" size="sm">Active</Badge>
                        ) : (
                          <Badge variant="revoked" size="sm">Revoked</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 font-mono text-[11px]">
                        {new Date(k.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {k.is_active && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
                            loading={revokingId === k.id}
                            onClick={() => handleRevoke(k.id, k.name)}
                            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                          >
                            Revoke
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

      {/* Provision New Agent Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={createdKeyResult ? "Agent API Key Provisioned" : "Provision New AI Agent"}
        description={
          createdKeyResult
            ? "Save your agent's API key now. It will NEVER be displayed again."
            : "Bind an autonomous agent identity to your isolated smart account."
        }
      >
        {createdKeyResult ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-600/40 text-emerald-300 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>Agent Key Created Successfully</span>
              </div>
              <p className="text-xs text-slate-300">
                Agent <strong className="text-white">{createdKeyResult.name}</strong> is authorized to request payments from account:
              </p>
              <p className="text-[11px] font-mono text-indigo-300 break-all bg-slate-950/60 p-2 rounded border border-slate-800">
                {createdKeyResult.account_address}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">Agent API Secret Key</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={createdKeyResult.api_key}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-emerald-400 select-all"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopy}
                  leftIcon={copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                >
                  {copiedKey ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-600/30 text-amber-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Pass this key via the <code>X-API-Key</code> HTTP header in your agent SDK calls. If lost, you must revoke and generate a new key.
              </span>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                variant="primary"
                onClick={() => {
                  setShowCreateModal(false);
                  setCreatedKeyResult(null);
                  onRefresh();
                }}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="agent-name-input" className="text-xs font-medium text-slate-300 block">
                Agent Name or Identifier <span className="text-rose-400">*</span>
              </label>
              <input
                id="agent-name-input"
                type="text"
                required
                placeholder="e.g. TravelPlannerAgent, DevOpsRelayer, AutoBuyer-01"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 block">
                Target Smart Account Lock
              </label>
              <input
                type="text"
                readOnly
                value={activeSmartAccount}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-400 select-none cursor-not-allowed"
              />
              <span className="text-[11px] text-slate-500 block">
                This agent will only be permitted to request payments funded by this specific smart account.
              </span>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={isSubmitting}>
                Generate Key
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
