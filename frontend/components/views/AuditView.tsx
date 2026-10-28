"use client";

import React, { useState } from "react";
import {
  History,
  Search,
  Filter,
  FileCode,
  Copy,
  Check,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Modal } from "../ui/Modal";
import { AuditEventItem } from "../../lib/api";

export interface AuditViewProps {
  auditEvents: AuditEventItem[];
  onRefresh: () => void;
}

export function AuditView({ auditEvents, onRefresh }: AuditViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<AuditEventItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredEvents = auditEvents.filter(
    (e) =>
      e.event_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.mandate_id && e.mandate_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (e.request_id && e.request_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      e.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getEventBadge = (type: string) => {
    if (type.includes("CREATED") || type.includes("AUTHORIZED") || type.includes("SETTLED")) {
      return <Badge variant="allow" size="sm">{type}</Badge>;
    }
    if (type.includes("DENIED") || type.includes("REVOKED")) {
      return <Badge variant="deny" size="sm">{type}</Badge>;
    }
    return <Badge variant="info" size="sm">{type}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search audit trail by event type, ID, or mandate..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Total Logged Security Events: <strong className="text-indigo-400">{auditEvents.length}</strong>
        </div>
      </div>

      {/* Audit Log Table */}
      <Card>
        <CardHeader>
          <CardTitle>Security & Compliance Audit Ledger</CardTitle>
          <CardDescription>
            Immutable event records logged by MandateGuard during policy evaluation and settlement.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <History className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-300">No audit events match your filter</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                All mandate registrations, revocations, authorization verdicts, and settlements are permanently recorded here for compliance.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300" aria-label="Audit events ledger table">
                <thead className="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 uppercase font-mono text-[11px]">
                  <tr>
                    <th scope="col" className="px-5 py-3">Event Type</th>
                    <th scope="col" className="px-5 py-3">Event ID</th>
                    <th scope="col" className="px-5 py-3">Mandate Ref</th>
                    <th scope="col" className="px-5 py-3">Recorded Timestamp</th>
                    <th scope="col" className="px-5 py-3 text-right">Details Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {filteredEvents.map((evt) => (
                    <tr key={evt.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5">
                        {getEventBadge(evt.event_type)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-400">
                        <span className="flex items-center gap-1">
                          <span>{`${evt.id.slice(0, 10)}...`}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(evt.id, evt.id)}
                            className="text-slate-500 hover:text-indigo-400"
                            title="Copy Event ID"
                          >
                            {copiedId === evt.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-indigo-300">
                        {evt.mandate_id ? `${evt.mandate_id.slice(0, 10)}...` : "-"}
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 font-sans">
                        {evt.created_at ? new Date(evt.created_at).toLocaleString() : "-"}
                      </td>
                      <td className="px-5 py-3.5 text-right font-sans">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedEvent(evt)}
                          leftIcon={<FileCode className="w-3.5 h-3.5 text-indigo-400" />}
                        >
                          View JSON
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Structured Details JSON Inspector Modal */}
      <Modal
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title="Audit Event Structured Payload"
        description={`Event ID: ${selectedEvent?.id} | Type: ${selectedEvent?.event_type}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-400">
              <span>Timestamp:</span>
              <span className="text-slate-200 font-mono">
                {selectedEvent?.created_at ? new Date(selectedEvent.created_at).toISOString() : ""}
              </span>
            </div>
            {selectedEvent?.mandate_id && (
              <div className="flex justify-between items-center text-slate-400">
                <span>Associated Mandate:</span>
                <span className="text-indigo-300 font-mono">{selectedEvent.mandate_id}</span>
              </div>
            )}
            {selectedEvent?.request_id && (
              <div className="flex justify-between items-center text-slate-400">
                <span>Associated Request:</span>
                <span className="text-slate-200 font-mono">{selectedEvent.request_id}</span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300 block">
              Event Details (JSON):
            </span>
            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto max-h-80 select-all">
              {JSON.stringify(selectedEvent?.details || {}, null, 2)}
            </pre>
          </div>
        </div>
      </Modal>
    </div>
  );
}
