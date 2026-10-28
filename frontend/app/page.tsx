"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppShell, NavRoute } from "../components/layout/AppShell";
import { Toast } from "../components/ui/Toast";
import { OverviewView } from "../components/views/OverviewView";
import { AgentsView } from "../components/views/AgentsView";
import { MandatesView } from "../components/views/MandatesView";
import { RequestsView } from "../components/views/RequestsView";
import { VerdictView } from "../components/views/VerdictView";
import { TransactionsView } from "../components/views/TransactionsView";
import { AuditView } from "../components/views/AuditView";
import { SecurityView } from "../components/views/SecurityView";
import { SettingsView } from "../components/views/SettingsView";

import {
  fetchHealth,
  fetchMandates,
  createMandate,
  revokeMandate,
  fetchRequests,
  fetchAuditEvents,
  fetchApiKeys,
  createApiKey,
  revokeApiKey,
  getOnChainBalances,
  Mandate,
  PaymentRequestItem,
  AuditEventItem,
  SystemHealth,
  ApiKeyItem,
  SMART_ACCOUNT_ADDR,
  CHAIN_ID,
} from "../lib/api";

import {
  connectInjectedWallet,
  getFactoryAccountsForOwner,
  deploySmartAccountViaWallet,
  claimFaucetTokens,
  registerMandateOnChain,
  revokeMandateOnChain,
} from "../lib/web3";
import { SUPPORTED_CHAINS } from "../lib/contracts";

