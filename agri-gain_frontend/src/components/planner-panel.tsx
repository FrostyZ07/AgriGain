"use client";

import { Check } from "lucide-react";
import type { PlannerStep } from "@/types";

interface PlannerPanelProps {
  planner: PlannerStep[];
}

function StepDot({ status }: { status: PlannerStep["status"] }) {
  if (status === "done")
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-ag-green text-white">
        <Check size={10} strokeWidth={3} />
      </span>
    );
  if (status === "running")
    return (
      <span className="flex h-4 w-4 items-center justify-center">
        <span className="h-2.5 w-2.5 rounded-full bg-ag-ochre ag-pulse" />
      </span>
    );
  return (
    <span className="flex h-4 w-4 items-center justify-center">
      <span className="h-2.5 w-2.5 rounded-full border border-ag-wait" />
    </span>
  );
}

export function PlannerPanel({ planner }: PlannerPanelProps) {
  return (
    <section data-testid="planner-panel" className="border border-ag-border bg-ag-surface">
      <div className="border-b border-ag-border px-4 py-2.5">
        <p className="font-mono-ag text-[10px] uppercase tracking-[0.2em] text-ag-muted">
          Planner
        </p>
      </div>
      <ul className="p-4">
        {planner.map((s, i) => (
          <li
            key={s.id}
            data-testid={`planner-step-${s.id}`}
            className="relative flex items-start gap-3 pb-4 last:pb-0"
          >
            {i < planner.length - 1 && (
              <span className="absolute left-[7px] top-5 h-full w-px bg-ag-border" />
            )}
            <StepDot status={s.status} />
            <div className="-mt-0.5">
              <p
                className={`text-sm ${
                  s.status === "waiting" ? "text-ag-wait" : "text-ag-ink"
                }`}
              >
                {s.label}
              </p>
              <p className="font-mono-ag text-[10px] uppercase tracking-[0.15em] text-ag-wait">
                {s.status === "done"
                  ? "Completed"
                  : s.status === "running"
                    ? "Running"
                    : "Waiting"}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
