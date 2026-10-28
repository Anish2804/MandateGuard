"use client";

import React, { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";

export interface AddressChipProps {
  address: string;
  truncateLength?: number;
  explorerUrl?: string;
  showExplorer?: boolean;
  explorerType?: "address" | "tx";
  onCopy?: () => void;
  className?: string;
}

export function AddressChip({
  address,
  truncateLength = 4,
  explorerUrl,
  showExplorer = false,
  explorerType = "address",
  onCopy,
  className = "",
}: AddressChipProps) {
  const [copied, setCopied] = useState(false);

  if (!address) return <span className="text-[var(--text-subtle)] font-mono text-xs">-</span>;

  const display =
    address.length > truncateLength * 2 + 2
      ? `${address.slice(0, truncateLength + 2)}...${address.slice(-truncateLength)}`
      : address;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    if (onCopy) onCopy();
  };

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-xs bg-[var(--surface-hover)] border border-[var(--border)] px-1.5 py-0.5 rounded text-[var(--text)] transition-colors hover:border-[var(--border-strong)] select-all ${className}`}
      title={address}
    >
      <span className="tabular-nums font-mono">{display}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
        aria-label={`Copy address ${address}`}
        title="Copy full address"
      >
        {copied ? (
          <Check className="w-3 h-3 text-[var(--success-text)] shrink-0" aria-hidden="true" />
        ) : (
          <Copy className="w-3 h-3 shrink-0" aria-hidden="true" />
        )}
      </button>

      {showExplorer && explorerUrl && (
        <a
          href={`${explorerUrl}/${explorerType === "tx" ? "tx" : "address"}/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="p-0.5 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
          aria-label="View on block explorer"
          title="View on block explorer"
        >
          <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
        </a>
      )}
    </span>
  );
}
