"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  LayoutDashboard,
  Bot,
  FileCheck2,
  ArrowRightLeft,
  ShieldCheck,
  Receipt,
  History,
  Lock,
  Network,
  PlusCircle,
  Sun,
  Moon,
  Laptop,
} from "lucide-react";
import { useTheme } from "../theme/ThemeProvider";

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (route: any) => void;
  onOpenCreateMandate?: () => void;
  onOpenProvisionAgent?: () => void;
  onOpenSimulator?: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  onNavigate,
  onOpenCreateMandate,
  onOpenProvisionAgent,
  onOpenSimulator,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { setTheme } = useTheme();

  const items = [
    {
      id: "nav-overview",
      title: "Overview",
      category: "Navigation",
      icon: <LayoutDashboard className="w-3.5 h-3.5 text-[var(--text-muted)]" />,
      action: () => onNavigate("overview"),
    },
    {
      id: "nav-agents",
      title: "Agents",
      category: "Navigation",
      icon: <Bot className="w-3.5 h-3.5 text-[var(--text-muted)]" />,
      action: () => onNavigate("agents"),
    },
    {
      id: "nav-mandates",
      title: "Mandates & Policies",
      category: "Navigation",
      icon: <FileCheck2 className="w-3.5 h-3.5 text-[var(--text-muted)]" />,
      action: () => onNavigate("mandates"),
    },
    {
      id: "nav-requests",
      title: "Payment Requests",
      category: "Navigation",
      icon: <ArrowRightLeft className="w-3.5 h-3.5 text-[var(--text-muted)]" />,
      action: () => onNavigate("requests"),
    },
    {
      id: "nav-verdict",
      title: "Verdict Verification",
      category: "Navigation",
      icon: <ShieldCheck className="w-3.5 h-3.5 text-[var(--text-muted)]" />,
      action: () => onNavigate("verdict"),
    },
    {
      id: "nav-transactions",
      title: "Transactions",
      category: "Navigation",
      icon: <Receipt className="w-3.5 h-3.5 text-[var(--text-muted)]" />,
      action: () => onNavigate("transactions"),
    },
    {
      id: "nav-audit",
      title: "Audit Trail",
      category: "Navigation",
      icon: <History className="w-3.5 h-3.5 text-[var(--text-muted)]" />,
      action: () => onNavigate("audit"),
    },
    {
      id: "nav-security",
      title: "Signers & Security",
      category: "Navigation",
      icon: <Lock className="w-3.5 h-3.5 text-[var(--text-muted)]" />,
      action: () => onNavigate("security"),
    },
    {
      id: "nav-settings",
      title: "Networks & Settings",
      category: "Navigation",
      icon: <Network className="w-3.5 h-3.5 text-[var(--text-muted)]" />,
      action: () => onNavigate("settings"),
    },
    {
      id: "act-create-mandate",
      title: "Create Mandate Policy",
      category: "Actions",
      icon: <PlusCircle className="w-3.5 h-3.5 text-[var(--accent)]" />,
      action: () => {
        onNavigate("mandates");
        if (onOpenCreateMandate) onOpenCreateMandate();
      },
    },
    {
      id: "act-provision-agent",
      title: "Provision AI Agent Key",
      category: "Actions",
      icon: <Bot className="w-3.5 h-3.5 text-[var(--accent)]" />,
      action: () => {
        onNavigate("agents");
        if (onOpenProvisionAgent) onOpenProvisionAgent();
      },
    },
    {
      id: "act-simulate",
      title: "Simulate Payment Request",
      category: "Actions",
      icon: <ArrowRightLeft className="w-3.5 h-3.5 text-[var(--accent)]" />,
      action: () => {
        onNavigate("requests");
        if (onOpenSimulator) onOpenSimulator();
      },
    },
    {
      id: "theme-light",
      title: "Switch to Light Theme",
      category: "Preferences",
      icon: <Sun className="w-3.5 h-3.5 text-[var(--text-muted)]" />,
      action: () => setTheme("light"),
    },
    {
      id: "theme-dark",
      title: "Switch to Dark Theme",
      category: "Preferences",
      icon: <Moon className="w-3.5 h-3.5 text-[var(--text-muted)]" />,
      action: () => setTheme("dark"),
    },
    {
      id: "theme-system",
      title: "Use System Theme",
      category: "Preferences",
      icon: <Laptop className="w-3.5 h-3.5 text-[var(--text-muted)]" />,
      action: () => setTheme("system"),
    },
  ];

  const filtered = items.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
      } else if (e.key === "Enter" && filtered.length > 0) {
        e.preventDefault();
        filtered[selectedIndex]?.action();
        onClose();
      }
    },
    [filtered, selectedIndex, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      setSelectedIndex(0);
    } else {
      window.removeEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-100"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-lg bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-center px-3.5 border-b border-[var(--border)]">
          <Search className="w-4 h-4 text-[var(--text-muted)] shrink-0 mr-2.5" />
          <input
            type="text"
            autoFocus
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="w-full h-11 bg-transparent text-xs text-[var(--text)] placeholder-[var(--text-subtle)] focus:outline-none"
          />
          <kbd className="text-[10px] text-[var(--text-subtle)] font-mono bg-[var(--surface-hover)] border border-[var(--border)] px-1.5 py-0.5 rounded">
            ESC
          </kbd>
        </div>

        <div className="max-h-72 overflow-y-auto p-1.5 divide-y divide-[var(--border)]">
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-xs text-[var(--text-muted)]">
              No matching commands
            </div>
          ) : (
            <div className="space-y-0.5">
              {filtered.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      item.action();
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded text-xs transition-colors select-none text-left ${
                      isSelected
                        ? "bg-[var(--accent-subtle)] text-[var(--accent-text)] font-medium"
                        : "text-[var(--text)] hover:bg-[var(--surface-hover)]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {item.icon}
                      <span>{item.title}</span>
                    </div>
                    <span className="text-[10px] text-[var(--text-subtle)] font-mono">
                      {item.category}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
