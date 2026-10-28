"use client";

import React from "react";

export interface EmptyStateProps {
  icon: React.ReactNode | React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`py-8 px-4 flex flex-col items-center justify-center text-center space-y-2.5 max-w-sm mx-auto ${className}`}
    >
      <div className="w-8 h-8 rounded-md bg-[var(--surface-hover)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] shrink-0">
        {React.isValidElement(icon)
          ? icon
          : typeof icon === "function"
          ? React.createElement(icon as React.ComponentType<{ className?: string }>, { className: "w-4 h-4" })
          : icon}
      </div>
      <div>
        <h4 className="text-xs font-semibold text-[var(--text)] tracking-tight">
          {title}
        </h4>
        <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-normal">
          {description}
        </p>
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
