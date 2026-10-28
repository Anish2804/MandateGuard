"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  FileCode,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Search,
  ExternalLink,
  Layers,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { verifyVerdictSignature, MOCK_USDC_ADDR, CHAIN_ID } from "../../lib/api";

export interface VerdictViewProps {
  activeSmartAccount: string;
  defaultAuthorizerSigner: string | null;
}

export function VerdictView({
  activeSmartAccount,
  defaultAuthorizerSigner,
}: VerdictViewProps) {
  const [form, setForm] = useState({
    verdict: 1,
    chainId: CHAIN_ID,
    account: activeSmartAccount,
    token: MOCK_USDC_ADDR,
    recipient: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    amount: 25,
    mandateId: "0x0000000000000000000000000000000000000000000000000000000000000001",
    authorizationId: "0x0000000000000000000000000000000000000000000000000000000000000002",
    expiry: Math.floor(Date.now() / 1000) + 3600,
    mandateVersion: 1,
    signature: "",
  });

  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    isValid: boolean;
    recoveredSigner: string;
    expectedSigner: string;
    reason: string;
  } | null>(null);

  const [copiedSigner, setCopiedSigner] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.signature.trim()) {
      alert("Please provide an ECDSA signature hex string to verify");
      return;
    }

    setIsVerifying(true);
    setVerifyResult(null);

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
        isValid: res.is_valid,
        recoveredSigner: res.recovered_signer,
        expectedSigner: res.expected_signer,
        reason: res.reason,
      });
    } catch (err: any) {
      setVerifyResult({
        isValid: false,
        recoveredSigner: "0x0000000000000000000000000000000000000000",
        expectedSigner: defaultAuthorizerSigner || "Unknown",
        reason: `Verification execution failed: ${err.message}`,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card>
        <CardHeader>
          <CardTitle>Cryptographic EIP-712 Verdict Verification</CardTitle>
          <CardDescription>
            Inspect and mathematically verify authorizer signatures under the MandateGuard EIP-712 typed-data schema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 block font-sans">1. Signature Validity</span>
              <span className="text-indigo-400 font-semibold mt-1 block">
                ECDSA secp256k1 recovery
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 block font-sans">2. Policy Validity</span>
              <span className="text-slate-200 mt-1 block">Pre-signed boundary check</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 block font-sans">3. Replay Defense</span>
              <span className="text-slate-200 mt-1 block">Single-use authorization ID</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 block font-sans">4. Settlement Status</span>
              <span className="text-slate-200 mt-1 block">On-chain receipt observation</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Verification Form & Results Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle>Verdict Payload Parameters</CardTitle>
            <CardDescription>
              Enter the exact parameters signed in the PaymentVerdict struct.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerify} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="v-verdict" className="text-slate-400 block font-medium">Verdict</label>
                  <select
                    id="v-verdict"
                    value={form.verdict}
                    onChange={(e) => setForm({ ...form, verdict: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200"
                  >
                    <option value={1}>1 — ALLOW (Approved)</option>
                    <option value={0}>0 — DENY (Rejected)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="v-chain" className="text-slate-400 block font-medium">Chain ID</label>
                  <input
                    id="v-chain"
                    type="number"
                    value={form.chainId}
                    onChange={(e) => setForm({ ...form, chainId: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-slate-200"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="v-account" className="text-slate-400 block font-medium">Smart Account Address</label>
                <input
                  id="v-account"
                  type="text"
                  value={form.account}
                  onChange={(e) => setForm({ ...form, account: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="v-token" className="text-slate-400 block font-medium">Token Contract</label>
                  <input
                    id="v-token"
                    type="text"
                    value={form.token}
                    onChange={(e) => setForm({ ...form, token: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-slate-200"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="v-amount" className="text-slate-400 block font-medium">Amount (USDC)</label>
                  <input
                    id="v-amount"
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-slate-200"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="v-recipient" className="text-slate-400 block font-medium">Recipient Address</label>
                <input
                  id="v-recipient"
                  type="text"
                  value={form.recipient}
                  onChange={(e) => setForm({ ...form, recipient: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="v-mandate-id" className="text-slate-400 block font-medium">Mandate ID</label>
                  <input
                    id="v-mandate-id"
                    type="text"
                    value={form.mandateId}
                    onChange={(e) => setForm({ ...form, mandateId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-slate-200"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="v-auth-id" className="text-slate-400 block font-medium">Authorization ID Nonce</label>
                  <input
                    id="v-auth-id"
                    type="text"
                    value={form.authorizationId}
                    onChange={(e) => setForm({ ...form, authorizationId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-slate-200"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="v-sig" className="text-slate-300 block font-medium">
                  ECDSA Signature Hex <span className="text-rose-400">*</span>
                </label>
                <textarea
                  id="v-sig"
                  rows={2}
                  required
                  placeholder="0x..."
                  value={form.signature}
                  onChange={(e) => setForm({ ...form, signature: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-emerald-400 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full justify-center"
                  loading={isVerifying}
                  leftIcon={<ShieldCheck className="w-4 h-4" />}
                >
                  Verify EIP-712 Signature
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Verification Result Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Verification Analysis</CardTitle>
            <CardDescription>
              Direct result from backend cryptographic recovery module.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {verifyResult ? (
              <div className="space-y-4">
                <div
                  className={`p-4 rounded-xl border flex items-center justify-between ${
                    verifyResult.isValid
                      ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                      : "bg-rose-950/40 border-rose-500/40 text-rose-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {verifyResult.isValid ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-6 h-6 text-rose-400 shrink-0" />
                    )}
                    <div>
                      <span className="font-bold text-sm block">
                        {verifyResult.isValid
                          ? "Cryptographic Signature VALID"
                          : "Signature Verification FAILED"}
                      </span>
                      <span className="text-xs">{verifyResult.reason}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 font-mono text-xs">
                  <div>
                    <span className="text-slate-400 block font-sans">Recovered Signer:</span>
                    <span className="text-slate-100 font-semibold break-all">
                      {verifyResult.recoveredSigner}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-800">
                    <span className="text-slate-400 block font-sans">Expected Authorizer Signer:</span>
                    <span className="text-indigo-300 font-semibold break-all">
                      {verifyResult.expectedSigner}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-2">
                  <span className="font-semibold text-slate-200 block font-sans">
                    Verification Rule Compliance:
                  </span>
                  <ul className="space-y-1 list-disc list-inside text-slate-400">
                    <li>Domain Separator verified for Target Chain ID.</li>
                    <li>PaymentVerdict typehash matches smart account specification.</li>
                    <li>Timestamp verified against current epoch for expiration status.</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 text-xs space-y-2">
                <KeyRound className="w-8 h-8 mx-auto text-slate-600" />
                <p>Provide a signature and parameters on the left to execute cryptographic recovery.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
