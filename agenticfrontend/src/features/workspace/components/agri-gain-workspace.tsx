"use client";

import { motion } from "framer-motion";
import { ArrowRight, Network, ShieldCheck, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConversationPanel } from "@/features/conversation/components/conversation-panel";
import { EvidencePanel } from "@/features/evidence/components/evidence-panel";
import { InvestigationPanel } from "@/features/investigation/components/investigation-panel";
import { PlannerPanel } from "@/features/planner/components/planner-panel";
import { RecommendationWorkspace } from "@/features/recommendation/components/recommendation-workspace";
import { TimelinePanel } from "@/features/timeline/components/timeline-panel";
import { UnderstandingPanel } from "@/features/workspace/components/understanding-panel";
import { WorkspaceHeader } from "@/features/workspace/components/workspace-header";
import { useWorkspaceStore } from "@/features/workspace/store/workspace.store";

export function AgriGainWorkspace() {
  const phase = useWorkspaceStore((state) => state.phase);
  const startInvestigation = useWorkspaceStore((state) => state.startInvestigation);
  const isIdle = phase === "idle";

  return (
    <div className="min-h-screen">
      <WorkspaceHeader />
      <main className="mx-auto max-w-[1600px] px-4 py-4 lg:px-6 lg:py-6">
        {isIdle ? (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-lg border bg-card shadow-sm"
            aria-labelledby="hero-title"
          >
            <div className="grid gap-6 p-5 lg:grid-cols-[1.1fr_0.9fr] lg:p-8">
              <div className="max-w-3xl">
                <Badge variant="info">Investigation-first AI workspace</Badge>
                <h1 id="hero-title" className="mt-4 text-4xl font-semibold leading-tight text-foreground md:text-5xl">
                  Agri-Gain
                </h1>
                <p className="mt-3 text-lg text-muted-foreground">
                  AI Decision Workspace for agricultural waste. Describe the problem once, then watch planning,
                  evidence, confidence, and recommendations evolve together.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button onClick={() => startInvestigation("I have 5 tonnes of rice husk and want maximum profit")}>
                    Start rice husk investigation
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => startInvestigation("Fruit waste, quick disposal, nearby buyers if possible")}
                  >
                    Try quick disposal
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                <div className="rounded-lg border bg-background/70 p-4">
                  <Network className="h-5 w-5 text-primary" aria-hidden="true" />
                  <p className="mt-3 text-sm font-semibold">Planner visibility</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Shows what the AI is investigating and why, without exposing backend jargon.
                  </p>
                </div>
                <div className="rounded-lg border bg-background/70 p-4">
                  <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
                  <p className="mt-3 text-sm font-semibold">Evidence-backed trust</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Links decisions to evidence, assumptions, and confidence drivers.
                  </p>
                </div>
                <div className="rounded-lg border bg-background/70 p-4">
                  <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
                  <p className="mt-3 text-sm font-semibold">Continuous refinement</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Follow-ups update the current investigation instead of resetting the workspace.
                  </p>
                </div>
              </div>
            </div>
          </motion.section>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(420px,1.45fr)_minmax(300px,0.9fr)]">
          <div className="order-2 space-y-4 xl:order-1">
            <ConversationPanel />
            <PlannerPanel />
          </div>

          <div className="order-1 space-y-4 xl:order-2">
            <UnderstandingPanel />
            <RecommendationWorkspace />
          </div>

          <div className="order-3 space-y-4">
            <InvestigationPanel />
            <EvidencePanel />
            <TimelinePanel />
          </div>
        </div>
      </main>
    </div>
  );
}
