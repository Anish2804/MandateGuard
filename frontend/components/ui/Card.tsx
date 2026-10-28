"use client";

import React, { HTMLAttributes, forwardRef } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ children, className = "", hoverEffect = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`bg-slate-900/60 border border-slate-800/80 rounded-xl backdrop-blur-md shadow-lg shadow-black/20 ${
          hoverEffect ? "transition-all duration-200 hover:border-slate-700/80 hover:bg-slate-900/80" : ""
        } ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ children, className = "", ...props }, ref) => {
    return (
      <div ref={ref} className={`px-5 py-4 border-b border-slate-800/60 ${className}`} {...props}>
        {children}
      </div>
    );
  }
);
CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ children, className = "", ...props }, ref) => {
    return (
      <h3 ref={ref} className={`text-base font-semibold text-slate-100 tracking-tight flex items-center gap-2 ${className}`} {...props}>
        {children}
      </h3>
    );
  }
);
CardTitle.displayName = "CardTitle";

export const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ children, className = "", ...props }, ref) => {
    return (
      <p ref={ref} className={`text-xs text-slate-400 mt-1 leading-relaxed ${className}`} {...props}>
        {children}
      </p>
    );
  }
);
CardDescription.displayName = "CardDescription";

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ children, className = "", ...props }, ref) => {
    return (
      <div ref={ref} className={`p-5 ${className}`} {...props}>
        {children}
      </div>
    );
  }
);
CardContent.displayName = "CardContent";

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ children, className = "", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`px-5 py-3 border-t border-slate-800/60 bg-slate-950/30 rounded-b-xl flex items-center justify-between gap-3 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
CardFooter.displayName = "CardFooter";
