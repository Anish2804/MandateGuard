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
  switchWalletNetwork,
} from "../lib/web3";
import { SUPPORTED_CHAINS } from "../lib/contracts";
import { useNetworkState } from "../lib/useNetworkState";
import {
  DEMO_AGENTS,
  DEMO_MANDATES,
  DEMO_REQUESTS,
  DEMO_AUDIT_EVENTS,
  DEMO_SMART_ACCOUNT,
} from "../lib/demoData";

export default function SecurityConsole() {
  const [currentRoute, setCurrentRoute] = useState<NavRoute>("overview");

  // Web3 State
  const [walletAddress, setWalletAddress] = useState<`0x${string}` | null>(null);
  const [walletChainId, setWalletChainId] = useState<number | null>(null);
  const [userSmartAccounts, setUserSmartAccounts] = useState<`0x${string}`[]>([]);
  const [activeSmartAccount, setActiveSmartAccount] = useState<string>(SMART_ACCOUNT_ADDR);
  const [isDeployingAccount, setIsDeployingAccount] = useState(false);
  const [isClaimingFaucet, setIsClaimingFaucet] = useState(false);

  // Global Network State (Finding B3: single source of truth)
  const networkState = useNetworkState(walletChainId);

  // Demo Mode State (Finding H1: client-side only, persisted in localStorage)
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("mg_demo_mode");
      if (saved === "true") {
        setIsDemoMode(true);
      }
    }
  }, []);

  const handleToggleDemoMode = (val: boolean) => {
    setIsDemoMode(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("mg_demo_mode", String(val));
    }
  };

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

  // Real-time Web3 wallet event listeners (EIP-1193)
  useEffect(() => {
    if (typeof window === "undefined" || !(window as any).ethereum) return;
    const ethereum = (window as any).ethereum;

    const handleChainChanged = (chainIdHex: string) => {
      const newChainId = parseInt(chainIdHex, 16);
      setWalletChainId(newChainId);
      const chainName =
        SUPPORTED_CHAINS[newChainId as keyof typeof SUPPORTED_CHAINS]?.name ||
        `Chain ID ${newChainId}`;
      showToast("info", `Wallet switched to ${chainName}`);
      loadData();
    };

    const handleAccountsChanged = (accounts: string[]) => {
      if (!accounts || accounts.length === 0) {
        setWalletAddress(null);
        setWalletChainId(null);
        setUserSmartAccounts([]);
        showToast("info", "Wallet disconnected");
      } else {
        setWalletAddress(accounts[0] as `0x${string}`);
        showToast("success", `Account changed: ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`);
        loadData();
      }
    };

    ethereum.on("chainChanged", handleChainChanged);
    ethereum.on("accountsChanged", handleAccountsChanged);

    return () => {
      if (ethereum.removeListener) {
        ethereum.removeListener("chainChanged", handleChainChanged);
        ethereum.removeListener("accountsChanged", handleAccountsChanged);
      }
    };
  }, [loadData, showToast]);

  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);

  // Switch network via wallet
  const handleSwitchNetwork = async (targetChainId: number = 84532) => {
    setIsSwitchingNetwork(true);
    try {
      showToast("info", "Requesting network switch in wallet...");
      const updatedChainId = await switchWalletNetwork(targetChainId);
      setWalletChainId(updatedChainId);
      const targetName =
        SUPPORTED_CHAINS[updatedChainId as keyof typeof SUPPORTED_CHAINS]?.name ||
        "Base Sepolia";
      showToast("success", `Successfully switched to ${targetName}!`);
      await loadData();
    } catch (err: any) {
      if (err.code === 4001) {
        showToast("warning", "Network switch was cancelled in your wallet.");
      } else if (err.code === -32002) {
        showToast("warning", "Open MetaMask: a network switch request is already waiting for your approval.");
      } else {
        showToast("error", err.message || "Failed to switch network");
      }
    } finally {
      setIsSwitchingNetwork(false);
    }
  };

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

  // Display Telemetry: Switch cleanly between demo dataset and live telemetry
  const displayMandates = isDemoMode ? DEMO_MANDATES : mandates;
  const displayRequests = isDemoMode ? DEMO_REQUESTS : requests;
  const displayAuditEvents = isDemoMode ? DEMO_AUDIT_EVENTS : auditEvents;
  const displayApiKeys = isDemoMode ? DEMO_AGENTS : apiKeys;
  const displayBalance = isDemoMode ? 50000.00 : smartAccountBalance;
  const displaySmartAccount = isDemoMode ? DEMO_SMART_ACCOUNT : activeSmartAccount;

  const activeMandatesCount = displayMandates.filter((m) => !m.is_revoked && m.remaining_budget > 0).length;
  const pendingRequestsCount = displayRequests.filter((r) => r.status === "AUTHORIZED" || (r.verdict === 1 && r.status !== "SETTLED")).length;
  const activeAgentsCount = displayApiKeys.filter((k) => k.is_active).length;

  return (
    <AppShell
      currentRoute={currentRoute}
      onRouteChange={setCurrentRoute}
      walletAddress={walletAddress}
      walletChainId={walletChainId}
      onConnectWallet={handleConnectWallet}
      userSmartAccounts={userSmartAccounts}
      activeSmartAccount={displaySmartAccount}
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
      smartAccountBalance={displayBalance}
      latencyMs={networkState.latencyMs}
      isMismatch={networkState.isMismatch}
      isDemoMode={isDemoMode}
      onToggleDemoMode={handleToggleDemoMode}
      counts={{
        activeMandates: activeMandatesCount,
        pendingRequests: pendingRequestsCount,
        activeAgents: activeAgentsCount,
      }}
      onSwitchNetwork={handleSwitchNetwork}
      isSwitchingNetwork={isSwitchingNetwork}
    >
      {/* Route 1: Overview */}
      {currentRoute === "overview" && (
        <OverviewView
          health={health}
          mandates={displayMandates}
          requests={displayRequests}
          auditEvents={displayAuditEvents}
          smartAccountBalance={displayBalance}
          rpcError={rpcError}
          walletAddress={walletAddress}
          isMismatch={networkState.isMismatch}
          onConnectWallet={handleConnectWallet}
          agentCount={activeAgentsCount}
          onNavigate={setCurrentRoute}
          onOpenCreateMandate={() => setCurrentRoute("mandates")}
        />
      )}

      {/* Route 2: Agents */}
      {currentRoute === "agents" && (
        <AgentsView
          apiKeys={displayApiKeys}
          activeSmartAccount={displaySmartAccount}
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
          mandates={displayMandates}
          activeSmartAccount={displaySmartAccount}
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
          requests={displayRequests}
          mandates={displayMandates}
          activeSmartAccount={displaySmartAccount}
          walletAddress={walletAddress}
          walletChainId={walletChainId}
          onRefresh={loadData}
          showToast={showToast}
        />
      )}

      {/* Route 5: Verdict Verification */}
      {currentRoute === "verdict" && (
        <VerdictView
          activeSmartAccount={displaySmartAccount}
          defaultAuthorizerSigner={health?.authorizer_signer || null}
          walletChainId={walletChainId}
        />
      )}

      {/* Route 6: Transactions */}
      {currentRoute === "transactions" && (
        <TransactionsView
          requests={displayRequests}
          walletChainId={walletChainId}
          activeSmartAccount={displaySmartAccount}
        />
      )}

      {/* Route 7: Audit Trail */}
      {currentRoute === "audit" && (
        <AuditView auditEvents={displayAuditEvents} onRefresh={loadData} />
      )}

      {/* Route 8: Signers & Security */}
      {currentRoute === "security" && (
        <SecurityView
          health={health}
          activeSmartAccount={displaySmartAccount}
          walletAddress={walletAddress}
          walletChainId={walletChainId}
          smartAccountBalance={displayBalance}
          onRefresh={loadData}
          showToast={showToast}
        />
      )}

      {/* Route 9: Networks & Settings */}
      {currentRoute === "settings" && (
        <SettingsView
          walletAddress={walletAddress}
          walletChainId={walletChainId}
          activeSmartAccount={displaySmartAccount}
          isDemoMode={isDemoMode}
          onToggleDemoMode={handleToggleDemoMode}
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
