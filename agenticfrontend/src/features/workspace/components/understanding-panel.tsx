"use client";

import { CheckCircle2, CircleHelp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useWorkspaceStore } from "@/features/workspace/store/workspace.store";

export function UnderstandingPanel() {
  const understanding = useWorkspaceStore((state) => state.understanding);

  return (
    <section className="rounded-lg border bg-card shadow-sm" aria-labelledby="understanding-title">
      <div className="border-b p-4">
        <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Current understanding</p>
        <h2 id="understanding-title" className="mt-1 text-lg font-semibold">
          What the AI knows
        </h2>
      </div>
      <div className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-4">
        {understanding.map((item) => {
          const known = item.source !== "unknown";
          const Icon = known ? CheckCircle2 : CircleHelp;
          return (
            <article key={item.label} className="rounded-md border bg-background/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">{item.label}</p>
                <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
              </div>
              <p className="mt-2 text-sm font-semibold">{item.value}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <Badge variant={known ? "success" : "warning"}>{item.source}</Badge>
                <span className="text-xs text-muted-foreground">{item.confidence}%</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
