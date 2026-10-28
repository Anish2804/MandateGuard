# MandateGuard UI/UX & Frontend Audit

**Document Version:** 1.0.0  
**Date:** October 28, 2026  
**Auditor:** Principal UX Architect & Staff Frontend Engineer  
**Target:** Production-Grade AI-Agent Payment Security Console  

---

## 1. Executive Summary

MandateGuard provides cryptographic authorization and policy enforcement for autonomous AI agent payments. While the underlying smart contracts (`MandateGuardAccount.sol`, `MandateGuardFactory.sol`) and backend services (`FastAPI`, atomic SQL transactions, EIP-712 signing) are hardened, the existing frontend (`frontend/app/page.tsx`) was constructed as a single-page prototype.

This audit evaluates the frontend against production security console standards, WCAG 2.2 AA accessibility, data integrity mandates, and responsive design.

---

## 2. Prioritized Findings Matrix

| ID | Category | Severity | Finding | Remediation Plan |
|---|---|---|---|---|
| **AUD-01** | **Data Integrity** | **CRITICAL** | Silent fallback to fake 50,000 USDC balance in `lib/api.ts:240` and `app/page.tsx:88` when RPC is unreachable. | Remove all fabricated values. Return explicit `null` / error state and render an "Unavailable / RPC Disconnected" status banner. |
| **AUD-02** | **Architecture** | **HIGH** | Monolithic 1,500+ line `page.tsx` with unstructured tab switching and missing core navigation views. | Refactor into modular architecture: reusable UI primitives (`components/ui/`), persistent global application shell (`components/layout/AppShell.tsx`), and 9 dedicated console views (`components/views/`). |
| **AUD-03** | **Navigation** | **HIGH** | Missing 4 required operational consoles: Transactions, Verdict Verification, Signers & Security, and Networks & Settings. | Implement all 9 required navigation sections with live backend data and on-chain state inspection. |
| **AUD-04** | **Web3 & Contracts** | **HIGH** | Mandate creation and revocation were backend-only; on-chain smart contract registration (`registerMandate`) and revocation (`revokeMandate`) were absent from the UI. | Implement wallet-driven on-chain registration and revocation actions with explicit status differentiation (Policy Active vs. On-Chain Registered). |
| **AUD-05** | **Security UX** | **HIGH** | Emergency controls implemented in `MandateGuardAccount.sol` (`emergencyWithdrawToken`, `setAuthorizerSigner`) were absent from the console. | Build a dedicated "Signers & Security" console with high-risk emergency withdrawal dialogs, impact warnings, and signer key verification. |
| **AUD-06** | **Accessibility (a11y)** | **MEDIUM** | Modal overlays used raw `<div>` elements without ARIA attributes (`role="dialog"`, `aria-modal="true"`), focus traps, or ESC key handlers. | Implement accessible `Modal` component adhering to WCAG 2.2 AA with focus restoration, keyboard dismiss, and backdrop light-dismiss. |
| **AUD-07** | **Accessibility (a11y)** | **MEDIUM** | Form inputs lacked associated `<label>` elements; status indicators relied solely on color badges. | Connect all form inputs to semantic `<label>` elements via `htmlFor`/`id`; pair all status indicators with icons and unambiguous text. |
| **AUD-08** | **Design System** | **MEDIUM** | Inconsistent typography, arbitrary inline padding/margins, and no shared design system tokens. | Establish standard design tokens (colors, spacing, typography, radii, elevations) and reusable components (`Button`, `Badge`, `Card`, `Table`, `Skeleton`, `Toast`). |
| **AUD-09** | **Responsive Design** | **MEDIUM** | Large tables and multi-column metric grids clipped on mobile viewports (< 768px). | Implement responsive grid breakpoints (`grid-cols-1 md:grid-cols-2 lg:grid-cols-4`) and overflow-scrollable table containers with mobile card summaries. |
| **AUD-10** | **SEO & Metadata** | **LOW** | `app/layout.tsx` retained default boilerplate (`Create Next App`). | Implement semantic `<title>`, meta descriptions, theme color, and OpenGraph metadata. |

---

## 3. Detailed Technical Review

### 3.1 Data Integrity & Ground Truth Audit

**Rule:** *No hardcoded metrics, no fake balances, no fabricated transaction hashes, no mock success notifications.*

1. **RPC Balance Fallback (`frontend/lib/api.ts`)**:
   - *Line 240:* `console.warn("RPC query fallback:", err); return { smartAccountBal: 50000, merchantBal: 0, blockNumber: 1 };`
   - *Issue:* When Anvil or Base Sepolia RPC is unreachable, the UI falsely indicates the account holds $50,000.00 USDC.
   - *Fix:* Throw or return `{ smartAccountBal: null, merchantBal: null, blockNumber: null, error: err.message }`. The UI must display `Unavailable (RPC error)` with a retry button.