export default function SecurityConsole() {
  const [currentRoute, setCurrentRoute] = useState<NavRoute>("overview");

  // Web3 State
  const [walletAddress, setWalletAddress] = useState<`0x${string}` | null>(null);
  const [walletChainId, setWalletChainId] = useState<number | null>(null);
  const [userSmartAccounts, setUserSmartAccounts] = useState<`0x${string}`[]>([]);
  const [activeSmartAccount, setActiveSmartAccount] = useState<string>(SMART_ACCOUNT_ADDR);
  const [isDeployingAccount, setIsDeployingAccount] = useState(false);
  const [isClaimingFaucet, setIsClaimingFaucet] = useState(false);

  // Application Telemetry State (Ground-Truth Data Only)
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [mandates, setMandates] = useState<Mandate[]>([]);
  const [requests, setRequests] = useState<PaymentRequestItem[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEventItem[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [smartAccountBalance, setSmartAccountBalance] = useState<number | null>(null);
  const [rpcError, setRpcError] = useState<string | null>(null);

  // Loading & UI State
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error" | "warning" | "info";
    message: string;
  } | null>(null);

  const showToast = useCallback(
    (type: "success" | "error" | "warning" | "info", message: string) => {
      setToast({ type, message });
    },
    []
  );

  // Load all telemetry from actual backend and RPC
  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [h, m, reqs, aud, keys] = await Promise.all([
        fetchHealth().catch(() => null),
        fetchMandates().catch(() => []),
        fetchRequests().catch(() => []),
        fetchAuditEvents().catch(() => []),
        fetchApiKeys().catch(() => []),
      ]);

      setHealth(h);
      setMandates(m);
      setRequests(reqs);
      setAuditEvents(aud);
      setApiKeys(keys);

      const currentChain = walletChainId || CHAIN_ID;
      const chainConfig =
        SUPPORTED_CHAINS[currentChain as keyof typeof SUPPORTED_CHAINS] ||
        SUPPORTED_CHAINS[84532];

      // Query on-chain balance for the active smart account without fake fallbacks
      const bals = await getOnChainBalances(
        "",
        activeSmartAccount,
        chainConfig.mockUsdc,
        chainConfig.rpcUrl
      );
      setSmartAccountBalance(bals.smartAccountBal);
      setRpcError(bals.error || null);
    } catch (err: any) {
      console.warn("Telemetry refresh warning:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [activeSmartAccount, walletChainId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Connect Web3 Wallet
  const handleConnectWallet = async () => {
    try {
      const { address, chainId } = await connectInjectedWallet();
      setWalletAddress(address);
      setWalletChainId(chainId);
      showToast("success", `Wallet connected: ${address.slice(0, 6)}...${address.slice(-4)}`);

      // Discover Smart Accounts owned by this wallet
      const accounts = await getFactoryAccountsForOwner(address, chainId);
      setUserSmartAccounts(accounts);
      if (accounts.length > 0) {
        setActiveSmartAccount(accounts[0]);
        showToast("info", `Active Smart Account: ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`);
      }
    } catch (err: any) {
      showToast("error", err.message || "Failed to connect wallet");
    }
  };

  // Deploy Smart Account via Factory
  const handleDeploySmartAccount = async () => {
    if (!walletAddress) {
      handleConnectWallet();
      return;
    }
    setIsDeployingAccount(true);
    try {
      const currentChain = walletChainId || CHAIN_ID;
      showToast("info", "Deploying isolated Smart Account via MandateGuardFactory...");
      const { txHash } = await deploySmartAccountViaWallet(walletAddress, currentChain);
      showToast("success", `Account deployed on-chain! Tx: ${txHash.slice(0, 10)}...`);

      setTimeout(async () => {
        const accounts = await getFactoryAccountsForOwner(walletAddress, currentChain);
        setUserSmartAccounts(accounts);
        if (accounts.length > 0) {
          setActiveSmartAccount(accounts[accounts.length - 1]);
        }
        loadData();
      }, 2500);
    } catch (err: any) {
      showToast("error", err.message || "Smart account deployment failed");
    } finally {
      setIsDeployingAccount(false);
    }
  };

  // Claim Faucet Tokens
  const handleClaimFaucet = async () => {
    if (!walletAddress) {
      showToast("error", "Please connect your wallet first to claim testnet USDC");
      return;
    }
    setIsClaimingFaucet(true);
    try {
      const currentChain = walletChainId || CHAIN_ID;
      const target = (activeSmartAccount || walletAddress) as `0x${string}`;
      showToast("info", `Minting 1,000 USDC to ${target.slice(0, 8)}...`);
      const txHash = await claimFaucetTokens(target, 1000, walletAddress, currentChain);
      showToast("success", `Claimed 1,000 USDC! Tx: ${txHash.slice(0, 10)}...`);
      setTimeout(loadData, 2500);
    } catch (err: any) {
      showToast("error", err.message || "Faucet claim failed");
    } finally {
      setIsClaimingFaucet(false);
    }
  };

  // On-Chain Mandate Registration
  const handleRegisterOnChain = async (mandate: Mandate): Promise<string> => {
    if (!walletAddress) {
      throw new Error("Wallet not connected");
    }

    const txHash = await registerMandateOnChain(
      activeSmartAccount as `0x${string}`,
      {
        mandateId: mandate.id as `0x${string}`,
        agent: mandate.agent as `0x${string}`,
        token: mandate.token as `0x${string}`,
        recipient: (mandate.recipient || "0x0000000000000000000000000000000000000000") as `0x${string}`,
        maxAmountPerTx: mandate.max_amount_per_tx,
        maxCumulativeAmount: mandate.max_cumulative_amount,
        startTime: mandate.start_time,
        expiry: mandate.expiry,
      },
      walletAddress,
      walletChainId || CHAIN_ID
    );

    return txHash;
  };

  // On-Chain Mandate Revocation
  const handleRevokeOnChain = async (mandateId: string): Promise<string> => {
    if (!walletAddress) {
      throw new Error("Wallet not connected");
    }
    return await revokeMandateOnChain(
      activeSmartAccount as `0x${string}`,
      mandateId as `0x${string}`,
      walletAddress,
      walletChainId || CHAIN_ID
    );
  };

  const activeMandatesCount = mandates.filter((m) => !m.is_revoked && m.remaining_budget > 0).length;
  const pendingRequestsCount = requests.filter((r) => r.status === "AUTHORIZED" || (r.verdict === 1 && r.status !== "SETTLED")).length;
  const activeAgentsCount = apiKeys.filter((k) => k.is_active).length;

  return (
    <AppShell
      currentRoute={currentRoute}
      onRouteChange={setCurrentRoute}
      walletAddress={walletAddress}
      walletChainId={walletChainId}
      onConnectWallet={handleConnectWallet}
      userSmartAccounts={userSmartAccounts}
      activeSmartAccount={activeSmartAccount}
      onSelectSmartAccount={(acc) => {
        setActiveSmartAccount(acc);
        showToast("info", `Active Smart Account switched to ${acc.slice(0, 6)}...${acc.slice(-4)}`);
      }}
      onDeploySmartAccount={handleDeploySmartAccount}
      isDeployingAccount={isDeployingAccount}
      onClaimFaucet={handleClaimFaucet}
      isClaimingFaucet={isClaimingFaucet}
      onRefresh={loadData}
      isRefreshing={isRefreshing}
      backendHealthy={health?.status === "healthy"}
      rpcHealthy={!rpcError}
      smartAccountBalance={smartAccountBalance}
      counts={{
        activeMandates: activeMandatesCount,
        pendingRequests: pendingRequestsCount,
        activeAgents: activeAgentsCount,
      }}
    >
      {/* Route 1: Overview */}
      {currentRoute === "overview" && (
        <OverviewView
          health={health}
          mandates={mandates}
          requests={requests}
          auditEvents={auditEvents}
          smartAccountBalance={smartAccountBalance}
          rpcError={rpcError}
          onNavigate={setCurrentRoute}
          onOpenCreateMandate={() => setCurrentRoute("mandates")}
        />
      )}

      {/* Route 2: Agents */}
      {currentRoute === "agents" && (
        <AgentsView
          apiKeys={apiKeys}
          activeSmartAccount={activeSmartAccount}
          onRefresh={loadData}
          onCreateApiKey={async (name, account) => {
            const res = await createApiKey({
              user_id: "default_user",
              account_address: account,
              name,
            });
            showToast("success", `Agent API key generated: ${name}`);
            return res;
          }}
          onRevokeApiKey={async (id) => {
            const ok = await revokeApiKey(id);
            if (ok) {
              showToast("info", "Agent API key revoked");
            }
            return ok;
          }}
        />
      )}

      {/* Route 3: Mandates & Policies */}
      {currentRoute === "mandates" && (
        <MandatesView
          mandates={mandates}
          activeSmartAccount={activeSmartAccount}
          walletAddress={walletAddress}
          walletChainId={walletChainId}
          onRefresh={loadData}
          onCreateMandate={async (data) => {
            const m = await createMandate(data);
            showToast("success", `Mandate policy "${m.title}" activated`);
            return m;
          }}
          onRevokeMandate={async (id) => {
            const m = await revokeMandate(id);
            showToast("info", `Mandate "${m.title}" revoked`);
            return m;
          }}
          onRegisterOnChain={handleRegisterOnChain}
          onRevokeOnChain={handleRevokeOnChain}
        />
      )}

      {/* Route 4: Payment Requests */}
      {currentRoute === "requests" && (
        <RequestsView
          requests={requests}
          mandates={mandates}
          activeSmartAccount={activeSmartAccount}
          walletAddress={walletAddress}
          walletChainId={walletChainId}
          onRefresh={loadData}
          showToast={showToast}
        />
      )}

      {/* Route 5: Verdict Verification */}
      {currentRoute === "verdict" && (
        <VerdictView
          activeSmartAccount={activeSmartAccount}
          defaultAuthorizerSigner={health?.authorizer_signer || null}
          walletChainId={walletChainId}
        />
      )}

      {/* Route 6: Transactions */}
      {currentRoute === "transactions" && (
        <TransactionsView
          requests={requests}
          walletChainId={walletChainId}
          activeSmartAccount={activeSmartAccount}
        />
      )}

      {/* Route 7: Audit Trail */}
      {currentRoute === "audit" && (
        <AuditView auditEvents={auditEvents} onRefresh={loadData} />
      )}

      {/* Route 8: Signers & Security */}
      {currentRoute === "security" && (
        <SecurityView
          health={health}
          activeSmartAccount={activeSmartAccount}
          walletAddress={walletAddress}
          walletChainId={walletChainId}
          smartAccountBalance={smartAccountBalance}
          onRefresh={loadData}
          showToast={showToast}
        />
      )}

      {/* Route 9: Networks & Settings */}
      {currentRoute === "settings" && (
        <SettingsView
          walletAddress={walletAddress}
          walletChainId={walletChainId}
          activeSmartAccount={activeSmartAccount}
          onRefresh={loadData}
          showToast={showToast}
        />
      )}

      {/* Global Toast Banner */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </AppShell>
  );
}
