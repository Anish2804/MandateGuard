export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 31337);
export const SMART_ACCOUNT_ADDR =
  process.env.NEXT_PUBLIC_SMART_ACCOUNT_ADDRESS || "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
export const MOCK_USDC_ADDR =
  process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";

export interface Mandate {
  id: string;
  title: string;
  account: string;
  agent: string;
  token: string;
  recipient: string | null;
  max_amount_per_tx: number;
  max_cumulative_amount: number;
  current_spent: number;
  reserved_amount: number;
  remaining_budget: number;
  chain_id: number;
  start_time: number;
  expiry: number;
  version: number;
  is_revoked: boolean;
  status: string;
}

export interface PaymentVerdict {
  verdict: number;
  verdict_label: "ALLOW" | "DENY";
  authorization_id: string;
  mandate_id: string;
  account: string;
  token: string;
  recipient: string;
  amount: number;
  chain_id: number;
  expiry: number;
  mandate_version: number;
  signature: string | null;
  authorizer_address: string | null;
  reason: string;
  status: string;
}

export interface PaymentRequestItem {
  id: string;
  mandate_id: string;
  idempotency_key: string;
  account: string;
  token: string;
  recipient: string;
  amount: number;
  chain_id: number;
  verdict: number;
  verdict_label: "ALLOW" | "DENY";
  authorization_id: string;
  expiry: number;
  status: string;
  tx_hash: string | null;
  rejection_reason: string | null;
  created_at: string;
  settled_at: string | null;
}

export interface AuditEventItem {
  id: string;
  event_type: string;
  mandate_id: string | null;
  request_id: string | null;
  details: Record<string, any>;
  created_at: string;
}

export interface SystemHealth {
  status: string;
  service: string;
  version: string;
  chain_id: number;
  smart_account: string;
  authorizer_signer: string;
  database: string;
  timestamp: number;
}

// --- API Helpers ---

export async function fetchHealth(): Promise<SystemHealth> {
  const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
  return res.json();
}

export async function fetchMandates(): Promise<Mandate[]> {
  const res = await fetch(`${API_URL}/api/v1/mandates`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch mandates");
  return res.json();
}

export async function createMandate(data: {
  title: string;
  account: string;
  agent: string;
  token: string;
  recipient?: string | null;
  max_amount_per_tx: number;
  max_cumulative_amount: number;
  chain_id?: number;
  expiry: number;
}): Promise<Mandate> {
  const res = await fetch(`${API_URL}/api/v1/mandates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Failed to create mandate");
  }
  return res.json();
}

export async function revokeMandate(mandateId: string): Promise<Mandate> {
  const res = await fetch(`${API_URL}/api/v1/mandates/${mandateId}/revoke`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to revoke mandate");
  return res.json();
}

export async function requestAuthorization(data: {
  mandate_id: string;
  account: string;
  token: string;
  recipient: string;
  amount: number;
  chain_id: number;
  idempotency_key: string;
}): Promise<PaymentVerdict> {
  const res = await fetch(`${API_URL}/api/v1/authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Authorization request failed");
  }
  return res.json();
}

export async function verifyVerdictSignature(data: {
  verdict: number;
  chain_id: number;
  account: string;
  token: string;
  recipient: string;
  amount: number;
  mandate_id: string;
  authorization_id: string;
  expiry: number;
  mandate_version: number;
  signature: string;
}) {
  const res = await fetch(`${API_URL}/api/v1/verdicts/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function settlePayment(authorizationId: string, txHash: string) {
  const res = await fetch(`${API_URL}/api/v1/settle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authorization_id: authorizationId, tx_hash: txHash }),
  });
  if (!res.ok) throw new Error("Failed to settle payment");
  return res.json();
}

export async function fetchRequests(): Promise<PaymentRequestItem[]> {
  const res = await fetch(`${API_URL}/api/v1/requests`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch requests");
  return res.json();
}

export async function fetchAuditEvents(): Promise<AuditEventItem[]> {
  const res = await fetch(`${API_URL}/api/v1/audit-events`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch audit events");
  return res.json();
}

// --- Direct Local EVM RPC Helpers ---

export async function rpcCall(method: string, params: any[] = []): Promise<any> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "RPC call error");
  return data.result;
}

export interface OnChainBalances {
  smartAccountBal: number | null;
  merchantBal: number | null;
  blockNumber: number | null;
  error?: string | null;
}

export async function getOnChainBalances(
  merchantAddr: string,
  targetAccount: string = SMART_ACCOUNT_ADDR
): Promise<OnChainBalances> {
  try {
    // 0x70a08231 = balanceOf(address)
    const cleanAccount = (targetAccount || SMART_ACCOUNT_ADDR).toLowerCase().replace("0x", "").padStart(64, "0");
    const accountBalHex = await rpcCall("eth_call", [
      { to: MOCK_USDC_ADDR, data: `0x70a08231${cleanAccount}` },
      "latest",
    ]);
    const smartAccountBal = parseInt(accountBalHex || "0x0", 16) / 1e6;

    let merchantBal: number | null = 0;
    if (merchantAddr && merchantAddr.startsWith("0x")) {
      const cleanMerchant = merchantAddr.toLowerCase().replace("0x", "").padStart(64, "0");
      const merchantBalHex = await rpcCall("eth_call", [
        { to: MOCK_USDC_ADDR, data: `0x70a08231${cleanMerchant}` },
        "latest",
      ]);
      merchantBal = parseInt(merchantBalHex || "0x0", 16) / 1e6;
    }

    const blockNumHex = await rpcCall("eth_blockNumber", []);
    const blockNumber = parseInt(blockNumHex, 16);

    return { smartAccountBal, merchantBal, blockNumber, error: null };
  } catch (err: any) {
    console.warn("RPC balance query failed:", err);
    return {
      smartAccountBal: null,
      merchantBal: null,
      blockNumber: null,
      error: err?.message || "RPC connection failed",
    };
  }
}

export interface ApiKeyItem {
  id: string;
  name: string;
  key_prefix: string;
  account_address: string;
  is_active: boolean;
  created_at: string;
}

export interface ApiKeyCreatedResult {
  id: string;
  name: string;
  key_prefix: string;
  api_key: string;
  account_address: string;
  is_active: boolean;
  created_at: string;
}

export async function createApiKey(data: { user_id: string; account_address: string; name: string }): Promise<ApiKeyCreatedResult> {
  const res = await fetch(`${API_URL}/api/v1/auth/api-keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to generate API Key");
  return res.json();
}

export async function fetchApiKeys(account?: string): Promise<ApiKeyItem[]> {
  try {
    const url = account ? `${API_URL}/api/v1/auth/api-keys?account=${account}` : `${API_URL}/api/v1/auth/api-keys`;
    const res = await fetch(url);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function revokeApiKey(keyId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/api-keys/${keyId}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}
