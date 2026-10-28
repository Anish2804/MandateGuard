"use client";

import React from "react";
import { CheckCircle2, XCircle, Clock, AlertTriangle, ShieldCheck, ShieldAlert, Sparkles } from "lucide-react";

export type BadgeVariant =
  | "allow"
  | "deny"
  | "settled"
  | "pending"
  | "revoked"
  | "active"
  | "exhausted"
  | "info"
  | "neutral";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  showIcon?: boolean;
  className?: string;
}

export function Badge({
  children,
  variant = "neutral",
  size = "md",
  showIcon = true,
  className = "",
}: BadgeProps) {
  const sizeStyles = {
    sm: "text-[11px] px-2 py-0.5 gap-1 font-medium",
    md: "text-xs px-2.5 py-1 gap-1.5 font-semibold",
  }[size];

  const variantConfig: Record<
    BadgeVariant,
    { styles: string; icon: React.ReactNode }
  > = {
    allow: {
      styles: "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30",
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />,
    },
    active: {
      styles: "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30",
      icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />,
    },
    settled: {
      styles: "bg-blue-950/60 text-blue-400 border border-blue-500/30",
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" aria-hidden="true" />,
    },
    deny: {
      styles: "bg-rose-950/60 text-rose-400 border border-rose-500/30",
      icon: <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" aria-hidden="true" />,
    },
    revoked: {
      styles: "bg-rose-950/60 text-rose-400 border border-rose-500/30",
      icon: <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" aria-hidden="true" />,
    },
    pending: {
      styles: "bg-amber-950/60 text-amber-400 border border-amber-500/30",
      icon: <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />,
    },
    exhausted: {
      styles: "bg-amber-950/60 text-amber-400 border border-amber-500/30",
      icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />,
    },
    info: {
      styles: "bg-indigo-950/60 text-indigo-400 border border-indigo-500/30",
      icon: <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" aria-hidden="true" />,
    },
    neutral: {
      styles: "bg-slate-800 text-slate-300 border border-slate-700/80",
      icon: null,
    },
  };

  const { styles, icon } = variantConfig[variant];

  return (
    <span
      className={`inline-flex items-center rounded-full tracking-wide select-none ${sizeStyles} ${styles} ${className}`}
    >
      {showIcon && icon}
      <span>{children}</span>
    </span>
  );
}
