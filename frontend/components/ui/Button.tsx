"use client";

import React, { ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "destructive" | "outline-destructive";
  size?: "sm" | "md";
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = "",
      variant = "primary",
      size = "md",
      loading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      type = "button",
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--canvas)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-[0.99]";

    const sizeStyles = {
      sm: "text-xs h-8 px-2.5 rounded gap-1.5",
      md: "text-xs h-9 px-3.5 rounded-md gap-2",
    }[size];

    const variantStyles = {
      primary:
        "bg-[var(--accent)] hover:opacity-90 text-white shadow-xs",
      secondary:
        "bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text)] border border-[var(--border)] shadow-xs",
      ghost:
        "bg-transparent hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text)]",
      destructive:
        "bg-[var(--danger)] hover:opacity-90 text-white shadow-xs",
      "outline-destructive":
        "bg-transparent hover:bg-[var(--danger-subtle)] text-[var(--danger-text)] border border-[var(--danger-border)] shadow-xs",
    }[variant];

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
        aria-busy={loading ? "true" : undefined}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-current shrink-0" aria-hidden="true" />
        ) : (
          leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!loading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";
