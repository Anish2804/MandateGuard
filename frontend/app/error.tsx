"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "../components/ui/Button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Console view runtime error caught:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--canvas)] p-4">
      <div className="w-full max-w-md p-6 rounded-lg bg-[var(--surface)] border border-[var(--border)] shadow-sm text-center space-y-4">
        <div className="w-10 h-10 rounded-full bg-[var(--danger-bg)] border border-[var(--danger-border)] flex items-center justify-center text-[var(--danger-text)] mx-auto">
          <AlertTriangle className="w-5 h-5" />
        </div>

        <div>
          <h2 className="text-base font-semibold text-[var(--text)] tracking-tight">
            Unable to load view
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">
            {error?.message || "An unexpected error occurred while rendering this security console view."}
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.location.href = "/"}
            leftIcon={<Home className="w-3.5 h-3.5" />}
          >
            Return to Overview
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => reset()}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Reload View
          </Button>
        </div>
      </div>
    </div>
  );
}
