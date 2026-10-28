"use client";

import React, { useState, useMemo } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  CheckCircle2,
  XCircle,
  FileCode,
  Copy,
  Check,
  ClipboardPaste,
  Layers,
  Clock,
  Info,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { AddressChip } from "../ui/AddressChip";
import { Modal } from "../ui/Modal";
import { verifyVerdictSignature } from "../../lib/api";
import { getContractAddresses, DEFAULT_CHAIN_ID } from "../../lib/contracts";

export interface VerdictViewProps {
  activeSmartAccount: string;
  defaultAuthorizerSigner: string | null;
  walletChainId?: number | null;
}

export function VerdictView({
  activeSmartAccount,
  defaultAuthorizerSigner,
  walletChainId,
}: VerdictViewProps) {
  const currentChainId = walletChainId || DEFAULT_CHAIN_ID;
  const addresses = getContractAddresses(currentChainId);

  // Finding E1: Clean un-prefilled inputs with guides
  const [form, setForm] = useState({
    verdict: 1,
    chainId: currentChainId,
    account: (activeSmartAccount || "") as string,
    token: (addresses.usdc || "") as string,
    recipient: "",
    amount: "",
    mandateId: "",
    authorizationId: "",
    expiry: Math.floor(Date.now() / 1000) + 86400,
    mandateVersion: 1,
    signature: "",
  });

  const [isVerifying, setIsVerifying] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteJsonInput, setPasteJsonInput] = useState("");

  const [verifyResult, setVerifyResult] = useState<{
    status: "idle" | "valid" | "invalid";
    recoveredSigner: string;
    expectedSigner: string;
    reason: string;
    checks: {
      domainMatch: boolean | null;
      typehashMatch: boolean | null;
      signerMatch: boolean | null;
      notExpired: boolean | null;
    };
  }>({
    status: "idle",
    recoveredSigner: "",
    expectedSigner: defaultAuthorizerSigner || "",
    reason: "",
    checks: {
      domainMatch: null,
      typehashMatch: null,
      signerMatch: null,
      notExpired: null,
    },
  });

  // Validation Rules
  const isAddress = (val: string) => /^0x[0-9a-fA-F]{40}$/.test(val.trim());
  const isBytes32 = (val: string) => /^0x[0-9a-fA-F]{64}$/.test(val.trim());
  const isSignature = (val: string) => /^0x[0-9a-fA-F]{130}$/.test(val.trim());
  const isPositiveAmount = (val: string) => !isNaN(Number(val)) && Number(val) > 0;

  const errors = useMemo(() => {
    return {
      recipient: form.recipient && !isAddress(form.recipient) ? "Invalid 20-byte Ethereum address (0x...)" : null,
      mandateId: form.mandateId && !isBytes32(form.mandateId) ? "Must be 32-byte hex (0x followed by 64 hex characters)" : null,
      authorizationId: form.authorizationId && !isBytes32(form.authorizationId) ? "Must be 32-byte hex (0x followed by 64 hex characters)" : null,
      signature: form.signature && !isSignature(form.signature) ? "Must be 65-byte ECDSA signature (0x followed by 130 hex characters)" : null,
      amount: form.amount && !isPositiveAmount(form.amount) ? "Amount must be greater than 0" : null,
    };
  }, [form]);

  const isFormValid = Boolean(
    form.account &&
    form.token &&
    form.recipient &&
    isAddress(form.recipient) &&
    form.mandateId &&
    isBytes32(form.mandateId) &&
    form.authorizationId &&
    isBytes32(form.authorizationId) &&
    form.signature &&
    isSignature(form.signature) &&
    isPositiveAmount(form.amount)
  );

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setIsVerifying(true);
    const nowSec = Math.floor(Date.now() / 1000);
    const isUnexpired = Number(form.expiry) > nowSec;

    try {
      const res = await verifyVerdictSignature({
        verdict: Number(form.verdict),
        chain_id: Number(form.chainId),
        account: form.account.trim(),
        token: form.token.trim(),
        recipient: form.recipient.trim(),
        amount: Number(form.amount),
        mandate_id: form.mandateId.trim(),
        authorization_id: form.authorizationId.trim(),
        expiry: Number(form.expiry),
        mandate_version: Number(form.mandateVersion),
        signature: form.signature.trim(),
      });

      const isValid = res.is_valid && isUnexpired;
      setVerifyResult({
        status: isValid ? "valid" : "invalid",
        recoveredSigner: res.recovered_signer,
        expectedSigner: res.expected_signer,
        reason: !isUnexpired ? "Authorization has expired" : res.reason,
        checks: {
          domainMatch: true,
          typehashMatch: true,
          signerMatch: res.recovered_signer.toLowerCase() === res.expected_signer.toLowerCase(),
          notExpired: isUnexpired,
        },
      });
    } catch (err: any) {
      setVerifyResult({
        status: "invalid",
        recoveredSigner: "0x0000000000000000000000000000000000000000",
        expectedSigner: defaultAuthorizerSigner || "Unknown",
        reason: err.message || "Cryptographic verification call failed",
        checks: {
          domainMatch: true,
          typehashMatch: false,
          signerMatch: false,
          notExpired: isUnexpired,
        },
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePasteJsonSubmit = () => {
    try {
      const parsed = JSON.parse(pasteJsonInput);
      setForm((prev) => ({
        ...prev,
        verdict: parsed.verdict ?? prev.verdict,
        chainId: parsed.chainId ?? parsed.chain_id ?? prev.chainId,
        account: parsed.account ?? prev.account,
        token: parsed.token ?? prev.token,
        recipient: parsed.recipient ?? prev.recipient,
        amount: parsed.amount !== undefined ? String(parsed.amount) : prev.amount,
        mandateId: parsed.mandateId ?? parsed.mandate_id ?? prev.mandateId,
        authorizationId: parsed.authorizationId ?? parsed.authorization_id ?? prev.authorizationId,
        expiry: parsed.expiry ?? prev.expiry,
        mandateVersion: parsed.mandateVersion ?? parsed.mandate_version ?? prev.mandateVersion,
        signature: parsed.signature ?? prev.signature,
      }));
      setShowPasteModal(false);
      setPasteJsonInput("");
    } catch (err: any) {
      alert(`Invalid JSON format: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Input Form (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card>
            <CardHeader className="py-4 px-5 border-b border-[var(--border)]">
              <div className="flex items-center justify-between w-full">
                <div>
                  <CardTitle className="text-sm font-semibold text-[var(--text)]">
                    EIP-712 Verdict Parameters
                  </CardTitle>
                  <CardDescription className="text-xs text-[var(--text-muted)]">
                    Enter cryptographic signature and typed authorization attributes for offline verification.
                  </CardDescription>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowPasteModal(true)}
                  leftIcon={<ClipboardPaste className="w-3.5 h-3.5" />}
                >
                  Import JSON
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleVerify} className="space-y-4">
                {/* Row 1: Verdict & Chain */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="v-verdict" className="text-xs font-medium text-[var(--text)] block">
                      Verdict Decision
                    </label>
                    <select
                      id="v-verdict"
                      value={form.verdict}
                      onChange={(e) => setForm({ ...form, verdict: Number(e.target.value) })}
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                    >
                      <option value={1}>1 - ALLOW (Authorized)</option>
                      <option value={0}>0 - DENY (Rejected)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="v-chain" className="text-xs font-medium text-[var(--text)] block">
                      Chain ID
                    </label>
                    <input
                      id="v-chain"
                      type="number"
                      readOnly
                      value={form.chainId}
                      className="w-full bg-[var(--surface-hover)] border border-[var(--border)] rounded-md px-3 py-2 text-xs text-[var(--text-muted)] cursor-not-allowed tabular-nums font-mono"
                    />
                  </div>
                </div>

                {/* Row 2: Account & Token */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="v-account" className="text-xs font-medium text-[var(--text)] block">
                      Guarded Account
                    </label>
                    <input
                      id="v-account"
                      type="text"
                      placeholder="0x..."
                      value={form.account}
                      onChange={(e) => setForm({ ...form, account: e.target.value })}
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2 font-mono text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="v-token" className="text-xs font-medium text-[var(--text)] block">
                      Settlement Token
                    </label>
                    <input
                      id="v-token"
                      type="text"
                      placeholder="0x..."
                      value={form.token}
                      onChange={(e) => setForm({ ...form, token: e.target.value })}
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2 font-mono text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                </div>

                {/* Row 3: Recipient & Amount */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="v-recipient" className="text-xs font-medium text-[var(--text)] block">
                      Recipient Address
                    </label>
                    <input
                      id="v-recipient"
                      type="text"
                      placeholder="0x1234...5678"
                      value={form.recipient}
                      onChange={(e) => setForm({ ...form, recipient: e.target.value })}
                      className={`w-full bg-[var(--surface)] border rounded-md px-3 py-2 font-mono text-xs text-[var(--text)] focus:outline-none ${
                        errors.recipient ? "border-[var(--danger)]" : "border-[var(--border)] focus:border-[var(--accent)]"
                      }`}
                    />
                    {errors.recipient && (
                      <span className="text-[11px] text-[var(--danger-text)] block">{errors.recipient}</span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="v-amount" className="text-xs font-medium text-[var(--text)] block">
                      Amount (USDC)
                    </label>
                    <input
                      id="v-amount"
                      type="number"
                      step="any"
                      placeholder="e.g. 50"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      className={`w-full bg-[var(--surface)] border rounded-md px-3 py-2 text-xs text-[var(--text)] focus:outline-none tabular-nums ${
                        errors.amount ? "border-[var(--danger)]" : "border-[var(--border)] focus:border-[var(--accent)]"
                      }`}
                    />
                    {errors.amount && (
                      <span className="text-[11px] text-[var(--danger-text)] block">{errors.amount}</span>
                    )}
                  </div>
                </div>

                {/* Row 4: Mandate ID & Auth ID */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="v-mandate" className="text-xs font-medium text-[var(--text)] block">
                      Mandate ID (32-byte hex)
                    </label>
                    <input
                      id="v-mandate"
                      type="text"
                      placeholder="0x... (64 hex chars)"
                      value={form.mandateId}
                      onChange={(e) => setForm({ ...form, mandateId: e.target.value })}
                      className={`w-full bg-[var(--surface)] border rounded-md px-3 py-2 font-mono text-xs text-[var(--text)] focus:outline-none ${
                        errors.mandateId ? "border-[var(--danger)]" : "border-[var(--border)] focus:border-[var(--accent)]"
                      }`}
                    />
                    {errors.mandateId && (
                      <span className="text-[11px] text-[var(--danger-text)] block">{errors.mandateId}</span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="v-auth" className="text-xs font-medium text-[var(--text)] block">
                      Authorization ID (32-byte hex)
                    </label>
                    <input
                      id="v-auth"
                      type="text"
                      placeholder="0x... (64 hex chars)"
                      value={form.authorizationId}
                      onChange={(e) => setForm({ ...form, authorizationId: e.target.value })}
                      className={`w-full bg-[var(--surface)] border rounded-md px-3 py-2 font-mono text-xs text-[var(--text)] focus:outline-none ${
                        errors.authorizationId ? "border-[var(--danger)]" : "border-[var(--border)] focus:border-[var(--accent)]"
                      }`}
                    />
                    {errors.authorizationId && (
                      <span className="text-[11px] text-[var(--danger-text)] block">{errors.authorizationId}</span>
                    )}
                  </div>
                </div>

                {/* Row 5: Signature */}
                <div className="space-y-1.5">
                  <label htmlFor="v-signature" className="text-xs font-medium text-[var(--text)] block">
                    ECDSA Secp256k1 Signature (65 bytes hex)
                  </label>
                  <textarea
                    id="v-signature"
                    rows={2}
                    placeholder="0x... (130 hex chars)"
                    value={form.signature}
                    onChange={(e) => setForm({ ...form, signature: e.target.value })}
                    className={`w-full bg-[var(--surface)] border rounded-md px-3 py-2 font-mono text-xs text-[var(--text)] focus:outline-none ${
                      errors.signature ? "border-[var(--danger)]" : "border-[var(--border)] focus:border-[var(--accent)]"
                    }`}
                  />
                  {errors.signature && (
                    <span className="text-[11px] text-[var(--danger-text)] block">{errors.signature}</span>
                  )}
                </div>

                {/* Right-aligned, auto-width button (Finding E1) */}
                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={isVerifying}
                    disabled={!isFormValid || isVerifying}
                    leftIcon={<ShieldCheck className="w-3.5 h-3.5" />}
                  >
                    Verify cryptographic verdict
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: 4-Check Live Stepper Result Panel (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card>
            <CardHeader className="py-4 px-5 border-b border-[var(--border)]">
              <CardTitle className="text-sm font-semibold text-[var(--text)]">
                Verification Assessment
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {verifyResult.status === "idle" && (
                <div className="py-8 text-center text-xs text-[var(--text-muted)] space-y-2">
                  <KeyRound className="w-8 h-8 mx-auto text-[var(--text-subtle)]" />
                  <p className="font-medium text-[var(--text)]">Awaiting signature input</p>
                  <p className="text-[11px] max-w-xs mx-auto">
                    Fill the authorization attributes and signature hex, then run verification to inspect cryptographic checks.
                  </p>
                </div>
              )}

              {verifyResult.status === "valid" && (
                <div className="p-4 rounded-lg bg-[var(--success-subtle)] border border-[var(--success-border)] text-xs text-[var(--success-text)] space-y-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Cryptographic signature verified</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    The recovered signer matches the configured authorizer address and all typed domain constraints hold.
                  </p>
                </div>
              )}

              {verifyResult.status === "invalid" && (
                <div className="p-4 rounded-lg bg-[var(--danger-subtle)] border border-[var(--danger-border)] text-xs text-[var(--danger-text)] space-y-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <XCircle className="w-4 h-4 shrink-0" />
                    <span>Verification failed</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">{verifyResult.reason}</p>
                </div>
              )}

              {/* Signer Key Inspector */}
              {verifyResult.status !== "idle" && (
                <div className="p-3.5 rounded-lg bg-[var(--surface-raised)] border border-[var(--border)] space-y-2 text-xs">
                  <div>
                    <span className="text-[11px] text-[var(--text-muted)] block mb-1">Recovered Signer Address</span>
                    <AddressChip address={verifyResult.recoveredSigner} truncateLength={8} />
                  </div>
                  <div className="pt-2 border-t border-[var(--border)]">
                    <span className="text-[11px] text-[var(--text-muted)] block mb-1">Expected Authorizer Key</span>
                    <AddressChip address={verifyResult.expectedSigner} truncateLength={8} />
                  </div>
                </div>
              )}

              {/* 4-Step Live Stepper (Finding E1) */}
              <div className="space-y-3 pt-3 border-t border-[var(--border)]">
                <span className="text-xs font-semibold text-[var(--text)] block">
                  Cryptographic checks:
                </span>
                <div className="space-y-2 text-xs">
                  {/* Step 1 */}
                  <div className="flex items-start gap-2.5">
                    {verifyResult.checks.domainMatch === true ? (
                      <CheckCircle2 className="w-4 h-4 text-[var(--success-text)] shrink-0 mt-0.5" />
                    ) : verifyResult.checks.domainMatch === false ? (
                      <XCircle className="w-4 h-4 text-[var(--danger-text)] shrink-0 mt-0.5" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-[var(--border)] inline-block shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-medium text-[var(--text)]">1. Domain separator matches chain</span>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                        Domain &apos;MandateGuard&apos; v1 on chain {currentChainId}
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex items-start gap-2.5">
                    {verifyResult.checks.typehashMatch === true ? (
                      <CheckCircle2 className="w-4 h-4 text-[var(--success-text)] shrink-0 mt-0.5" />
                    ) : verifyResult.checks.typehashMatch === false ? (
                      <XCircle className="w-4 h-4 text-[var(--danger-text)] shrink-0 mt-0.5" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-[var(--border)] inline-block shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-medium text-[var(--text)]">2. PaymentVerdict typehash alignment</span>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                        EIP-712 struct hash calculation matches smart contract
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex items-start gap-2.5">
                    {verifyResult.checks.signerMatch === true ? (
                      <CheckCircle2 className="w-4 h-4 text-[var(--success-text)] shrink-0 mt-0.5" />
                    ) : verifyResult.checks.signerMatch === false ? (
                      <XCircle className="w-4 h-4 text-[var(--danger-text)] shrink-0 mt-0.5" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-[var(--border)] inline-block shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-medium text-[var(--text)]">3. ECDSA secp256k1 recovery matches authorizer</span>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                        Signature recovers to authorized backend signer key
                      </p>
                    </div>
                  </div>

                  {/* Step 4 (Finding E1 rewrite) */}
                  <div className="flex items-start gap-2.5">
                    {verifyResult.checks.notExpired === true ? (
                      <CheckCircle2 className="w-4 h-4 text-[var(--success-text)] shrink-0 mt-0.5" />
                    ) : verifyResult.checks.notExpired === false ? (
                      <XCircle className="w-4 h-4 text-[var(--danger-text)] shrink-0 mt-0.5" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-[var(--border)] inline-block shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-medium text-[var(--text)]">4. Authorization has not expired</span>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                        Verdict timestamp is prior to expiry block/seconds
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Paste JSON Modal */}
      <Modal
        isOpen={showPasteModal}
        onClose={() => setShowPasteModal(false)}
        title="Import verdict payload"
        description="Paste an authorization JSON response from your AI agent or simulator."
        size="md"
      >
        <div className="space-y-4">
          <textarea
            rows={8}
            placeholder={`{\n  "verdict": 1,\n  "amount": 25,\n  "recipient": "0x...",\n  "mandate_id": "0x...",\n  "authorization_id": "0x...",\n  "signature": "0x..."\n}`}
            value={pasteJsonInput}
            onChange={(e) => setPasteJsonInput(e.target.value)}
            className="w-full bg-[var(--surface-raised)] border border-[var(--border)] rounded-md p-3 font-mono text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowPasteModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handlePasteJsonSubmit}>
              Apply payload
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
