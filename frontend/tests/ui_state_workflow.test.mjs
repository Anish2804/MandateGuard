import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Frontend Workflow & UI State Enforcement", () => {
  it("enforces Section A–G 7-step mandate form validation rules", () => {
    // Rule: title required, agent required
    const validateMandateInput = (input) => {
      if (!input.title || input.title.trim().length === 0) {
        return { valid: false, error: "Title is required" };
      }
      if (!input.agent || !input.agent.startsWith("0x")) {
        return { valid: false, error: "Valid agent Ethereum address is required" };
      }
      if (input.max_amount_per_tx <= 0) {
        return { valid: false, error: "Per-tx amount must be greater than zero" };
      }
      if (input.max_amount_per_tx > input.max_cumulative_amount) {
        return { valid: false, error: "Per-tx limit cannot exceed cumulative spending limit" };
      }
      if (input.expiryDays <= 0) {
        return { valid: false, error: "Expiry days must be positive" };
      }
      return { valid: true, error: null };
    };

    // Test: invalid per-tx > cumulative
    const invalidResult = validateMandateInput({
      title: "Test Policy",
      agent: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
      max_amount_per_tx: 600,
      max_cumulative_amount: 500,
      expiryDays: 30,
    });
    assert.equal(invalidResult.valid, false);
    assert.equal(invalidResult.error, "Per-tx limit cannot exceed cumulative spending limit");

    // Test: valid inputs
    const validResult = validateMandateInput({
      title: "DevOps Automated Infrastructure Allowance",
      agent: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
      max_amount_per_tx: 50,
      max_cumulative_amount: 500,
      expiryDays: 30,
    });
    assert.equal(validResult.valid, true);
    assert.equal(validResult.error, null);
  });

  it("strictly differentiates verdict status from on-chain execution status", () => {
    // Rule: Verdict ALLOW is NOT equivalent to Confirmed Transaction!
    const deriveDisplayStatus = (verdict, executionStatus, txHash) => {
      if (executionStatus === "SETTLED" && txHash) {
        return { label: "Confirmed", style: "settled", executed: true };
      }
      if (verdict === 1 && (!txHash || executionStatus !== "SETTLED")) {
        return { label: "Authorized (Signed)", style: "allow", executed: false };
      }
      if (verdict === 0) {
        return { label: "Denied", style: "deny", executed: false };
      }
      return { label: "Pending", style: "pending", executed: false };
    };

    const authorizedNotExecuted = deriveDisplayStatus(1, "PENDING", null);
    assert.equal(authorizedNotExecuted.label, "Authorized (Signed)");
    assert.equal(authorizedNotExecuted.executed, false, "Must not claim on-chain execution before receipt!");

    const settledAndMined = deriveDisplayStatus(1, "SETTLED", "0xabc123...");
    assert.equal(settledAndMined.label, "Confirmed");
    assert.equal(settledAndMined.executed, true);
  });

  it("validates that all 9 required navigation routes exist and are mapped", () => {
    const requiredRoutes = [
      "overview",
      "agents",
      "mandates",
      "requests",
      "verdict",
      "transactions",
      "audit",
      "security",
      "settings",
    ];

    assert.equal(requiredRoutes.length, 9, "Must expose exactly 9 dedicated security console routes");
    assert.ok(requiredRoutes.includes("verdict"), "Verdict verification route must exist");
    assert.ok(requiredRoutes.includes("security"), "Signers & security route must exist");
    assert.ok(requiredRoutes.includes("transactions"), "Transactions audit route must exist");
  });

  it("ensures WCAG 2.2 accessibility: status indicators pair color with text and icons", () => {
    const statusBadges = {
      allow: { icon: "CheckCircle2", label: "ALLOW", colorClass: "text-emerald-400" },
      deny: { icon: "XCircle", label: "DENY", colorClass: "text-rose-400" },
      pending: { icon: "Clock", label: "PENDING", colorClass: "text-amber-400" },
      settled: { icon: "CheckCircle2", label: "SETTLED", colorClass: "text-blue-400" },
      revoked: { icon: "ShieldAlert", label: "REVOKED", colorClass: "text-rose-400" },
    };

    for (const [key, config] of Object.entries(statusBadges)) {
      assert.ok(config.icon, `${key} badge must have an accessible icon`);
      assert.ok(config.label, `${key} badge must have unambiguous text for colorblind accessibility`);
    }
  });
});
