"use client";

import React, { useState, useEffect } from "react";
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
  Search,
  Sun,
  Moon,
  Laptop,
  Copy,
  Check,
  LogOut,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { CommandPalette } from "../ui/CommandPalette";
import { useTheme, Theme } from "../theme/ThemeProvider";
import { SUPPORTED_CHAINS } from "../../lib/contracts";
import { switchWalletNetwork } from "../../lib/web3";

export type NavRoute =
  | "overview"
  | "requests"
  | "transactions"
  | "audit"
  | "agents"
  | "mandates"
  | "verdict"
  | "security"
  | "settings";

export interface AppShellProps {
  currentRoute: NavRoute;
  onRouteChange: (route: NavRoute) => void;
  walletAddress: `0x${string}` | null;
  walletChainId: number | null;
  onConnectWallet: () => void;
  onDisconnectWallet?: () => void;
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
  onOpenCreateMandate?: () => void;
  onOpenProvisionAgent?: () => void;
  onOpenSimulator?: () => void;
  children: React.ReactNode;
}

export function AppShell({
  currentRoute,
  onRouteChange,
  walletAddress,
  walletChainId,
  onConnectWallet,
  onDisconnectWallet,
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
  onOpenCreateMandate,
  onOpenProvisionAgent,
  onOpenSimulator,
  children,
}: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);
  const [networkDropdownOpen, setNetworkDropdownOpen] = useState(false);
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);

  const { theme, resolvedTheme, setTheme } = useTheme();

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const navSections: {
    title: string;
    items: {
      route: NavRoute;
      label: string;
      icon: React.ReactNode;
      badge?: number;
    }[];
  }[] = [
    {
      title: "Monitor",
      items: [
        {
          route: "overview",
          label: "Overview",
          icon: <LayoutDashboard className="w-4 h-4 shrink-0" aria-hidden="true" />,
        },
        {
          route: "requests",
          label: "Payment Requests",
          icon: <ArrowRightLeft className="w-4 h-4 shrink-0" aria-hidden="true" />,
          badge: counts.pendingRequests,
        },
        {
          route: "transactions",
          label: "Transactions",
          icon: <Receipt className="w-4 h-4 shrink-0" aria-hidden="true" />,
        },
        {
          route: "audit",
          label: "Audit Trail",
          icon: <History className="w-4 h-4 shrink-0" aria-hidden="true" />,
        },
      ],
    },
    {
      title: "Configure",
      items: [
        {
          route: "agents",
          label: "Agents",
          icon: <Bot className="w-4 h-4 shrink-0" aria-hidden="true" />,
          badge: counts.activeAgents,
        },
        {
          route: "mandates",
          label: "Mandates & Policies",
          icon: <FileCheck2 className="w-4 h-4 shrink-0" aria-hidden="true" />,
          badge: counts.activeMandates,
        },
      ],
    },
    {
      title: "Security",
      items: [
        {
          route: "verdict",
          label: "Verdict Verification",
          icon: <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />,
        },
        {
          route: "security",
          label: "Signers & Security",
          icon: <Lock className="w-4 h-4 shrink-0" aria-hidden="true" />,
        },
      ],
    },
    {
      title: "System",
      items: [
        {
          route: "settings",
          label: "Networks & Settings",
          icon: <Network className="w-4 h-4 shrink-0" aria-hidden="true" />,
        },
      ],
    },
  ];

  const pageMeta: Record<NavRoute, { title: string; desc: string }> = {
    overview: {
      title: "Overview",
      desc: "Spending utilization, active policies, and agent payment activity.",
    },
    requests: {
      title: "Payment Requests",
      desc: "Authorization decisions evaluated against active spending mandates.",
    },
    transactions: {
      title: "Transactions",
      desc: "Reconciled on-chain token transfers settled via guarded smart accounts.",
    },
    audit: {
      title: "Audit Trail",
      desc: "Immutable chronological log of mandate and authorization security events.",
    },
    agents: {
      title: "Agents",
      desc: "Provisioned agent API keys locked to isolated smart accounts.",
    },
    mandates: {
      title: "Mandates & Policies",
      desc: "Spending boundaries, transaction ceilings, and recipient whitelists.",
    },
    verdict: {
      title: "Verdict Verification",
      desc: "Cryptographic EIP-712 structured data recovery and signer validation.",
    },
    security: {
      title: "Signers & Security",
      desc: "Authorizer key configuration, governance parameters, and emergency controls.",
    },
    settings: {
      title: "Networks & Settings",
      desc: "EVM network endpoints, RPC latency, and verified contract addresses.",
    },
  };

  const activeChain =
    SUPPORTED_CHAINS[walletChainId as keyof typeof SUPPORTED_CHAINS] ||
    SUPPORTED_CHAINS[84532];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 1500);
  };

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--text)] flex flex-col font-sans antialiased">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-[var(--surface)] border-b border-[var(--border)] h-12 px-4 lg:px-6 flex items-center justify-between gap-3">
        {/* Left: Mobile Toggle + Breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1 lg:hidden text-[var(--text-muted)] hover:text-[var(--text)] rounded hover:bg-[var(--surface-hover)]"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--text)] tracking-tight">
              MandateGuard
            </span>
            <span className="text-[var(--text-subtle)] text-xs">/</span>
            <span className="text-xs text-[var(--text-muted)] font-medium">
              {pageMeta[currentRoute].title}
            </span>
          </div>
        </div>

        {/* Right: Actions, Search, Network, Account, Theme */}
        <div className="flex items-center gap-2">
          {/* Quick Search (Cmd+K) */}
          <button
            type="button"
            onClick={() => setCmdPaletteOpen(true)}
            className="hidden sm:flex items-center gap-2 px-2.5 py-1 text-xs text-[var(--text-muted)] bg-[var(--surface-hover)] border border-[var(--border)] rounded hover:border-[var(--border-strong)] transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search...</span>
            <kbd className="text-[10px] text-[var(--text-subtle)] font-mono bg-[var(--surface)] border border-[var(--border)] px-1 py-0.2 rounded">
              ⌘K
            </kbd>
          </button>

          {/* Network Switcher & Testnet Badge */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setNetworkDropdownOpen(!networkDropdownOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-[var(--text)] bg-[var(--surface)] border border-[var(--border)] rounded hover:bg-[var(--surface-hover)] transition-colors"
              aria-haspopup="true"
              aria-expanded={networkDropdownOpen}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  rpcHealthy ? "bg-[var(--success)]" : "bg-[var(--danger)]"
                }`}
              />
              <span className="font-medium text-xs">{activeChain.name}</span>
              <Badge variant="neutral" size="sm" showIcon={false} className="hidden md:inline-flex text-[10px] py-0 px-1">
                Testnet
              </Badge>
              <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
            </button>

            {networkDropdownOpen && (
              <div
                className="absolute right-0 mt-1 w-52 bg-[var(--surface)] border border-[var(--border)] rounded-md shadow-lg p-1 z-50 animate-in fade-in duration-100"
                role="menu"
              >
                <div className="px-2.5 py-1.5 text-[10px] uppercase font-semibold text-[var(--text-subtle)] tracking-wider">
                  Supported Networks
                </div>
                {Object.values(SUPPORTED_CHAINS).map((chain) => (
                  <button
                    key={chain.id}
                    type="button"
                    onClick={async () => {
                      setNetworkDropdownOpen(false);
                      try {
                        await switchWalletNetwork(chain.id);
                      } catch {
                        onRouteChange("settings");
                      }
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded text-left transition-colors ${
                      chain.id === activeChain.id
                        ? "bg-[var(--accent-subtle)] text-[var(--accent-text)] font-medium"
                        : "text-[var(--text)] hover:bg-[var(--surface-hover)]"
                    }`}
                  >
                    <span>{chain.name}</span>
                    <span className="font-mono text-[10px] text-[var(--text-subtle)]">
                      {chain.id}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Wallet & Account Menu */}
          <div className="relative">
            {walletAddress ? (
              <button
                type="button"
                onClick={() => setWalletDropdownOpen(!walletDropdownOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono text-[var(--text)] bg-[var(--surface)] border border-[var(--border)] rounded hover:bg-[var(--surface-hover)] transition-colors"
                aria-haspopup="true"
                aria-expanded={walletDropdownOpen}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
                <span>{`${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`}</span>
                <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
              </button>
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

            {walletDropdownOpen && walletAddress && (
              <div
                className="absolute right-0 mt-1 w-72 bg-[var(--surface)] border border-[var(--border)] rounded-md shadow-lg p-2 z-50 animate-in fade-in duration-100 text-xs"
                role="menu"
              >
                <div className="px-2 py-1.5 border-b border-[var(--border)]">
                  <span className="text-[10px] uppercase font-semibold text-[var(--text-subtle)] block">
                    Connected Wallet
                  </span>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="font-mono text-[11px] text-[var(--text)] truncate">
                      {walletAddress}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(walletAddress)}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--text)] rounded"
                      title="Copy Address"
                    >
                      {copiedAccount ? (
                        <Check className="w-3 h-3 text-[var(--success-text)]" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="px-2 py-2 border-b border-[var(--border)] space-y-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-[var(--text-muted)]">Active Smart Account:</span>
                    <span className="font-mono text-[var(--text)]">
                      {`${activeSmartAccount.slice(0, 6)}...${activeSmartAccount.slice(-4)}`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-[var(--text-muted)]">Vault Balance:</span>
                    <span className="font-mono font-medium text-[var(--success-text)] tabular-nums">
                      {smartAccountBalance !== null
                        ? `$${smartAccountBalance.toFixed(2)} USDC`
                        : "RPC Offline"}
                    </span>
                  </div>
                </div>

                <div className="pt-1.5 space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setWalletDropdownOpen(false);
                      onClaimFaucet();
                    }}
                    disabled={isClaimingFaucet}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--surface-hover)] rounded transition-colors text-left"
                  >
                    <Droplets className="w-3.5 h-3.5 text-[var(--info-text)]" />
                    <span>Claim 1,000 Testnet USDC</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setWalletDropdownOpen(false);
                      onRefresh();
                    }}
                    disabled={isRefreshing}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--surface-hover)] rounded transition-colors text-left"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-[var(--text-muted)] ${isRefreshing ? "animate-spin" : ""}`} />
                    <span>Refresh Telemetry</span>
                  </button>

                  {onDisconnectWallet && (
                    <button
                      type="button"
                      onClick={() => {
                        setWalletDropdownOpen(false);
                        onDisconnectWallet();
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-[var(--danger-text)] hover:bg-[var(--surface-hover)] rounded transition-colors text-left border-t border-[var(--border)] mt-1 pt-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Disconnect Wallet</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Theme Toggle (Light / Dark / System) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text)] bg-[var(--surface)] border border-[var(--border)] rounded hover:bg-[var(--surface-hover)] transition-colors"
              aria-label="Toggle color theme"
              title={`Current theme: ${theme}`}
            >
              {resolvedTheme === "dark" ? (
                <Moon className="w-3.5 h-3.5" />
              ) : (
                <Sun className="w-3.5 h-3.5" />
              )}
            </button>

            {themeDropdownOpen && (
              <div
                className="absolute right-0 mt-1 w-32 bg-[var(--surface)] border border-[var(--border)] rounded-md shadow-lg p-1 z-50 animate-in fade-in duration-100 text-xs"
                role="menu"
              >
                {(
                  [
                    { id: "light", label: "Light", icon: <Sun className="w-3 h-3" /> },
                    { id: "dark", label: "Dark", icon: <Moon className="w-3 h-3" /> },
                    { id: "system", label: "System", icon: <Laptop className="w-3 h-3" /> },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTheme(t.id);
                      setThemeDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                      theme === t.id
                        ? "bg-[var(--accent-subtle)] text-[var(--accent-text)] font-medium"
                        : "text-[var(--text)] hover:bg-[var(--surface-hover)]"
                    }`}
                  >
                    {t.icon}
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar (240px) */}
        <aside
          className="hidden lg:flex w-60 flex-col justify-between border-r border-[var(--border)] bg-[var(--surface)] shrink-0 p-3"
          aria-label="Sidebar navigation"
        >
          <div className="space-y-4">
            {navSections.map((sec) => (
              <div key={sec.title} className="space-y-1">
                <span className="px-2.5 text-[10px] uppercase font-semibold text-[var(--text-subtle)] tracking-wider">
                  {sec.title}
                </span>
                <nav className="space-y-0.5">
                  {sec.items.map((item) => {
                    const isActive = currentRoute === item.route;
                    return (
                      <button
                        key={item.route}
                        type="button"
                        id={`nav-${item.route}`}
                        onClick={() => onRouteChange(item.route)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors select-none ${
                          isActive
                            ? "bg-[var(--accent-subtle)] text-[var(--accent-text)] font-semibold"
                            : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]"
                        }`}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <div className="flex items-center gap-2.5">
                          {item.icon}
                          <span>{item.label}</span>
                        </div>
                        {item.badge !== undefined && item.badge > 0 && (
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                              isActive
                                ? "bg-[var(--accent)] text-white"
                                : "bg-[var(--surface-hover)] text-[var(--text-muted)]"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>

          {/* Compact Sidebar Footer: System Status Dots with Tooltips */}
          <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between px-2 text-[11px] text-[var(--text-muted)]">
            <div className="flex items-center gap-1.5" title={backendHealthy ? "Backend API Operational" : "Backend API Offline"}>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  backendHealthy ? "bg-[var(--success)]" : "bg-[var(--danger)]"
                }`}
              />
              <span className="text-[10px] font-mono">API</span>
            </div>

            <div className="flex items-center gap-1.5" title={rpcHealthy ? "EVM RPC Connected" : "EVM RPC Offline"}>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  rpcHealthy ? "bg-[var(--success)]" : "bg-[var(--danger)]"
                }`}
              />
              <span className="text-[10px] font-mono">RPC ({activeChain.id})</span>
            </div>
          </div>
        </aside>

        {/* Mobile Drawer Navigation */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/50 lg:hidden backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              className="w-64 bg-[var(--surface)] h-full p-4 border-r border-[var(--border)] flex flex-col justify-between animate-in slide-in-from-left duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                  <span className="font-semibold text-xs text-[var(--text)]">Navigation</span>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1 text-[var(--text-muted)] hover:text-[var(--text)]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {navSections.map((sec) => (
                  <div key={sec.title} className="space-y-1">
                    <span className="px-2 text-[10px] uppercase font-semibold text-[var(--text-subtle)] tracking-wider">
                      {sec.title}
                    </span>
                    <nav className="space-y-0.5">
                      {sec.items.map((item) => (
                        <button
                          key={item.route}
                          type="button"
                          onClick={() => {
                            onRouteChange(item.route);
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs ${
                            currentRoute === item.route
                              ? "bg-[var(--accent-subtle)] text-[var(--accent-text)] font-semibold"
                              : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {item.icon}
                            <span>{item.label}</span>
                          </div>
                          {item.badge !== undefined && item.badge > 0 && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--surface-hover)] text-[var(--text-muted)]">
                              {item.badge}
                            </span>
                          )}
                        </button>
                      ))}
                    </nav>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-6" id="main-content">
          <div className="max-w-6xl mx-auto space-y-5">
            {/* Standard Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[var(--border)]">
              <div>
                <h1 className="text-lg md:text-xl font-semibold text-[var(--text)] tracking-tight">
                  {pageMeta[currentRoute].title}
                </h1>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {pageMeta[currentRoute].desc}
                </p>
              </div>
            </div>

            {/* View Content */}
            {children}
          </div>
        </main>
      </div>

      {/* Global Command Palette Dialog */}
      <CommandPalette
        isOpen={cmdPaletteOpen}
        onClose={() => setCmdPaletteOpen(false)}
        onNavigate={onRouteChange}
        onOpenCreateMandate={onOpenCreateMandate}
        onOpenProvisionAgent={onOpenProvisionAgent}
        onOpenSimulator={onOpenSimulator}
      />
    </div>
  );
}
