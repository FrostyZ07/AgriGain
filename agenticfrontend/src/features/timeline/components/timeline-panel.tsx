"use client";

import { Clock3 } from "lucide-react";
import { motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { useWorkspaceStore } from "@/features/workspace/store/workspace.store";

export function TimelinePanel() {
  const timeline = useWorkspaceStore((state) => state.timeline);

  return (
    <section id="timeline-panel" className="rounded-lg border bg-card shadow-sm" aria-labelledby="timeline-title">
      <div className="flex items-start gap-3 border-b p-4">
        <div className="rounded-md bg-secondary p-2">
          <Clock3 className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Timeline</p>
          <h2 id="timeline-title" className="mt-1 text-lg font-semibold">
            Investigation history
          </h2>
        </div>
      </div>
      <div className="max-h-[360px] space-y-3 overflow-auto p-4">
        {timeline.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-background/70 p-4 text-sm text-muted-foreground">
            Planner decisions, evidence, confidence updates, and recommendation changes will appear here.
          </div>
        ) : (
          timeline.map((event) => (
            <motion.article
              key={event.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative rounded-md border bg-background/70 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline">{event.type}</Badge>
                <span className="text-xs text-muted-foreground">{event.time}</span>
              </div>
              <p className="mt-2 text-sm font-medium">{event.title}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{event.detail}</p>
            </motion.article>
          ))
        )}
      </div>
    </section>
  );
}
