"use client";

import { ActivitySquare } from "lucide-react";
import { motion } from "framer-motion";

import { StatusBadge } from "@/components/shared/status-badge";
import { Progress } from "@/components/ui/progress";
import { useWorkspaceStore } from "@/features/workspace/store/workspace.store";

export function InvestigationPanel() {
  const modules = useWorkspaceStore((state) => state.modules);
  const activeQuestion = useWorkspaceStore((state) => state.activeQuestion);

  return (
    <section className="rounded-lg border bg-card shadow-sm" aria-labelledby="investigation-title">
      <div className="flex items-start gap-3 border-b p-4">
        <div className="rounded-md bg-accent/12 p-2 text-accent">
          <ActivitySquare className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Investigation</p>
          <h2 id="investigation-title" className="mt-1 text-lg font-semibold">
            Current AI activity
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{activeQuestion}</p>
        </div>
      </div>
      <div className="space-y-3 p-4">
        {modules.map((module) => (
          <motion.article
            key={module.id}
            layout
            className="rounded-md border bg-background/70 p-3"
            transition={{ duration: 0.25 }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{module.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{module.latestFinding}</p>
              </div>
              <StatusBadge status={module.status} />
            </div>
            <Progress className="mt-3" value={module.progress} />
          </motion.article>
        ))}
      </div>
    </section>
  );
}
