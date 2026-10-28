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
  Layers,
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

export function AuditView({ auditEvents, onRefresh }: AuditViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedEvent, setSelectedEvent] = useState<AuditEventItem | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "details" | "json">("overview");
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

  const countsByType = {
    ALL: (auditEvents || []).length,
    MANDATE_CREATED: (auditEvents || []).filter((e) => (e.event_type || "").includes("CREATED")).length,
    PAYMENT_AUTHORIZED: (auditEvents || []).filter((e) => (e.event_type || "").includes("AUTHORIZED")).length,
    PAYMENT_DENIED: (auditEvents || []).filter((e) => (e.event_type || "").includes("DENIED")).length,
    PAYMENT_SETTLED: (auditEvents || []).filter((e) => (e.event_type || "").includes("SETTLED")).length,
  };

  const EVENT_TYPE_OPTIONS = [
    { label: "All", value: "ALL", count: countsByType.ALL },
    { label: "Created", value: "MANDATE_CREATED", count: countsByType.MANDATE_CREATED },
    { label: "Authorized", value: "PAYMENT_AUTHORIZED", count: countsByType.PAYMENT_AUTHORIZED },
    { label: "Denied", value: "PAYMENT_DENIED", count: countsByType.PAYMENT_DENIED },
    { label: "Settled", value: "PAYMENT_SETTLED", count: countsByType.PAYMENT_SETTLED },
  ];

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
    <div className="space-y-4">
      {/* Finding A1: No duplicate page H1 header. Starts directly with filters & export actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input (Finding D7: min 280px) */}
        <div className="relative flex-1 max-w-md min-w-[280px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search audit trail by event type, ID, or mandate..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-md pl-9 pr-4 py-2 text-xs text-[var(--text)] placeholder-[var(--text-subtle)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors"
          />
        </div>

        {/* Segmented Control Height 32px with Counts (Finding D7) */}
        <div className="flex items-center gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-md p-0.5 h-8 overflow-x-auto">
          {EVENT_TYPE_OPTIONS.map((opt) => {
            const isSelected = selectedType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelectedType(opt.value)}
                className={`text-xs px-2.5 h-full rounded transition-colors whitespace-nowrap font-medium flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-[var(--surface-hover)] text-[var(--text)] font-semibold shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                <span>{opt.label}</span>
                <span className="text-[10px] px-1 py-0.2 rounded bg-[var(--surface-raised)] text-[var(--text-muted)] tabular-nums">
                  {opt.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCSV}
            disabled={filteredEvents.length === 0}
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportJSON}
            disabled={filteredEvents.length === 0}
            leftIcon={<FileCode className="w-3.5 h-3.5" />}
          >
            JSON
          </Button>
        </div>
      </div>

      {/* Audit Log Table (Finding D3: sentence-case headers, 40px rows) */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-xs">
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
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-left text-xs" aria-label="Audit trail records table">
              <thead className="bg-[var(--surface-raised)] border-b border-[var(--border)] text-[var(--text-muted)] text-xs font-medium sticky top-0 z-10">
                <tr>
                  <th scope="col" className="px-4 py-3">Event type</th>
                  <th scope="col" className="px-4 py-3">Event ID</th>
                  <th scope="col" className="px-4 py-3">Mandate reference</th>
                  <th scope="col" className="px-4 py-3">Request ID</th>
                  <th scope="col" className="px-4 py-3">Recorded</th>
                  <th scope="col" className="px-4 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredEvents.map((evt) => (
                  <tr
                    key={evt.id}
                    onClick={() => {
                      setSelectedEvent(evt);
                      setActiveTab("overview");
                    }}
                    className="hover:bg-[var(--surface-hover)] transition-colors cursor-pointer h-10"
                  >
                    <td className="px-4 py-2.5">
                      {getEventBadge(evt.event_type)}
                    </td>
                    <td className="px-4 py-2.5">
                      <AddressChip
                        address={evt.id}
                        truncateLength={4}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      {evt.mandate_id ? (
                        <AddressChip
                          address={evt.mandate_id}
                          truncateLength={4}
                        />
                      ) : (
                        <span className="text-[var(--text-subtle)]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {evt.request_id ? (
                        <AddressChip
                          address={evt.request_id}
                          truncateLength={4}
                        />
                      ) : (
                        <span className="text-[var(--text-subtle)]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--text-muted)] whitespace-nowrap tabular-nums">
                      {formatDateTime(evt.created_at)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(evt);
                          setActiveTab("overview");
                        }}
                        rightIcon={<Layers className="w-3.5 h-3.5" />}
                      >
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Structured Details JSON Inspector Drawer (Finding E2: 3-tab drawer) */}
      <Drawer
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title="Audit event inspection"
        description={`Cryptographic log record for ${selectedEvent?.event_type || ""}`}
        size="lg"
      >
        {selectedEvent && (
          <div className="space-y-5">
            {/* Drawer Tabs */}
            <div className="flex border-b border-[var(--border)] gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className={`pb-2.5 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === "overview"
                    ? "border-[var(--accent)] text-[var(--text)] font-semibold"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("details")}
                className={`pb-2.5 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === "details"
                    ? "border-[var(--accent)] text-[var(--text)] font-semibold"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                Event parameters
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("json")}
                className={`pb-2.5 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === "json"
                    ? "border-[var(--accent)] text-[var(--text)] font-semibold"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                Raw JSON
              </button>
            </div>

            {/* TAB 1: OVERVIEW */}
            {activeTab === "overview" && (
              <div className="p-4 rounded-lg bg-[var(--surface-raised)] border border-[var(--border)] space-y-3 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-[var(--border)]">
                  <span className="text-[var(--text-muted)]">Event ID</span>
                  <AddressChip address={selectedEvent.id} truncateLength={8} />
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[var(--border)]">
                  <span className="text-[var(--text-muted)]">Event Classification</span>
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
                    <span className="text-[var(--text-muted)]">Mandate Policy Ref</span>
                    <AddressChip address={selectedEvent.mandate_id} truncateLength={8} />
                  </div>
                )}
                {selectedEvent.request_id && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-[var(--text-muted)]">Payment Request Ref</span>
                    <AddressChip address={selectedEvent.request_id} truncateLength={8} />
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: EVENT PARAMETERS */}
            {activeTab === "details" && (
              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-[var(--surface-raised)] border border-[var(--border)] space-y-2 text-xs">
                  <span className="font-semibold text-[var(--text)] block mb-1">Decoded event attributes</span>
                  {selectedEvent.details && Object.keys(selectedEvent.details).length > 0 ? (
                    <div className="space-y-2 font-mono text-[11px]">
                      {Object.entries(selectedEvent.details).map(([k, v]) => (
                        <div key={k} className="flex justify-between py-1 border-b border-[var(--border)]">
                          <span className="text-[var(--text-muted)] font-sans">{k}</span>
                          <span className="text-[var(--text)] truncate max-w-xs">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[var(--text-muted)]">No additional key-value attributes recorded for this event.</p>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: RAW JSON */}
            {activeTab === "json" && (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleCopyJson(selectedEvent)}
                    leftIcon={copiedJson ? <Check className="w-3.5 h-3.5 text-[var(--success-text)]" /> : <Copy className="w-3.5 h-3.5" />}
                  >
                    {copiedJson ? "Copied" : "Copy JSON"}
                  </Button>
                </div>
                <pre className="p-4 rounded-lg bg-[var(--surface-raised)] border border-[var(--border)] text-xs font-mono text-[var(--text)] overflow-x-auto max-h-96 select-all leading-relaxed">
                  {JSON.stringify(selectedEvent, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
