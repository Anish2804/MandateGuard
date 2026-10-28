"use client";

import React from "react";

export interface StatusBeaconProps {
  status: "online" | "offline" | "degraded" | "pending";
  label?: string;
  size?: "sm" | "md";
}

export function StatusBeacon({ status, label, size = "md" }: StatusBeaconProps) {
  const config = {
    online: {
      color: "bg-emerald-500",
      ping: "bg-emerald-400",
      defaultLabel: "Online",
      textColor: "text-emerald-400",
    },
    offline: {
      color: "bg-rose-500",
      ping: "",
      defaultLabel: "Offline",
      textColor: "text-rose-400",
    },
    degraded: {
      color: "bg-amber-500",
      ping: "bg-amber-400",
      defaultLabel: "Degraded",
      textColor: "text-amber-400",
    },
    pending: {
      color: "bg-sky-500",
      ping: "bg-sky-400",
      defaultLabel: "Connecting...",
      textColor: "text-sky-400",
    },
  }[status];

  const dotSize = size === "sm" ? "w-2 h-2" : "w-2.5 h-2.5";
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <span className="inline-flex items-center gap-2 select-none">
      <span className="relative flex shrink-0">
        {config.ping && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.ping}`}
          />
        )}
        <span className={`relative inline-flex rounded-full ${dotSize} ${config.color}`} />
      </span>
      <span className={`font-medium ${textSize} ${config.textColor}`}>
        {label || config.defaultLabel}
      </span>
    </span>
  );
}
