"use client";

import React, { useState } from "react";
import {
  LayoutDashboard,
  Bot,
  FileCheck2,
  ArrowRightLeft,
  ShieldCheck,
  Receipt,
  History,
  Lock,
  Network,
  Wallet,
  RefreshCw,
  Droplets,
  Menu,
  X,
  ChevronDown,
  ExternalLink,
  PlusCircle,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "../ui/Button";
import { StatusBeacon } from "../ui/StatusBeacon";
import { SUPPORTED_CHAINS, FACTORY_ADDRESS } from "../../lib/contracts";

export type NavRoute =
  | "overview"
  | "agents"
  | "mandates"
  | "requests"
  | "verdict"
  | "transactions"
  | "audit"
  | "security"
  | "settings";

export interface AppShellProps {
  currentRoute: NavRoute;
  onRouteChange: (route: NavRoute) => void;
  walletAddress: `0x${string}` | null;
  walletChainId: number | null;
  onConnectWallet: () => void;
  userSmartAccounts: `0x${string}`[];
  activeSmartAccount: string;
  onSelectSmartAccount: (account: string) => void;
  onDeploySmartAccount: () => void;
  isDeployingAccount: boolean;
  onClaimFaucet: () => void;
  isClaimingFaucet: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
  backendHealthy: boolean;
  rpcHealthy: boolean;
  smartAccountBalance: number | null;
  counts?: {
    activeMandates?: number;
    pendingRequests?: number;
    activeAgents?: number;
  };
  children: React.ReactNode;
}

export function AppShell({
  currentRoute,
  onRouteChange,
  walletAddress,
  walletChainId,
  onConnectWallet,
  userSmartAccounts,
  activeSmartAccount,
  onSelectSmartAccount,
  onDeploySmartAccount,
  isDeployingAccount,
  onClaimFaucet,
  isClaimingFaucet,
  onRefresh,
  isRefreshing,
  backendHealthy,
  rpcHealthy,
  smartAccountBalance,
  counts = {},
  children,
}: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);

  const navItems: {
    route: NavRoute;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    {
      route: "overview",
      label: "Overview",
      icon: <LayoutDashboard className="w-4 h-4" aria-hidden="true" />,
    },
    {
      route: "agents",
      label: "Agents",
      icon: <Bot className="w-4 h-4" aria-hidden="true" />,
      badge: counts.activeAgents,
    },
    {
      route: "mandates",
      label: "Mandates & Policies",
      icon: <FileCheck2 className="w-4 h-4" aria-hidden="true" />,
      badge: counts.activeMandates,
    },
    {
      route: "requests",
      label: "Payment Requests",
      icon: <ArrowRightLeft className="w-4 h-4" aria-hidden="true" />,
      badge: counts.pendingRequests,
    },
    {
      route: "verdict",
      label: "Verdict Verification",
      icon: <ShieldCheck className="w-4 h-4" aria-hidden="true" />,
    },
    {
      route: "transactions",
      label: "Transactions",
      icon: <Receipt className="w-4 h-4" aria-hidden="true" />,
    },
    {
      route: "audit",
      label: "Audit Trail",
      icon: <History className="w-4 h-4" aria-hidden="true" />,
    },
    {
      route: "security",
      label: "Signers & Security",
      icon: <Lock className="w-4 h-4" aria-hidden="true" />,
    },
    {
      route: "settings",
      label: "Networks & Settings",
      icon: <Network className="w-4 h-4" aria-hidden="true" />,
    },
  ];

  const pageDescriptions: Record<NavRoute, { title: string; desc: string }> = {
    overview: {
      title: "Security Console Overview",
      desc: "Live cryptographic authorization posture, spending utilization, and system telemetry.",
    },
    agents: {
      title: "Agent Management",
      desc: "Provision isolated API keys, bind agents to smart accounts, and enforce spending rules.",
    },
    mandates: {
      title: "Mandates & Policies",
      desc: "Define, activate, and manage verifiable human spending boundaries and recipient rules.",
    },
    requests: {
      title: "Payment Requests",
      desc: "Audit authorization decisions, policy allowance checks, and lifecycle states.",
    },
    verdict: {
      title: "Verdict Verification",
      desc: "Cryptographic EIP-712 structured data inspector and authorizer signature validation.",
    },
    transactions: {
      title: "Settled Transactions",
      desc: "Mined blockchain transactions, execution receipts, and PaymentExecuted event logs.",
    },
    audit: {
      title: "Immutable Audit Trail",
      desc: "Chronological security event ledger recorded for compliance and forensic analysis.",
    },
    security: {
      title: "Signers & Security Controls",
      desc: "Authorizer signer key validation, owner controls, and emergency withdrawal safeguards.",
    },
    settings: {
      title: "Networks & Connectivity",
      desc: "Supported EVM chains, RPC latency metrics, and deployed contract addresses.",
    },
  };

  const handleCopyAccount = () => {
    if (activeSmartAccount) {
      navigator.clipboard.writeText(activeSmartAccount);
      setCopiedAccount(true);
      setTimeout(() => setCopiedAccount(false), 2000);
    }
  };

  const activeChainConfig =
    SUPPORTED_CHAINS[walletChainId as keyof typeof SUPPORTED_CHAINS] ||
    SUPPORTED_CHAINS[31337];

  return (
    <div className="min-h-screen bg-[#070a12] text-slate-100 flex flex-col antialiased">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-[#0a0f1d]/90 border-b border-slate-800/80 backdrop-blur-md px-4 lg:px-6 py-3 flex items-center justify-between gap-4">
        {/* Left: Mobile Toggle & Brand */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 lg:hidden text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-sm shadow-indigo-950">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-base text-white tracking-tight flex items-center gap-1.5">
                Mandate<span className="text-indigo-400">Guard</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/50">
                  Console
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Center: Smart Account Selector */}
        <div className="hidden md:flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              id="account-selector-btn"
              onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-xs font-mono text-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-haspopup="true"
              aria-expanded={accountDropdownOpen}
            >
              <span className="text-slate-400 font-sans">Account:</span>
              <span className="text-indigo-300 font-semibold">
                {activeSmartAccount
                  ? `${activeSmartAccount.slice(0, 6)}...${activeSmartAccount.slice(-4)}`
                  : "No Account Selected"}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {accountDropdownOpen && (
              <div
                className="absolute left-0 mt-1.5 w-80 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-50 animate-in fade-in duration-100"
                role="menu"
                aria-orientation="vertical"
              >
                <div className="px-3 py-2 border-b border-slate-800/80">
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
                    Active Smart Account
                  </span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs font-mono text-slate-200 truncate">
                      {activeSmartAccount}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyAccount}
                      className="p-1 hover:text-indigo-400 text-slate-400 rounded transition-colors"
                      title="Copy Address"
                    >
                      {copiedAccount ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  {smartAccountBalance !== null ? (
                    <div className="text-xs text-slate-300 mt-1.5 flex items-center justify-between">
                      <span className="text-slate-400">Vault Balance:</span>
                      <span className="font-semibold text-emerald-400 font-mono">
                        ${smartAccountBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-amber-400/90 mt-1 flex items-center justify-between">
                      <span>Vault Balance:</span>
                      <span className="italic font-mono">RPC Offline</span>
                    </div>
                  )}
                </div>

                {userSmartAccounts.length > 0 && (
                  <div className="py-1">
                    <span className="px-3 py-1 text-[10px] uppercase text-slate-400 block font-medium">
                      Your Deployed Accounts ({userSmartAccounts.length})
                    </span>
                    {userSmartAccounts.map((acc) => (
                      <button
                        key={acc}
                        type="button"
                        onClick={() => {
                          onSelectSmartAccount(acc);
                          setAccountDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs font-mono rounded-lg transition-colors flex items-center justify-between ${
                          acc.toLowerCase() === activeSmartAccount.toLowerCase()
                            ? "bg-indigo-950/60 text-indigo-300 border border-indigo-800/40"
                            : "text-slate-300 hover:bg-slate-800/60"
                        }`}
                      >
                        <span>{`${acc.slice(0, 10)}...${acc.slice(-6)}`}</span>
                        {acc.toLowerCase() === activeSmartAccount.toLowerCase() && (
                          <span className="text-[10px] text-indigo-400 font-sans">Active</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800/80">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs justify-center"
                    loading={isDeployingAccount}
                    onClick={() => {
                      setAccountDropdownOpen(false);
                      onDeploySmartAccount();
                    }}
                    leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
                  >
                    Deploy New Account via Factory
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions & Wallet */}
        <div className="flex items-center gap-2.5">
          {/* Faucet Claim */}
          <Button
            variant="outline"
            size="sm"
            onClick={onClaimFaucet}
            loading={isClaimingFaucet}
            leftIcon={<Droplets className="w-3.5 h-3.5 text-blue-400" />}
            title="Claim 1,000 testnet USDC from MockUSDC"
            className="hidden sm:inline-flex"
          >
            Claim Faucet
          </Button>

          {/* Refresh State */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Refresh data"
            title="Refresh application state"
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefreshing ? "animate-spin text-indigo-400" : ""}`}
            />
          </button>

          {/* Network Pill */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                rpcHealthy ? "bg-emerald-400" : "bg-rose-400"
              }`}
            />
            <span className="text-slate-300 font-medium">{activeChainConfig.name}</span>
          </div>

          {/* Web3 Wallet Connect */}
          {walletAddress ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-950/40 border border-indigo-800/60 text-xs font-mono text-indigo-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>{`${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`}</span>
            </div>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={onConnectWallet}
              leftIcon={<Wallet className="w-3.5 h-3.5" />}
            >
              Connect Wallet
            </Button>
          )}
        </div>
      </header>

      {/* Main Body with Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar Navigation */}
        <aside
          className="hidden lg:flex w-64 flex-col justify-between border-r border-slate-800/80 bg-[#090d18] shrink-0 p-4"
          aria-label="Sidebar navigation"
        >
          <nav className="space-y-1" aria-label="Console views">
            {navItems.map((item) => {
              const isActive = currentRoute === item.route;
              return (
                <button
                  key={item.route}
                  type="button"
                  id={`nav-${item.route}`}
                  onClick={() => onRouteChange(item.route)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 select-none ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-950/50"
                      : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <div className="flex items-center gap-3">
                    <span className={isActive ? "text-white" : "text-slate-400"}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                        isActive
                          ? "bg-indigo-700/80 text-white"
                          : "bg-slate-800 text-slate-300 border border-slate-700"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Connectivity Status in Sidebar Footer */}
          <div className="pt-4 border-t border-slate-800/80 space-y-2 text-xs">
            <div className="flex items-center justify-between px-2">
              <span className="text-slate-400">Backend API</span>
              <StatusBeacon
                status={backendHealthy ? "online" : "offline"}
                label={backendHealthy ? "Operational" : "Offline"}
                size="sm"
              />
            </div>
            <div className="flex items-center justify-between px-2">
              <span className="text-slate-400">EVM RPC ({activeChainConfig.id})</span>
              <StatusBeacon
                status={rpcHealthy ? "online" : "offline"}
                label={rpcHealthy ? "Connected" : "Disconnected"}
                size="sm"
              />
            </div>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/80 lg:hidden backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              className="w-72 bg-[#090d18] h-full p-4 border-r border-slate-800 flex flex-col justify-between"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <span className="font-bold text-white">Menu</span>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <nav className="mt-4 space-y-1">
                  {navItems.map((item) => (
                    <button
                      key={item.route}
                      type="button"
                      onClick={() => {
                        onRouteChange(item.route);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium ${
                        currentRoute === item.route
                          ? "bg-indigo-600 text-white"
                          : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {item.icon}
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </nav>
              </div>

              <div className="pt-4 border-t border-slate-800 text-xs space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-center"
                  onClick={onClaimFaucet}
                  loading={isClaimingFaucet}
                  leftIcon={<Droplets className="w-3.5 h-3.5 text-blue-400" />}
                >
                  Claim 1,000 USDC Faucet
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8" id="main-content">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Contextual Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800/60">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                  {pageDescriptions[currentRoute].title}
                </h1>
                <p className="text-xs md:text-sm text-slate-400 mt-1">
                  {pageDescriptions[currentRoute].desc}
                </p>
              </div>
            </div>

            {/* Child View */}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