2. **Initial State Flashing (`frontend/app/page.tsx`)**:
   - *Line 88:* Initialized with fake 50,000 balance before fetch.
   - *Fix:* Initialize with `null` and display a skeleton pulse until actual RPC confirmation is received.

3. **Transaction Status Separation**:
   - Policy verdict (`ALLOW`) must never be styled as a confirmed transaction.
   - Execution status lifecycle: `Authorized (Signed)` → `Submitted (Pending)` → `Mined (Receipt Confirmed)` → `Settled (Reconciled)` or `Failed (Reverted)`.

---

### 3.2 Design System & Component Architecture

Existing UI relies heavily on ad-hoc Tailwind classes. To achieve production consistency, the frontend requires:

1. **Design Tokens (`globals.css`)**:
   - Neutral security palette: Deep obsidian (`#070a12`), elevated slate cards (`#0e1526`), borders (`#1e293b` / `#334155`).
   - Semantic status tokens:
     - Allow / Confirmed: Emerald (`#10b981`, `#059669`)
     - Deny / Reverted: Rose (`#f43f5e`, `#e11d48`)
     - Pending / Reserved: Amber (`#f59e0b`, `#d97706`)
     - Info / Authorized: Indigo / Sky (`#6366f1`, `#0284c7`)
2. **Component Primitives (`components/ui/`)**:
   - `Button.tsx`: Variants (`primary`, `secondary`, `danger`, `outline`, `ghost`), loading spinner, disabled state.
   - `Badge.tsx`: Semantic statuses with icons (`ALLOW`, `DENY`, `SETTLED`, `REVOKED`, `ACTIVE`, `PENDING`).
   - `Card.tsx`: Consistent borders, padding, and subtle elevation.
   - `Modal.tsx`: Accessible dialog with focus trap, ESC listener, and backdrop click dismiss.
   - `Table.tsx`: Searchable, sortable, responsive table with empty & skeleton states.
   - `Skeleton.tsx`: Content placeholder animations.
   - `Toast.tsx`: Accessible notifications with auto-dismiss and close controls.

---

### 3.3 The 9 Required Console Navigation Views

The application shell (`components/layout/AppShell.tsx`) must expose:

1. **Overview**: Live metric cards (active mandates, authorized/spent/reserved budget, request counts), system health, recent security alerts.
2. **Agents**: Agent API key provisioning, account-locking validation, active status, last activity, revocation.
3. **Mandates & Policies**: 7-step guided creation modal (A–G), budget limits, recipient restrictions, on-chain registration/revocation triggers via user wallet.
4. **Payment Requests**: Filterable request history, status breakdown, policy evaluation explanations for allowed/denied.
5. **Verdict Verification**: Interactive EIP-712 typed-data verification calling `/api/v1/verdicts/verify` with cryptographic recovery details.
6. **Transactions**: Mined transaction records, block numbers, gas used, explorer links, and `PaymentExecuted` event log inspection.
7. **Audit Trail**: Chronological immutable security events (`/api/v1/audit-events`) with detail JSON inspection and search.
8. **Signers & Security**: Authorizer signer address, KMS HSM status, owner administrative controls, and emergency token withdrawal modal with high-risk confirmation.
9. **Networks & Settings**: Supported chains (Base Sepolia 84532, Anvil 31337), live RPC connectivity checks, contract address display.

---

### 3.4 Accessibility (WCAG 2.2 AA) Action Plan

1. **Keyboard Operability**:
   - Ensure all interactive controls have visible focus rings (`focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2`).
   - Modals trap tab focus inside the dialog and restore focus to trigger button upon close.
2. **Screen Reader Support**:
   - Unique `id`s and `aria-describedby` associations for all form inputs.
   - Live regions (`aria-live="polite"`) for toast notifications and balance updates.
   - Semantic landmarks: `<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`.
3. **Color Contrast & Perception**:
   - Text against backgrounds strictly meets 4.5:1 ratio for body text and 3.0:1 for large headings.
   - Status indicators pair colors with icons (`CheckCircle2`, `XCircle`, `Clock`, `AlertTriangle`).

---

## 4. Verification and Implementation Roadmap

- **Phase 0:** Audit & Baseline *(Completed)*.
- **Phase 1:** Core Design System & Accessible UI Primitives (`components/ui/*`).
- **Phase 2:** Global Application Shell (`components/layout/AppShell.tsx`).
- **Phase 3:** Dedicated Console Views 1–3 (Overview, Agents, Mandates & Policies).
- **Phase 4:** Dedicated Console Views 4–6 (Payment Requests, Verdict Verification, Transactions).
- **Phase 5:** Dedicated Console Views 7–9 (Audit Trail, Signers & Security, Networks & Settings).
- **Phase 6:** Data Integrity Audit Fixes (`lib/api.ts` & `lib/web3.ts`).
- **Phase 7:** Automated Testing & WCAG 2.2 Verification.
