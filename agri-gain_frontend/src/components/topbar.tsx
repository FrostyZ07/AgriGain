"use client";

import type { Phase } from "@/types";
import { cn } from "@/lib/utils";

interface TopBarProps {
  phase: Phase;
}

export function TopBar({ phase }: TopBarProps) {
  const status =
    phase === "recommendation"
      ? { text: "Recommendation Ready", dot: "bg-ag-green", pulse: false }
      : phase === "investigating"
        ? { text: "Investigation Running", dot: "bg-ag-ochre", pulse: true }
        : { text: "Investigation Idle", dot: "bg-ag-wait", pulse: false };

  return (
    <header
      data-testid="top-bar"
      className="sticky top-0 z-20 flex items-center justify-between border-b border-ag-border bg-ag-bg/95 px-5 py-3 backdrop-blur-sm sm:px-8"
    >
      <div className="flex items-baseline gap-3">
        <span className="font-display text-lg font-extrabold tracking-tight text-ag-ink">
          AGRI—GAIN
        </span>
        <span className="hidden font-mono-ag text-[10px] uppercase tracking-[0.2em] text-ag-muted sm:inline">
          Decision Workspace
        </span>
      </div>
      <div
        data-testid="status-badge"
        className="flex items-center gap-2 rounded-full border border-ag-border bg-ag-surface px-3 py-1"
      >
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            status.dot,
            status.pulse && "ag-pulse"
          )}
        />
        <span className="font-mono-ag text-[10px] uppercase tracking-[0.15em] text-ag-muted">
          {status.text}
        </span>
      </div>
    </header>
  );
}
