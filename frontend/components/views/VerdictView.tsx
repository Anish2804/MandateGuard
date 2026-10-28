"use client";

import React, { useState } from "react";
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

  const [form, setForm] = useState({
    verdict: 1,
    chainId: currentChainId,
    account: activeSmartAccount as string,
    token: addresses.usdc as string,
    recipient: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    amount: 25,
    mandateId: "0x0000000000000000000000000000000000000000000000000000000000000001",
    authorizationId: "0x0000000000000000000000000000000000000000000000000000000000000002",
    expiry: Math.floor(Date.now() / 1000) + 3600,
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
  }>({
    status: "idle",
    recoveredSigner: "",
    expectedSigner: defaultAuthorizerSigner || "",
    reason: "",
  });

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.signature.trim()) {
      alert("Please provide an ECDSA signature string.");
      return;
    }

    setIsVerifying(true);
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

      setVerifyResult({
        status: res.is_valid ? "valid" : "invalid",
        recoveredSigner: res.recovered_signer,
        expectedSigner: res.expected_signer,
        reason: res.reason,
      });
    } catch (err: any) {
      setVerifyResult({
        status: "invalid",
        recoveredSigner: "0x0000000000000000000000000000000000000000",
        expectedSigner: defaultAuthorizerSigner || "Unknown",
        reason: err.message || "Cryptographic verification call failed",
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
        amount: parsed.amount ?? prev.amount,
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
    <div className="space-y-4">
      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Grouped Form (7 cols) */}
        <div className="lg:col-span-7">
          <Card>
            <CardHeader className="py-2.5">
              <div className="flex items-center justify-between w-full">
                <CardTitle className="text-xs">Signed verdict parameters</CardTitle>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-[11px] px-2"
                  onClick={() => setShowPasteModal(true)}
                  leftIcon={<ClipboardPaste className="w-3 h-3" />}
                >
                  Paste JSON
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVerify} className="space-y-3 text-xs">
                {/* Group 1: Verdict & Chain */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label htmlFor="v-decision" className="text-[11px] font-medium text-[var(--text-muted)] block">
                      Verdict
                    </label>
                    <select
                      id="v-decision"
                      value={form.verdict}
                      onChange={(e) => setForm({ ...form, verdict: Number(e.target.value) })}
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2.5 py-1.5 text-xs text-[var(--text)] focus:outline-none"
                    >
                      <option value={1}>1 — ALLOW (Approved)</option>
                      <option value={0}>0 — DENY (Rejected)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="v-chain" className="text-[11px] font-medium text-[var(--text-muted)] block">
                      Chain ID
                    </label>
                    <input
                      id="v-chain"
                      type="number"
                      value={form.chainId}
                      onChange={(e) => setForm({ ...form, chainId: Number(e.target.value) })}
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2.5 py-1.5 font-mono text-xs text-[var(--text)] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Group 2: Account & Token */}
                <div className="space-y-1">
                  <label htmlFor="v-account" className="text-[11px] font-medium text-[var(--text-muted)] block">
                    Smart account
                  </label>
                  <input
                    id="v-account"
                    type="text"
                    value={form.account}
                    onChange={(e) => setForm({ ...form, account: e.target.value })}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2.5 py-1.5 font-mono text-xs text-[var(--text)] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label htmlFor="v-token" className="text-[11px] font-medium text-[var(--text-muted)] block">
                      Token contract
                    </label>
                    <input
                      id="v-token"
                      type="text"
                      value={form.token}
                      onChange={(e) => setForm({ ...form, token: e.target.value })}
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2.5 py-1.5 font-mono text-xs text-[var(--text)] focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="v-amount" className="text-[11px] font-medium text-[var(--text-muted)] block">
                      Amount (USDC)
                    </label>
                    <input
                      id="v-amount"
                      type="number"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2.5 py-1.5 font-mono text-xs tabular-nums text-[var(--text)] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Group 3: Recipient */}
                <div className="space-y-1">
                  <label htmlFor="v-recip" className="text-[11px] font-medium text-[var(--text-muted)] block">
                    Recipient address
                  </label>
                  <input
                    id="v-recip"
                    type="text"
                    value={form.recipient}
                    onChange={(e) => setForm({ ...form, recipient: e.target.value })}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2.5 py-1.5 font-mono text-xs text-[var(--text)] focus:outline-none"
                  />
                </div>

                {/* Group 4: Nonce & Mandate */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label htmlFor="v-mandate" className="text-[11px] font-medium text-[var(--text-muted)] block">
                      Mandate ID
                    </label>
                    <input
                      id="v-mandate"
                      type="text"
                      value={form.mandateId}
                      onChange={(e) => setForm({ ...form, mandateId: e.target.value })}
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2.5 py-1.5 font-mono text-xs text-[var(--text)] focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="v-auth" className="text-[11px] font-medium text-[var(--text-muted)] block">
                      Authorization ID nonce
                    </label>
                    <input
                      id="v-auth"
                      type="text"
                      value={form.authorizationId}
                      onChange={(e) => setForm({ ...form, authorizationId: e.target.value })}
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2.5 py-1.5 font-mono text-xs text-[var(--text)] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Group 5: Signature */}
                <div className="space-y-1">
                  <label htmlFor="v-signature" className="text-[11px] font-medium text-[var(--text)] block">
                    ECDSA signature hex <span className="text-[var(--danger-text)]">*</span>
                  </label>
                  <textarea
                    id="v-signature"
                    rows={2}
                    required
                    placeholder="0x..."
                    value={form.signature}
                    onChange={(e) => setForm({ ...form, signature: e.target.value })}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2.5 py-1.5 font-mono text-[11px] text-[var(--text)] placeholder-[var(--text-subtle)] focus:outline-none focus:border-[var(--border-strong)]"
                  />
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    className="w-full justify-center"
                    loading={isVerifying}
                    leftIcon={<ShieldCheck className="w-3.5 h-3.5" />}
                  >
                    Verify EIP-712 signature
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Result Panel & 4-Step Checklist (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card>
            <CardHeader className="py-2.5">
              <CardTitle className="text-xs">Verification result</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5">
              {verifyResult.status === "idle" && (
                <div className="py-8 text-center text-xs text-[var(--text-muted)] space-y-1.5">
                  <KeyRound className="w-6 h-6 mx-auto text-[var(--text-subtle)]" />
                  <p>Input signature parameters and run verification to inspect cryptographic recovery.</p>
                </div>
              )}

              {verifyResult.status === "valid" && (
                <div className="p-3 rounded bg-[var(--success-subtle)] border border-[var(--success-border)] text-xs text-[var(--success-text)] space-y-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Cryptographic signature valid</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Recovered signer mathematically matches the configured authorizer address.
                  </p>
                </div>
              )}

              {verifyResult.status === "invalid" && (
                <div className="p-3 rounded bg-[var(--danger-subtle)] border border-[var(--danger-border)] text-xs text-[var(--danger-text)] space-y-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <XCircle className="w-4 h-4 shrink-0" />
                    <span>Signature verification failed</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">{verifyResult.reason}</p>
                </div>
              )}

              {/* Signer Key Inspector */}
              {verifyResult.status !== "idle" && (
                <div className="p-3 rounded bg-[var(--surface-hover)] border border-[var(--border)] space-y-2 text-xs font-mono">
                  <div>
                    <span className="text-[11px] text-[var(--text-muted)] font-sans block">Recovered signer:</span>
                    <AddressChip address={verifyResult.recoveredSigner} truncateLength={6} />
                  </div>
                  <div className="pt-2 border-t border-[var(--border)]">
                    <span className="text-[11px] text-[var(--text-muted)] font-sans block">Expected authorizer key:</span>
                    <AddressChip address={verifyResult.expectedSigner} truncateLength={6} />
                  </div>
                </div>
              )}

              {/* 4 Verification Steps Checklist */}
              <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                <span className="text-xs font-semibold text-[var(--text)] block">
                  Verification criteria:
                </span>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 text-[var(--text)]">
                    {verifyResult.status === "valid" ? (
                      <Check className="w-3.5 h-3.5 text-[var(--success-text)]" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-[var(--border)] inline-block" />
                    )}
                    <span>1. EIP-712 domain separator matches chain</span>
                  </div>

                  <div className="flex items-center gap-2 text-[var(--text)]">
                    {verifyResult.status === "valid" ? (
                      <Check className="w-3.5 h-3.5 text-[var(--success-text)]" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-[var(--border)] inline-block" />
                    )}
                    <span>2. PaymentVerdict typehash alignment</span>
                  </div>

                  <div className="flex items-center gap-2 text-[var(--text)]">
                    {verifyResult.status === "valid" ? (
                      <Check className="w-3.5 h-3.5 text-[var(--success-text)]" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-[var(--border)] inline-block" />
                    )}
                    <span>3. ECDSA secp256k1 recovery matches key</span>
                  </div>

                  <div className="flex items-center gap-2 text-[var(--text)]">
                    {verifyResult.status === "valid" ? (
                      <Check className="w-3.5 h-3.5 text-[var(--success-text)]" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-[var(--border)] inline-block" />
                    )}
                    <span>4. Expiration timestamp unexpired</span>
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
        title="Paste verdict JSON"
        description="Quickly import an authorization verdict payload from agent logs or simulator output."
        size="md"
      >
        <div className="space-y-3">
          <textarea
            rows={8}
            placeholder={`{\n  "verdict": 1,\n  "amount": 25,\n  "recipient": "0x...",\n  "signature": "0x..."\n}`}
            value={pasteJsonInput}
            onChange={(e) => setPasteJsonInput(e.target.value)}
            className="w-full bg-[var(--surface-hover)] border border-[var(--border)] rounded p-2.5 font-mono text-xs text-[var(--text)] focus:outline-none"
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
