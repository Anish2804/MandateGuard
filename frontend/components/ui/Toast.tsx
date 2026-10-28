"use client";

import React, { useEffect } from "react";
import { CheckCircle2, XCircle, AlertCircle, Info, X } from "lucide-react";

export interface ToastProps {
  type: "success" | "error" | "warning" | "info";
  message: string;
  onClose: () => void;
  duration?: number;
}

export function Toast({ type, message, onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const config = {
    success: {
      border: "border-l-[3px] border-l-[var(--success)]",
      icon: <CheckCircle2 className="w-4 h-4 text-[var(--success-text)] shrink-0" aria-hidden="true" />,
      role: "status",
    },
    error: {
      border: "border-l-[3px] border-l-[var(--danger)]",
      icon: <XCircle className="w-4 h-4 text-[var(--danger-text)] shrink-0" aria-hidden="true" />,
      role: "alert",
    },
    warning: {
      border: "border-l-[3px] border-l-[var(--warning)]",
      icon: <AlertCircle className="w-4 h-4 text-[var(--warning-text)] shrink-0" aria-hidden="true" />,
      role: "alert",
    },
    info: {
      border: "border-l-[3px] border-l-[var(--info)]",
      icon: <Info className="w-4 h-4 text-[var(--info-text)] shrink-0" aria-hidden="true" />,
      role: "status",
    },
  }[type];

  return (
    <div
      role={config.role}
      aria-live="polite"
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-2.5 px-3.5 py-2.5 rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-lg max-w-sm animate-in slide-in-from-bottom-2 duration-150 ${config.border}`}
    >
      {config.icon}
      <p className="text-xs font-medium leading-snug flex-1">
        {message}
      </p>
      <button
        type="button"
        onClick={onClose}
        className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text)] rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
        aria-label="Dismiss notification"
      >
        <X className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
