"use client";

import type { Agent } from "@/types";
import { cn } from "@/lib/utils";

interface AgentBoardProps {
  agents: Agent[];
}

const STATUS_META = {
  waiting: {
    text: "Waiting",
    cls: "text-ag-wait",
    bar: "bg-ag-border",
  },
  running: {
    text: "Running…",
    cls: "text-ag-terracotta",
    bar: "bg-ag-ochre",
  },
  done: {
    text: "Complete",
    cls: "text-ag-green",
    bar: "bg-ag-green",
  },
} as const;

export function AgentBoard({ agents }: AgentBoardProps) {
  return (
    <section
      data-testid="agent-board"
      className="border border-ag-border bg-ag-surface"
    >
      <div className="border-b border-ag-border px-4 py-2.5">
        <p className="font-mono-ag text-[10px] uppercase tracking-[0.2em] text-ag-muted">
          Live Agent Board
        </p>
      </div>
      <ul className="divide-y divide-ag-border">
        {agents.map((a) => {
          const meta = STATUS_META[a.status];
          return (
            <li
              key={a.id}
              data-testid={`agent-${a.id}`}
              className="relative flex items-center justify-between gap-3 px-4 py-3"
            >
              <span
                className={cn(
                  "absolute left-0 top-0 h-full w-[3px]",
                  meta.bar,
                  a.status === "running" && "ag-pulse"
                )}
              />
              <div>
                <p className="text-sm font-medium text-ag-ink">{a.name}</p>
                {a.result && (
                  <p className="ag-fade-up mt-0.5 font-mono-ag text-[11px] text-ag-muted">
                    {a.result}
                  </p>
                )}
              </div>
              <span
                className={cn(
                  "font-mono-ag text-[10px] uppercase tracking-[0.15em]",
                  meta.cls
                )}
              >
                {meta.text}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
