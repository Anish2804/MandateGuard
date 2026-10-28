"use client";

import React from "react";
import { CheckCircle2, XCircle, Clock, AlertTriangle, ShieldCheck, ShieldAlert, Sparkles, Check } from "lucide-react";

export type BadgeVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "allow"
  | "deny"
  | "settled"
  | "pending"
  | "revoked"
  | "active"
  | "exhausted";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  showIcon?: boolean;
  className?: string;
  title?: string;
}

export function Badge({
  children,
  variant = "neutral",
  size = "sm",
  showIcon = true,
  className = "",
  title,
}: BadgeProps) {
  const sizeStyles = {
    sm: "text-[11px] h-5 px-1.5 gap-1 font-medium",
    md: "text-xs h-6 px-2 gap-1.5 font-medium",
  }[size];

  const getVariantConfig = (v: BadgeVariant) => {
    switch (v) {
      case "success":
      case "allow":
      case "settled":
      case "active":
        return {
          styles: "bg-[var(--success-subtle)] text-[var(--success-text)] border border-[var(--success-border)]",
          icon: <Check className="w-3 h-3 text-[var(--success-text)] shrink-0" aria-hidden="true" />,
        };
      case "warning":
      case "pending":
      case "exhausted":
        return {
          styles: "bg-[var(--warning-subtle)] text-[var(--warning-text)] border border-[var(--warning-border)]",
          icon: <Clock className="w-3 h-3 text-[var(--warning-text)] shrink-0" aria-hidden="true" />,
        };
      case "danger":
      case "deny":
      case "revoked":
        return {
          styles: "bg-[var(--danger-subtle)] text-[var(--danger-text)] border border-[var(--danger-border)]",
          icon: <XCircle className="w-3 h-3 text-[var(--danger-text)] shrink-0" aria-hidden="true" />,
        };
      case "info":
        return {
          styles: "bg-[var(--info-subtle)] text-[var(--info-text)] border border-[var(--info-border)]",
          icon: <Sparkles className="w-3 h-3 text-[var(--info-text)] shrink-0" aria-hidden="true" />,
        };
      case "neutral":
      default:
        return {
          styles: "bg-[var(--surface-hover)] text-[var(--text-muted)] border border-[var(--border)]",
          icon: null,
        };
    }
  };

  const { styles, icon } = getVariantConfig(variant);

  return (
    <span
      title={title}
      className={`inline-flex items-center rounded select-none tracking-tight ${sizeStyles} ${styles} ${className}`}
    >
      {showIcon && icon}
      <span>{children}</span>
    </span>
  );
}
