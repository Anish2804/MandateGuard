"use client";

import React, { useState } from "react";
import {
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Send,
  Copy,
  Check,
  ShieldCheck,
  ShieldAlert,
  Coins,
  Search,
  ExternalLink,
  Receipt,
  FileCheck2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Modal } from "../ui/Modal";
import {
  PaymentRequestItem,
  PaymentVerdict,
  Mandate,
  MOCK_USDC_ADDR,
  CHAIN_ID,
  requestAuthorization,
  settlePayment,
} from "../../lib/api";
import { executePaymentViaWallet } from "../../lib/web3";
import { SUPPORTED_CHAINS } from "../../lib/contracts";

export interface RequestsViewProps {
  requests: PaymentRequestItem[];
  mandates: Mandate[];
  activeSmartAccount: string;
  walletAddress: `0x${string}` | null;
  walletChainId: number | null;
  onRefresh: () => void;
  showToast: (type: "success" | "error" | "info", message: string) => void;
}

export function RequestsView({
  requests,
  mandates,
  activeSmartAccount,
  walletAddress,
  walletChainId,
  onRefresh,
  showToast,
}: RequestsViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "allow" | "deny" | "settled">("all");

  // Simulator Modal State
  const [showSimulator, setShowSimulator] = useState(false);
  const [selectedMandateId, setSelectedMandateId] = useState(mandates[0]?.id || "");
  const [recipient, setRecipient] = useState("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC");
  const [amount, setAmount] = useState(25);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simVerdict, setSimVerdict] = useState<PaymentVerdict | null>(null);
  const [simError, setSimError] = useState<string | null>(null);

  // On-Chain Execution State
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionTxHash, setExecutionTxHash] = useState<string | null>(null);
  const [isSettling, setIsSettling] = useState(false);
  const [settledSuccess, setSettledSuccess] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeMandates = mandates.filter((m) => !m.is_revoked && m.remaining_budget > 0);
  const selectedMandate = mandates.find((m) => m.id === selectedMandateId);

  const filteredRequests = requests.filter((r) => {
    const matchesSearch =
      r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.mandate_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.recipient.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === "all") return true;
    if (statusFilter === "allow") return r.verdict === 1;
    if (statusFilter === "deny") return r.verdict === 0;
    if (statusFilter === "settled") return r.status === "SETTLED";
    return true;
  });

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMandateId) {
      alert("Please select a mandate policy first");
      return;
    }

    setIsSimulating(true);
    setSimVerdict(null);
    setSimError(null);
    setExecutionTxHash(null);
    setSettledSuccess(false);

    try {
      const idempotencyKey = `sim_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const verdict = await requestAuthorization({
        mandate_id: selectedMandateId,
        account: activeSmartAccount,
        token: MOCK_USDC_ADDR,
        recipient: recipient.trim(),
        amount: Number(amount),
        chain_id: CHAIN_ID,
        idempotency_key: idempotencyKey,
      });

      setSimVerdict(verdict);
      onRefresh();
    } catch (err: any) {
      setSimError(err.message || "Simulation request failed");
    } finally {
      setIsSimulating(false);
    }
  };

  const handleExecuteOnChain = async () => {
    if (!simVerdict || !simVerdict.signature) {
      alert("No signed verdict available for on-chain execution");
      return;
    }
    if (!walletAddress) {
      alert("Please connect your Web3 wallet first to sign the payment transaction");
      return;
    }

    setIsExecuting(true);
    try {
      const txHash = await executePaymentViaWallet(
        activeSmartAccount as `0x${string}`,
        {
          verdict: simVerdict.verdict,
          chainId: simVerdict.chain_id,
          account: simVerdict.account,
          token: simVerdict.token,
          recipient: simVerdict.recipient,
          amount: simVerdict.amount,
          mandateId: simVerdict.mandate_id,
          authorizationId: simVerdict.authorization_id,
          expiry: simVerdict.expiry,
          mandateVersion: simVerdict.mandate_version,
        },
        simVerdict.signature as `0x${string}`,
        walletAddress
      );

      setExecutionTxHash(txHash);
      showToast("success", `Transaction submitted to mempool: ${txHash.slice(0, 10)}...`);

      // Auto-reconcile with backend
      setIsSettling(true);
      try {
        await settlePayment(simVerdict.authorization_id, txHash);
        setSettledSuccess(true);
        showToast("success", "Payment reconciled and settled with MandateGuard backend!");
        onRefresh();
      } catch (settleErr: any) {
        showToast("error", `Settlement reconciliation warning: ${settleErr.message}`);
      } finally {
        setIsSettling(false);
      }
    } catch (execErr: any) {
      alert(`On-chain payment execution failed: ${execErr.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3 max-w-lg">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search requests by ID, mandate, or recipient..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
            {(["all", "allow", "deny", "settled"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className={`px-2.5 py-1 rounded-md capitalize font-medium transition-colors ${
                  statusFilter === filter
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            setSimVerdict(null);
            setSimError(null);
            setExecutionTxHash(null);
            setSettledSuccess(false);
            if (activeMandates.length > 0 && !selectedMandateId) {
              setSelectedMandateId(activeMandates[0].id);
            }
            setShowSimulator(true);
          }}
          leftIcon={<Play className="w-4 h-4 text-emerald-400" />}
        >
          Simulate Payment Request
        </Button>
      </div>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Request Evaluation History</CardTitle>
          <CardDescription>
            Every request submitted by an autonomous agent is cryptographically evaluated against its assigned mandate rules.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filteredRequests.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <ArrowRightLeft className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-300">No payment requests found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No requests have been evaluated under the selected criteria. Use the Payment Simulator to trigger and test an agent authorization request.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSimVerdict(null);
                  setShowSimulator(true);
                }}
              >
                Open Payment Simulator
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300" aria-label="Payment requests history table">
                <thead className="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 uppercase font-mono text-[11px]">
                  <tr>
                    <th scope="col" className="px-5 py-3">Request ID</th>
                    <th scope="col" className="px-5 py-3">Mandate</th>
                    <th scope="col" className="px-5 py-3">Amount</th>
                    <th scope="col" className="px-5 py-3">Recipient</th>
                    <th scope="col" className="px-5 py-3">Verdict</th>
                    <th scope="col" className="px-5 py-3">Lifecycle State</th>
                    <th scope="col" className="px-5 py-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {filteredRequests.map((r) => {
                    const isAllowed = r.verdict === 1;
                    const isSettled = r.status === "SETTLED";

                    return (
                      <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-3.5 font-semibold text-slate-200">
                          <span className="flex items-center gap-1.5">
                            <span>{`${r.id.slice(0, 10)}...`}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(r.id, r.id)}
                              className="text-slate-500 hover:text-indigo-400"
                              title="Copy Request ID"
                            >
                              {copiedId === r.id ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-indigo-300">
                          {`${r.mandate_id.slice(0, 8)}...${r.mandate_id.slice(-4)}`}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-100">
                          ${r.amount.toFixed(2)} USDC
                        </td>
                        <td className="px-5 py-3.5 text-slate-400">
                          {`${r.recipient.slice(0, 6)}...${r.recipient.slice(-4)}`}
                        </td>
                        <td className="px-5 py-3.5">
                          {isAllowed ? (
                            <Badge variant="allow" size="sm">ALLOW</Badge>
                          ) : (
                            <Badge variant="deny" size="sm">DENY</Badge>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {isSettled ? (
                            <Badge variant="settled" size="sm">Settled</Badge>
                          ) : isAllowed ? (
                            <span className="inline-flex items-center gap-1 text-indigo-400 font-sans font-medium">
                              <Clock className="w-3 h-3" /> Authorized (Signed)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-400 font-sans">
                              <XCircle className="w-3 h-3" /> Rejected: {r.rejection_reason || "Policy Violation"}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 font-sans">
                          {r.created_at ? new Date(r.created_at).toLocaleTimeString() : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Simulator Modal */}
      <Modal
        isOpen={showSimulator}
        onClose={() => setShowSimulator(false)}
        title="AI Agent Payment Simulator"
        description="Simulate an autonomous agent payment request and inspect the cryptographic authorization decision."
        size="lg"
      >
        <div className="space-y-5">
          <form onSubmit={handleSimulate} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="sim-mandate-select" className="text-xs font-medium text-slate-300 block">
                Select Mandate Policy <span className="text-rose-400">*</span>
              </label>
              <select
                id="sim-mandate-select"
                value={selectedMandateId}
                onChange={(e) => setSelectedMandateId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {mandates.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} — ${m.remaining_budget.toFixed(2)} remaining (Max ${m.max_amount_per_tx}/tx)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="sim-amount-input" className="text-xs font-medium text-slate-300 block">
                  Requested Amount (USDC) <span className="text-rose-400">*</span>
                </label>
                <input
                  id="sim-amount-input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="sim-recipient-input" className="text-xs font-medium text-slate-300 block">
                  Payment Destination (Recipient) <span className="text-rose-400">*</span>
                </label>
                <input
                  id="sim-recipient-input"
                  type="text"
                  required
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="submit"
                variant="primary"
                loading={isSimulating}
                leftIcon={<Play className="w-4 h-4" />}
              >
                Evaluate Policy Decision
              </Button>
            </div>
          </form>

          {/* Error Message */}
          {simError && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-600/40 text-rose-300 text-xs flex items-start gap-2.5">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Evaluation Error</span>
                <span>{simError}</span>
              </div>
            </div>
          )}

          {/* Verdict Review Card */}
          {simVerdict && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4 text-xs animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Policy Decision:</span>
                  {simVerdict.verdict === 1 ? (
                    <Badge variant="allow" size="md">ALLOW (Approved)</Badge>
                  ) : (
                    <Badge variant="deny" size="md">DENY (Rejected)</Badge>
                  )}
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  Auth ID: {`${simVerdict.authorization_id.slice(0, 10)}...`}
                </span>
              </div>

              {simVerdict.verdict === 0 ? (
                <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-600/30 text-rose-300 space-y-1">
                  <span className="font-semibold block">Reason for Denial:</span>
                  <span>{simVerdict.reason}</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-600/30 text-emerald-300 space-y-1">
                    <span className="font-semibold block">Policy Check Succeeded:</span>
                    <span>{simVerdict.reason}</span>
                    <span className="text-[11px] text-slate-300 block pt-1">
                      Budget has been reserved in-flight. EIP-712 authorizer signature generated.
                    </span>
                  </div>

                  <div className="space-y-1 font-mono text-[11px] bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Authorizer Signer:</span>
                      <span className="text-indigo-300">{simVerdict.authorizer_address}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Signature:</span>
                      <span className="text-slate-400 truncate max-w-[200px]">{simVerdict.signature}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Expiry Timestamp:</span>
                      <span className="text-slate-300">{new Date(simVerdict.expiry * 1000).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  {/* Actions for Execution */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800">
                    <div>
                      {executionTxHash ? (
                        <div className="text-emerald-400 font-mono text-[11px] flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Mined Tx: {`${executionTxHash.slice(0, 12)}...`}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">
                          Submit signature on-chain to trigger token transfer.
                        </span>
                      )}
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      loading={isExecuting || isSettling}
                      onClick={handleExecuteOnChain}
                      disabled={settledSuccess}
                      leftIcon={<Send className="w-3.5 h-3.5" />}
                    >
                      {settledSuccess ? "Executed & Settled" : "Execute On-Chain via Wallet"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
