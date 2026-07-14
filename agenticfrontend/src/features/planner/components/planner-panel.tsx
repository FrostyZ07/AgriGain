"use client";

import { BrainCircuit } from "lucide-react";

import { StatusBadge } from "@/components/shared/status-badge";
import { useWorkspaceStore } from "@/features/workspace/store/workspace.store";

export function PlannerPanel() {
  const planner = useWorkspaceStore((state) => state.planner);
  const objective = useWorkspaceStore((state) => state.currentObjective);

  return (
    <section className="rounded-lg border bg-card shadow-sm" aria-labelledby="planner-title">
      <div className="flex items-start gap-3 border-b p-4">
        <div className="rounded-md bg-primary/10 p-2 text-primary">
          <BrainCircuit className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Planner</p>
          <h2 id="planner-title" className="mt-1 text-lg font-semibold">
            Strategy in motion
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{objective}</p>
        </div>
      </div>
      <div className="space-y-3 p-4">
        {planner.map((decision) => (
          <article key={decision.id} className="rounded-md border bg-background/70 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{decision.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{decision.reason}</p>
              </div>
              <StatusBadge status={decision.status} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {decision.required ? "Required for this investigation" : "Activated only if evidence requires it"}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
