"use client";

import React, { useEffect } from "react";
import { CheckCircle2, XCircle, AlertCircle, Info, X } from "lucide-react";

export interface ToastProps {
  type: "success" | "error" | "warning" | "info";
  message: string;
  onClose: () => void;
  duration?: number;
}

export function Toast({ type, message, onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const config = {
    success: {
      bg: "bg-slate-900 border-emerald-500/40 text-emerald-300",
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />,
      role: "status",
    },
    error: {
      bg: "bg-slate-900 border-rose-500/40 text-rose-300",
      icon: <XCircle className="w-5 h-5 text-rose-400 shrink-0" aria-hidden="true" />,
      role: "alert",
    },
    warning: {
      bg: "bg-slate-900 border-amber-500/40 text-amber-300",
      icon: <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" aria-hidden="true" />,
      role: "alert",
    },
    info: {
      bg: "bg-slate-900 border-indigo-500/40 text-indigo-300",
      icon: <Info className="w-5 h-5 text-indigo-400 shrink-0" aria-hidden="true" />,
      role: "status",
    },
  }[type];

  return (
    <div
      role={config.role}
      aria-live="polite"
      className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl shadow-black/60 max-w-md backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200 ${config.bg}`}
    >
      {config.icon}
      <p className="text-xs md:text-sm font-medium text-slate-200 leading-snug flex-1">
        {message}
      </p>
      <button
        type="button"
        onClick={onClose}
        className="p-1 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}
