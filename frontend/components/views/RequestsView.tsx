"use client";

import React, { useState } from "react";
import {
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Send,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Coins,
  Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Drawer } from "../ui/Drawer";
import { AddressChip } from "../ui/AddressChip";
import { EmptyState } from "../ui/EmptyState";
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

export interface RequestsViewProps {
  requests: PaymentRequestItem[];
  mandates: Mandate[];
  activeSmartAccount: string;
  walletAddress: `0x${string}` | null;
  walletChainId: number | null;
  onRefresh: () => void;
  showToast: (type: "success" | "error" | "warning" | "info", message: string) => void;
  isSimulatorOpen?: boolean;
  onCloseSimulator?: () => void;
}

export function RequestsView({
  requests,
  mandates,
  activeSmartAccount,
  walletAddress,
  walletChainId,
  onRefresh,
  showToast,
  isSimulatorOpen = false,
  onCloseSimulator,
}: RequestsViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "allow" | "deny" | "settled">("all");
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);

  // Simulator Drawer State
  const [showSimulator, setShowSimulator] = useState(isSimulatorOpen);
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

  const activeMandates = mandates.filter((m) => !m.is_revoked && m.remaining_budget > 0);

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

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMandateId) {
      alert("Please select a mandate policy first.");
      return;
    }

    setIsSimulating(true);
    setSimVerdict(null);
    setSimError(null);
    setExecutionTxHash(null);
    setSettledSuccess(false);

    try {
      const idempotencyKey = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
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
      alert("No signed verdict available for on-chain execution.");
      return;
    }
    if (!walletAddress) {
      alert("Please connect your Web3 wallet first to sign the payment transaction.");
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

      // Settle with backend
      setIsSettling(true);
      try {
        await settlePayment(simVerdict.authorization_id, txHash);
        setSettledSuccess(true);
        showToast("success", "Payment reconciled with MandateGuard backend.");
        onRefresh();
      } catch (settleErr: any) {
        showToast("error", `Settlement warning: ${settleErr.message}`);
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
    <div className="space-y-4">
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search by request ID, mandate, or recipient..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded pl-8 pr-3 py-1.5 text-xs text-[var(--text)] placeholder-[var(--text-subtle)] focus:outline-none focus:border-[var(--border-strong)]"
            />
          </div>

          <div className="flex items-center gap-1 bg-[var(--surface)] border border-[var(--border)] rounded p-0.5 text-xs">
            {(["all", "allow", "deny", "settled"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className={`px-2 py-0.5 rounded capitalize text-[11px] font-medium transition-colors ${
                  statusFilter === filter
                    ? "bg-[var(--surface-hover)] text-[var(--text)] shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <Button
          variant="primary"
          size="sm"
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
          leftIcon={<Play className="w-3.5 h-3.5" />}
        >
          Simulate payment
        </Button>
      </div>

      {/* Requests Data Table */}
      <Card>
        <CardContent className="p-0">
          {filteredRequests.length === 0 ? (
            <EmptyState
              icon={<ArrowRightLeft className="w-4 h-4" />}
              title="No payment requests found"
              description="Test an agent authorization request using the payment simulator."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowSimulator(true)}
                >
                  Simulate payment
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs" aria-label="Payment requests history table">
                <thead className="bg-[var(--surface-hover)] border-b border-[var(--border)] text-[var(--text-muted)] font-medium">
                  <tr>
                    <th scope="col" className="w-8 px-3 py-2.5"></th>
                    <th scope="col" className="px-3 py-2.5">Request ID</th>
                    <th scope="col" className="px-3 py-2.5">Mandate</th>
                    <th scope="col" className="px-3 py-2.5">Amount</th>
                    <th scope="col" className="px-3 py-2.5">Recipient</th>
                    <th scope="col" className="px-3 py-2.5">Verdict</th>
                    <th scope="col" className="px-3 py-2.5">Lifecycle state</th>
                    <th scope="col" className="px-3 py-2.5 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] font-mono text-[11px]">
                  {filteredRequests.map((r) => {
                    const isExpanded = expandedRequestId === r.id;
                    const isAllowed = r.verdict === 1;
                    const isSettled = r.status === "SETTLED";

                    return (
                      <React.Fragment key={r.id}>
                        <tr
                          onClick={() => setExpandedRequestId(isExpanded ? null : r.id)}
                          className="hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                        >
                          <td className="px-3 py-2.5 text-[var(--text-subtle)]">
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <AddressChip address={r.id} truncateLength={4} />
                          </td>
                          <td className="px-3 py-2.5">
                            <AddressChip address={r.mandate_id} truncateLength={4} />
                          </td>
                          <td className="px-3 py-2.5 font-bold font-mono tabular-nums text-[var(--text)]">
                            ${r.amount.toFixed(2)} USDC
                          </td>
                          <td className="px-3 py-2.5">
                            <AddressChip address={r.recipient} truncateLength={4} />
                          </td>
                          <td className="px-3 py-2.5 font-sans">
                            {isAllowed ? (
                              <Badge variant="allow" size="sm">Allow</Badge>
                            ) : (
                              <Badge variant="deny" size="sm">Deny</Badge>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-sans">
                            {isSettled ? (
                              <span className="text-[var(--success-text)] font-medium inline-flex items-center gap-1">
                                <Check className="w-3 h-3" /> Settled
                              </span>
                            ) : isAllowed ? (
                              <span className="text-[var(--accent-text)] font-medium inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Authorized
                              </span>
                            ) : (
                              <span className="text-[var(--danger-text)] truncate max-w-xs block">
                                Denied: {r.rejection_reason || "Rule violation"}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right text-[var(--text-muted)] font-sans">
                            {r.created_at ? new Date(r.created_at).toLocaleTimeString() : "-"}
                          </td>
                        </tr>

                        {/* Expandable Row with Raw Verdict JSON */}
                        {isExpanded && (
                          <tr className="bg-[var(--surface-hover)]">
                            <td colSpan={8} className="px-6 py-3 font-mono text-[11px]">
                              <div className="space-y-2 p-3 bg-[var(--surface)] border border-[var(--border)] rounded">
                                <div className="flex items-center justify-between text-xs text-[var(--text)] font-sans font-semibold">
                                  <span>Verdict payload & cryptographic fields</span>
                                  <span className="font-mono text-[10px] text-[var(--text-subtle)]">
                                    Nonce: {r.authorization_id}
                                  </span>
                                </div>
                                <pre className="text-[11px] text-[var(--text-muted)] overflow-x-auto select-all">
                                  {JSON.stringify(
                                    {
                                      request_id: r.id,
                                      mandate_id: r.mandate_id,
                                      account: r.account,
                                      recipient: r.recipient,
                                      amount_usdc: r.amount,
                                      verdict: r.verdict === 1 ? "ALLOW" : "DENY",
                                      status: r.status,
                                      tx_hash: r.tx_hash,
                                      expiry: r.expiry,
                                      rejection_reason: r.rejection_reason,
                                      created_at: r.created_at,
                                      settled_at: r.settled_at,
                                    },
                                    null,
                                    2
                                  )}
                                </pre>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Simulator Slide-Over Drawer */}
      <Drawer
        isOpen={showSimulator}
        onClose={() => {
          setShowSimulator(false);
          if (onCloseSimulator) onCloseSimulator();
        }}
        title="Payment request simulator"
        description="Simulate an autonomous agent payment request to verify policy evaluation."
        width="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowSimulator(false)}
            >
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={isSimulating}
              onClick={handleSimulate}
              leftIcon={<Play className="w-3.5 h-3.5" />}
            >
              Evaluate request
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <form onSubmit={handleSimulate} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="sim-mandate" className="text-xs font-medium text-[var(--text)] block">
                Target mandate policy <span className="text-[var(--danger-text)]">*</span>
              </label>
              <select
                id="sim-mandate"
                value={selectedMandateId}
                onChange={(e) => setSelectedMandateId(e.target.value)}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2.5 py-1.5 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--border-strong)]"
              >
                {mandates.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} (${m.remaining_budget.toFixed(2)} left, max ${m.max_amount_per_tx}/tx)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label htmlFor="sim-amount" className="text-xs font-medium text-[var(--text)] block">
                  Amount (USDC) <span className="text-[var(--danger-text)]">*</span>
                </label>
                <input
                  id="sim-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2.5 py-1.5 text-xs font-mono tabular-nums text-[var(--text)] focus:outline-none focus:border-[var(--border-strong)]"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="sim-recip" className="text-xs font-medium text-[var(--text)] block">
                  Destination address <span className="text-[var(--danger-text)]">*</span>
                </label>
                <input
                  id="sim-recip"
                  type="text"
                  required
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2.5 py-1.5 text-xs font-mono text-[var(--text)] focus:outline-none focus:border-[var(--border-strong)]"
                />
              </div>
            </div>
          </form>

          {/* Evaluation Error */}
          {simError && (
            <div className="p-3 rounded bg-[var(--danger-subtle)] border border-[var(--danger-border)] text-xs text-[var(--danger-text)]">
              {simError}
            </div>
          )}

          {/* Verdict Result */}
          {simVerdict && (
            <div className="p-3.5 rounded bg-[var(--surface-hover)] border border-[var(--border)] space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[var(--text)]">Authorization result:</span>
                {simVerdict.verdict === 1 ? (
                  <Badge variant="allow" size="md">ALLOW (Approved)</Badge>
                ) : (
                  <Badge variant="deny" size="md">DENY (Rejected)</Badge>
                )}
              </div>

              {simVerdict.verdict === 0 ? (
                <div className="p-2.5 rounded bg-[var(--danger-subtle)] border border-[var(--danger-border)] text-[var(--danger-text)] text-xs">
                  <strong>Rejection reason:</strong> {simVerdict.reason}
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="p-2.5 rounded bg-[var(--success-subtle)] border border-[var(--success-border)] text-[var(--success-text)] text-xs">
                    {simVerdict.reason}
                  </div>

                  <div className="space-y-1 font-mono text-[11px] p-2.5 rounded bg-[var(--surface)] border border-[var(--border)]">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)] font-sans">Signer:</span>
                      <AddressChip address={simVerdict.authorizer_address || ""} truncateLength={4} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)] font-sans">Nonce:</span>
                      <span className="truncate max-w-[160px] text-[var(--text)]">{simVerdict.authorization_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)] font-sans">Expiry:</span>
                      <span className="text-[var(--text)]">{new Date(simVerdict.expiry * 1000).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  {/* Actions for on-chain execution */}
                  <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between">
                    {executionTxHash ? (
                      <span className="text-[var(--success-text)] font-mono text-[11px]">
                        Tx: {executionTxHash.slice(0, 10)}...
                      </span>
                    ) : <span />}

                    <Button
                      variant="primary"
                      size="sm"
                      loading={isExecuting || isSettling}
                      onClick={handleExecuteOnChain}
                      disabled={settledSuccess}
                      leftIcon={<Send className="w-3.5 h-3.5" />}
                    >
                      {settledSuccess ? "Executed & Settled" : "Execute via Wallet"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Drawer>
    </div>
  );
}
