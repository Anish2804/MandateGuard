"use client";

import React, { useState } from "react";
import {
  History,
  Search,
  Download,
  FileCode,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Drawer } from "../ui/Drawer";
import { AddressChip } from "../ui/AddressChip";
import { EmptyState } from "../ui/EmptyState";
import { AuditEventItem } from "../../lib/api";

export interface AuditViewProps {
  auditEvents: AuditEventItem[];
  onRefresh: () => void;
}

const EVENT_TYPE_OPTIONS = [
  { label: "All events", value: "ALL" },
  { label: "Mandate created", value: "MANDATE_CREATED" },
  { label: "Payment authorized", value: "PAYMENT_AUTHORIZED" },
  { label: "Payment denied", value: "PAYMENT_DENIED" },
  { label: "Payment settled", value: "PAYMENT_SETTLED" },
  { label: "Mandate revoked", value: "MANDATE_REVOKED" },
];

export function AuditView({ auditEvents, onRefresh }: AuditViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedEvent, setSelectedEvent] = useState<AuditEventItem | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);

  const formatDateTime = (val?: string | null) => {
    if (!val) return "-";
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return "-";
      return d.toLocaleString([], { dateStyle: "short", timeStyle: "medium" });
    } catch {
      return "-";
    }
  };

  const filteredEvents = (auditEvents || []).filter((e) => {
    const matchesSearch =
      (e.event_type || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.mandate_id && e.mandate_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (e.request_id && e.request_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (e.id || "").toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType =
      selectedType === "ALL" || (e.event_type || "").toUpperCase().includes(selectedType);

    return matchesSearch && matchesType;
  });

  const getEventBadge = (type?: string | null) => {
    const upper = (type || "").toUpperCase();
    if (upper.includes("CREATED") || upper.includes("AUTHORIZED") || upper.includes("SETTLED")) {
      return <Badge variant="success" size="sm">{type || "EVENT"}</Badge>;
    }
    if (upper.includes("DENIED") || upper.includes("REVOKED")) {
      return <Badge variant="danger" size="sm">{type || "EVENT"}</Badge>;
    }
    return <Badge variant="neutral" size="sm">{type || "EVENT"}</Badge>;
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredEvents, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `mandateguard_audit_${new Date().toISOString().split("T")[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportCSV = () => {
    if (filteredEvents.length === 0) return;
    const headers = ["ID", "EventType", "MandateID", "RequestID", "Timestamp"];
    const rows = filteredEvents.map((e) => [
      `"${e.id}"`,
      `"${e.event_type}"`,
      `"${e.mandate_id || ""}"`,
      `"${e.request_id || ""}"`,
      `"${e.created_at || ""}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", encodeURI(csvContent));
    downloadAnchor.setAttribute("download", `mandateguard_audit_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleCopyJson = (details: any) => {
    navigator.clipboard.writeText(JSON.stringify(details, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--border)]">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)] tracking-tight">Audit Trail</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Immutable, cryptographically logged compliance ledger for policy evaluations and payments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--surface-raised)] border border-[var(--border)] text-xs text-[var(--text-muted)]">
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--success-text)]" />
            <span>Immutable ledger</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportCSV}
              disabled={filteredEvents.length === 0}
              leftIcon={<Download className="w-3.5 h-3.5" />}
            >
              Export CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportJSON}
              disabled={filteredEvents.length === 0}
              leftIcon={<FileCode className="w-3.5 h-3.5" />}
            >
              Export JSON
            </Button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search audit trail by event type, ID, or mandate..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-md pl-9 pr-4 py-2 text-xs text-[var(--text)] placeholder-[var(--text-subtle)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {EVENT_TYPE_OPTIONS.map((opt) => {
            const isSelected = selectedType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelectedType(opt.value)}
                className={`text-xs px-2.5 py-1 rounded-md transition-colors whitespace-nowrap font-medium ${
                  isSelected
                    ? "bg-[var(--accent-subtle)] text-[var(--accent-text)] border border-[var(--border-strong)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] border border-transparent"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-sm">
        {filteredEvents.length === 0 ? (
          <EmptyState
            icon={<History className="w-4 h-4" />}
            title={searchTerm || selectedType !== "ALL" ? "No matching audit events" : "No audit events logged"}
            description={
              searchTerm || selectedType !== "ALL"
                ? "No audit records match your active filters. Try resetting the search or selecting all events."
                : "Mandate registrations, policy evaluations, verdicts, and settlements are permanently logged here."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" aria-label="Audit trail records">
              <thead className="bg-[var(--surface-raised)] border-b border-[var(--border)] text-[var(--text-muted)] font-mono text-[11px] uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-3">Event type</th>
                  <th scope="col" className="px-4 py-3">Event ID</th>
                  <th scope="col" className="px-4 py-3">Mandate reference</th>
                  <th scope="col" className="px-4 py-3">Request ID</th>
                  <th scope="col" className="px-4 py-3">Recorded</th>
                  <th scope="col" className="px-4 py-3 text-right">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredEvents.map((evt) => (
                  <tr
                    key={evt.id}
                    onClick={() => setSelectedEvent(evt)}
                    className="hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      {getEventBadge(evt.event_type)}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      <AddressChip
                        address={evt.id}
                        truncateLength={4}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {evt.mandate_id ? (
                        <AddressChip
                          address={evt.mandate_id}
                          truncateLength={4}
                        />
                      ) : (
                        <span className="text-[var(--text-subtle)]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {evt.request_id ? (
                        <AddressChip
                          address={evt.request_id}
                          truncateLength={4}
                        />
                      ) : (
                        <span className="text-[var(--text-subtle)]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)] whitespace-nowrap">
                      {formatDateTime(evt.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(evt);
                        }}
                        rightIcon={<FileCode className="w-3.5 h-3.5" />}
                      >
                        JSON
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Structured Details JSON Inspector Drawer */}
      <Drawer
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title="Audit event payload"
        description={`Immutable record for ${selectedEvent?.event_type || ""}`}
        size="lg"
      >
        {selectedEvent && (
          <div className="space-y-5">
            {/* Metadata Summary */}
            <div className="p-4 rounded-lg bg-[var(--surface-raised)] border border-[var(--border)] space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-[var(--border)]">
                <span className="text-[var(--text-muted)]">Event ID</span>
                <AddressChip address={selectedEvent.id} truncateLength={8} />
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[var(--border)]">
                <span className="text-[var(--text-muted)]">Event Type</span>
                {getEventBadge(selectedEvent.event_type)}
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[var(--border)]">
                <span className="text-[var(--text-muted)]">Recorded Timestamp</span>
                <span className="font-mono text-[var(--text)]">
                  {selectedEvent.created_at ? new Date(selectedEvent.created_at).toISOString() : "-"}
                </span>
              </div>
              {selectedEvent.mandate_id && (
                <div className="flex justify-between items-center py-1 border-b border-[var(--border)]">
                  <span className="text-[var(--text-muted)]">Mandate Ref</span>
                  <AddressChip address={selectedEvent.mandate_id} truncateLength={8} />
                </div>
              )}
              {selectedEvent.request_id && (
                <div className="flex justify-between items-center py-1">
                  <span className="text-[var(--text-muted)]">Request Ref</span>
                  <AddressChip address={selectedEvent.request_id} truncateLength={8} />
                </div>
              )}
            </div>

            {/* Structured Details */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text)]">Details payload (JSON)</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyJson(selectedEvent.details)}
                  leftIcon={
                    copiedJson ? (
                      <Check className="w-3.5 h-3.5 text-[var(--success-text)]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )
                  }
                >
                  {copiedJson ? "Copied" : "Copy JSON"}
                </Button>
              </div>

              <pre className="p-4 rounded-lg bg-[var(--canvas)] border border-[var(--border)] text-xs font-mono text-[var(--text)] overflow-x-auto max-h-96 select-all leading-relaxed">
                {JSON.stringify(selectedEvent.details || {}, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
