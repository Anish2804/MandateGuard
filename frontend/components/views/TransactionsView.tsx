"use client";

import React, { useState } from "react";
import {
  Receipt,
  Search,
  Layers,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Clock,
  Coins,
  FileCode,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Drawer } from "../ui/Drawer";
import { AddressChip } from "../ui/AddressChip";
import { EmptyState } from "../ui/EmptyState";
import { PaymentRequestItem } from "../../lib/api";
import { fetchTransactionReceipt } from "../../lib/web3";
import { SUPPORTED_CHAINS, DEFAULT_CHAIN_ID } from "../../lib/contracts";

export interface TransactionsViewProps {
  requests: PaymentRequestItem[];
  walletChainId: number | null;
  activeSmartAccount: string;
}

export function TransactionsView({
  requests,
  walletChainId,
  activeSmartAccount,
}: TransactionsViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTxHash, setSelectedTxHash] = useState<string | null>(null);
  const [selectedTxRequest, setSelectedTxRequest] = useState<PaymentRequestItem | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptData, setReceiptData] = useState<any | null>(null);

  const chainConfig =
    SUPPORTED_CHAINS[walletChainId as keyof typeof SUPPORTED_CHAINS] ||
    SUPPORTED_CHAINS[84532];

  const formatTime = (val?: string | null) => {
    if (!val) return "-";
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return "-";
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return "-";
    }
  };

  // Filter requests that have actual on-chain transaction hashes
  const txRequests = (requests || []).filter((r) => Boolean(r?.tx_hash));

  const filteredTxs = txRequests.filter(
    (r) =>
      (r.tx_hash || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.recipient || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.mandate_id || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleInspectReceipt = async (t: PaymentRequestItem) => {
    if (!t.tx_hash) return;
    setSelectedTxHash(t.tx_hash);
    setSelectedTxRequest(t);
    setReceiptLoading(true);
    setReceiptData(null);
    try {
      const receipt = await fetchTransactionReceipt(
        t.tx_hash as `0x${string}`,
        walletChainId || DEFAULT_CHAIN_ID
      );
      setReceiptData(receipt);
    } catch (err) {
      console.warn("Failed to load receipt:", err);
    } finally {
      setReceiptLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--border)]">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)] tracking-tight">Transactions</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Settled on-chain transactions reconciled against cryptographic mandate verdicts and receipts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)] font-mono">Total Settled:</span>
          <span className="text-xs font-mono font-semibold text-[var(--text)] px-2 py-0.5 rounded bg-[var(--surface-hover)] border border-[var(--border)] tabular-nums">
            {txRequests.length}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search by transaction hash, recipient, or mandate..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-md pl-9 pr-4 py-2 text-xs text-[var(--text)] placeholder-[var(--text-subtle)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors"
          />
        </div>

        {searchTerm && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchTerm("")}
          >
            Clear filter
          </Button>
        )}
      </div>

      {/* Transactions Data Table */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-sm">
        {filteredTxs.length === 0 ? (
          <EmptyState
            icon={<Receipt className="w-4 h-4" />}
            title={searchTerm ? "No matching transactions" : "No settled transactions"}
            description={
              searchTerm
                ? "No settled transactions match your query. Try searching for a different hash or recipient."
                : "Transactions submitted and executed on-chain with authorized mandate verdicts will be recorded here."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" aria-label="Settled transactions">
              <thead className="bg-[var(--surface-raised)] border-b border-[var(--border)] text-[var(--text-muted)] font-mono text-[11px] uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-3">Transaction hash</th>
                  <th scope="col" className="px-4 py-3">Amount</th>
                  <th scope="col" className="px-4 py-3">Recipient</th>
                  <th scope="col" className="px-4 py-3">Mandate</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Settled</th>
                  <th scope="col" className="px-4 py-3 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredTxs.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => handleInspectReceipt(t)}
                    className="hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 font-mono">
                      {t.tx_hash ? (
                        <AddressChip
                          address={t.tx_hash}
                          truncateLength={6}
                          showExplorer={true}
                          explorerType="tx"
                          explorerUrl={chainConfig?.explorer}
                        />
                      ) : (
                        <span className="text-[var(--text-subtle)]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums font-semibold text-[var(--text)]">
                      ${Number(t.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span className="text-[var(--text-muted)] font-normal text-[11px] ml-1">USDC</span>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      <AddressChip
                        address={t.recipient}
                        truncateLength={4}
                        showExplorer={true}
                        explorerUrl={chainConfig?.explorer}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono">
                      <AddressChip
                        address={t.mandate_id}
                        truncateLength={4}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="settled" size="sm">Confirmed</Badge>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)] whitespace-nowrap">
                      {formatTime(t.settled_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInspectReceipt(t);
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

      {/* Transaction Receipt Drawer */}
      <Drawer
        isOpen={!!selectedTxHash}
        onClose={() => {
          setSelectedTxHash(null);
          setSelectedTxRequest(null);
        }}
        title="Transaction receipt"
        description="Verified on-chain receipt details retrieved directly from the configured RPC node."
        size="lg"
      >
        <div className="space-y-6">
          {/* Header Summary */}
          <div className="p-4 rounded-lg bg-[var(--surface-raised)] border border-[var(--border)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text-muted)]">Transaction Hash</span>
              {chainConfig?.explorer && selectedTxHash && (
                <a
                  href={`${chainConfig.explorer}/tx/${selectedTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[var(--accent-text)] hover:underline"
                >
                  <span>View on Explorer</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <div className="font-mono text-xs break-all text-[var(--text)] bg-[var(--canvas)] p-2 rounded border border-[var(--border)] select-all">
              {selectedTxHash}
            </div>
          </div>

          {receiptLoading ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)] space-y-2">
              <div className="w-5 h-5 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin mx-auto" />
              <p>Querying EVM RPC node for confirmed receipt...</p>
            </div>
          ) : receiptData ? (
            <div className="space-y-4">
              {/* Receipt Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-[var(--surface-raised)] border border-[var(--border)]">
                  <span className="text-[11px] text-[var(--text-muted)] block">Block height</span>
                  <span className="text-sm font-mono font-semibold text-[var(--text)] mt-1 block tabular-nums">
                    #{Number(receiptData.blockNumber).toLocaleString()}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-[var(--surface-raised)] border border-[var(--border)]">
                  <span className="text-[11px] text-[var(--text-muted)] block">Execution status</span>
                  <div className="mt-1 flex items-center gap-1.5">
                    {receiptData.status === "success" || receiptData.status === 1 ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-[var(--success-text)]" />
                        <span className="text-xs font-semibold text-[var(--success-text)]">Success (1)</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-[var(--danger-text)]" />
                        <span className="text-xs font-semibold text-[var(--danger-text)]">Reverted (0)</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Detailed parameters */}
              <div className="p-4 rounded-lg bg-[var(--surface-raised)] border border-[var(--border)] space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center py-1 border-b border-[var(--border)]">
                  <span className="text-[var(--text-muted)] font-sans">Gas consumed</span>
                  <span className="text-[var(--text)] tabular-nums">{Number(receiptData.gasUsed).toLocaleString()} units</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[var(--border)]">
                  <span className="text-[var(--text-muted)] font-sans">Contract target</span>
                  <AddressChip
                    address={receiptData.to || ""}
                    truncateLength={6}
                    showExplorer={true}
                    explorerUrl={chainConfig?.explorer}
                  />
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[var(--border)]">
                  <span className="text-[var(--text-muted)] font-sans">Origin sender</span>
                  <AddressChip
                    address={receiptData.from || ""}
                    truncateLength={6}
                    showExplorer={true}
                    explorerUrl={chainConfig?.explorer}
                  />
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-[var(--text-muted)] font-sans">Event logs</span>
                  <span className="text-[var(--text)] tabular-nums">{receiptData.logs ? receiptData.logs.length : 0} logs</span>
                </div>
              </div>

              {/* Associated Request Info */}
              {selectedTxRequest && (
                <div className="p-4 rounded-lg bg-[var(--surface-raised)] border border-[var(--border)] space-y-2 text-xs">
                  <span className="font-semibold text-[var(--text)] block font-sans">Associated payment request</span>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div>
                      <span className="text-[var(--text-muted)] block font-sans">Amount:</span>
                      <span className="text-[var(--text)] font-semibold">${selectedTxRequest.amount.toFixed(2)} USDC</span>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] block font-sans">Account:</span>
                      <span className="text-[var(--text)]">{selectedTxRequest.account.slice(0, 8)}...</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Raw JSON Details */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Raw receipt payload</span>
                </div>
                <pre className="p-3 rounded-lg bg-[var(--canvas)] border border-[var(--border)] font-mono text-[11px] text-[var(--text-muted)] overflow-x-auto max-h-56 select-all">
                  {JSON.stringify(
                    {
                      blockHash: receiptData.blockHash,
                      blockNumber: Number(receiptData.blockNumber),
                      contractAddress: receiptData.contractAddress,
                      cumulativeGasUsed: Number(receiptData.cumulativeGasUsed),
                      effectiveGasPrice: receiptData.effectiveGasPrice ? String(receiptData.effectiveGasPrice) : undefined,
                      from: receiptData.from,
                      gasUsed: Number(receiptData.gasUsed),
                      status: receiptData.status,
                      to: receiptData.to,
                      transactionHash: receiptData.transactionHash,
                      transactionIndex: receiptData.transactionIndex,
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-[var(--text-muted)]">
              No receipt data returned for this transaction. The transaction may still be propagating in the local node.
            </div>
          )}
        </div>
      </Drawer>
    </div>
  );
}
