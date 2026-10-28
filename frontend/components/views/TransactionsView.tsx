"use client";

import React, { useState } from "react";
import {
  Receipt,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
  FileCheck2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Modal } from "../ui/Modal";
import { PaymentRequestItem } from "../../lib/api";
import { fetchTransactionReceipt } from "../../lib/web3";
import { SUPPORTED_CHAINS } from "../../lib/contracts";

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
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptData, setReceiptData] = useState<any | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const chainConfig =
    SUPPORTED_CHAINS[walletChainId as keyof typeof SUPPORTED_CHAINS] ||
    SUPPORTED_CHAINS[31337];

  // Filter requests that have actual on-chain transaction hashes
  const txRequests = requests.filter((r) => r.tx_hash);

  const filteredTxs = txRequests.filter(
    (r) =>
      r.tx_hash?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.recipient.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.mandate_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleInspectReceipt = async (txHash: string) => {
    setSelectedTxHash(txHash);
    setReceiptLoading(true);
    setReceiptData(null);
    try {
      const receipt = await fetchTransactionReceipt(
        txHash as `0x${string}`,
        walletChainId || 31337
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
      {/* Header Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by transaction hash, recipient, or mandate..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Total Mined Transactions: <strong className="text-emerald-400">{txRequests.length}</strong>
        </div>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>On-Chain Verified Transactions</CardTitle>
          <CardDescription>
            Transactions submitted with verified human mandate verdicts and reconciled against on-chain receipts.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filteredTxs.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <Receipt className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-300">No settled transactions yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Once an authorized payment request is executed on-chain via your wallet or agent relayer, the confirmed transaction receipt will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300" aria-label="Settled transactions table">
                <thead className="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 uppercase font-mono text-[11px]">
                  <tr>
                    <th scope="col" className="px-5 py-3">Transaction Hash</th>
                    <th scope="col" className="px-5 py-3">Amount</th>
                    <th scope="col" className="px-5 py-3">Recipient</th>
                    <th scope="col" className="px-5 py-3">Status</th>
                    <th scope="col" className="px-5 py-3">Settled Timestamp</th>
                    <th scope="col" className="px-5 py-3 text-right">Receipt Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {filteredTxs.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5 text-slate-200">
                        <span className="flex items-center gap-1.5 font-semibold">
                          <span>{t.tx_hash ? `${t.tx_hash.slice(0, 10)}...${t.tx_hash.slice(-6)}` : "-"}</span>
                          {t.tx_hash && (
                            <button
                              type="button"
                              onClick={() => handleCopy(t.tx_hash!, t.id)}
                              className="text-slate-500 hover:text-indigo-400"
                              title="Copy Tx Hash"
                            >
                              {copiedHash === t.id ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-emerald-400">
                        ${t.amount.toFixed(2)} USDC
                      </td>
                      <td className="px-5 py-3.5 text-slate-400">
                        {`${t.recipient.slice(0, 6)}...${t.recipient.slice(-4)}`}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant="settled" size="sm">Confirmed</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 font-sans">
                        {t.settled_at ? new Date(t.settled_at).toLocaleTimeString() : "-"}
                      </td>
                      <td className="px-5 py-3.5 text-right font-sans">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleInspectReceipt(t.tx_hash!)}
                          rightIcon={<Layers className="w-3.5 h-3.5" />}
                        >
                          Inspect Receipt
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

      {/* Transaction Receipt Inspector Modal */}
      <Modal
        isOpen={!!selectedTxHash}
        onClose={() => setSelectedTxHash(null)}
        title="On-Chain Transaction Receipt Inspector"
        description="Verified blockchain facts retrieved directly from the configured EVM RPC node."
        size="lg"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1 font-mono text-xs">
            <span className="text-slate-400 block font-sans">Transaction Hash:</span>
            <div className="flex items-center justify-between">
              <span className="text-emerald-400 break-all">{selectedTxHash}</span>
              {chainConfig.explorer && (
                <a
                  href={`${chainConfig.explorer}/tx/${selectedTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 ml-2 shrink-0 font-sans"
                >
                  <span>Basescan</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>

          {receiptLoading ? (
            <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
              Querying EVM node for transaction receipt...
            </div>
          ) : receiptData ? (
            <div className="space-y-3 font-mono text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block font-sans">Block Number:</span>
                  <span className="text-slate-100 font-bold mt-1 block">
                    #{Number(receiptData.blockNumber)}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block font-sans">Execution Status:</span>
                  <span className="mt-1 block">
                    {receiptData.status === "success" || receiptData.status === 1 ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 1 (SUCCESS)
                      </span>
                    ) : (
                      <span className="text-rose-400 font-bold flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" /> 0 (REVERTED)
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Gas Used:</span>
                  <span className="text-slate-200">{Number(receiptData.gasUsed).toLocaleString()} units</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Contract Interacted:</span>
                  <span className="text-indigo-300">{receiptData.to}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Event Logs Emitted:</span>
                  <span className="text-slate-200">{receiptData.logs?.length || 0} events</span>
                </div>
              </div>

              {/* Event Log Verification Note */}
              <div className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-600/30 text-indigo-300 text-xs flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  The receipt confirms that <code>PaymentExecuted</code> topic was indexed and verified by the MandateGuard settlement service.
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400">
              Receipt not yet available from local RPC or block is still pending confirmation.
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
