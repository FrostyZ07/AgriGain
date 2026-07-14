"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BarChart3, Leaf, Scale, TrendingUp } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

import { Metric } from "@/components/shared/metric";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWorkspaceStore } from "@/features/workspace/store/workspace.store";
import { cn } from "@/utils/cn";
import { formatCurrency, formatPercent } from "@/utils/format";

export function RecommendationWorkspace() {
  const recommendations = useWorkspaceStore((state) => state.recommendations);
  const selectedRecommendationId = useWorkspaceStore((state) => state.selectedRecommendationId);
  const selectRecommendation = useWorkspaceStore((state) => state.selectRecommendation);
  const phase = useWorkspaceStore((state) => state.phase);
  const setActiveEvidenceTab = useWorkspaceStore((state) => state.setActiveEvidenceTab);
  const selected = recommendations.find((item) => item.id === selectedRecommendationId) ?? recommendations[0];

  if (phase === "ready" && recommendations.length === 0) {
    return (
      <section className="rounded-lg border bg-card shadow-sm" aria-labelledby="recommendation-title">
        <div className="border-b p-4">
          <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Recommendation</p>
          <h2 id="recommendation-title" className="mt-1 text-lg font-semibold">
            No agricultural waste identified
          </h2>
        </div>
        <div className="p-6">
          <div className="rounded-lg border border-dashed border-amber-500/30 bg-amber-500/5 p-6">
            <p className="text-sm font-medium text-amber-600">No crop waste parameters found.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Agri-Gain could not identify any agricultural crop waste type or quantity in your query. Please provide inputs like "5 tonnes of sugarcane bagasse" or "rice husk from 10 acres" to run estimates and suggest monetization strategies.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (!selected) {
    return (
      <section className="rounded-lg border bg-card shadow-sm" aria-labelledby="recommendation-title">
        <div className="border-b p-4">
          <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Recommendation</p>
          <h2 id="recommendation-title" className="mt-1 text-lg font-semibold">
            Decision workspace
          </h2>
        </div>
        <div className="p-6">
          <div className="rounded-lg border border-dashed bg-background/70 p-6">
            <p className="text-sm font-medium">Your recommendation will form here progressively.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              The workspace will first understand the request, plan the investigation, gather evidence, then rank
              opportunities with confidence and trade-offs.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border bg-card shadow-sm" aria-labelledby="recommendation-title">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Recommendation</p>
          <h2 id="recommendation-title" className="mt-1 text-lg font-semibold">
            Current best decision
          </h2>
        </div>
        <Badge variant="success">Confidence {formatPercent(selected.confidence)}</Badge>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={selected.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className="space-y-4 p-4"
        >
          <div className="rounded-lg border bg-background/70 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2">
                  <Badge variant="default">Rank {selected.rank}</Badge>
                  <Badge variant="info">Living recommendation</Badge>
                </div>
                <h3 className="mt-4 text-3xl font-semibold leading-tight">{selected.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{selected.summary}</p>
              </div>
              <div className="grid min-w-[220px] grid-cols-2 gap-2">
                <Metric label="Profit" value={formatCurrency(selected.expectedProfit)} />
                <Metric label="ROI" value={`${selected.roi}x`} />
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Investment" value={formatCurrency(selected.investment)} detail="Estimated setup" />
              <Metric label="Timeline" value={selected.timeline} detail="Decision horizon" />
              <Metric label="Difficulty" value={selected.difficulty} detail="Operational effort" />
              <Metric label="Sustainability" value={formatPercent(selected.sustainabilityScore)} detail="Impact score" />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border bg-background/70 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />
                  <h3 className="text-sm font-semibold">Why this option</h3>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {selected.advantages.map((advantage) => (
                    <li key={advantage} className="flex gap-2">
                      <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                      <span>{advantage}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border bg-background/70 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Scale className="h-4 w-4 text-accent" aria-hidden="true" />
                  <h3 className="text-sm font-semibold">Trade-offs</h3>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {selected.limitations.map((limitation) => (
                    <li key={limitation} className="flex gap-2">
                      <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                      <span>{limitation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-lg border bg-background/70 p-4">
              <div className="mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" aria-hidden="true" />
                <h3 className="text-sm font-semibold">Decision drivers</h3>
              </div>
              <div className="h-[170px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={selected.drivers} layout="vertical" margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                    <XAxis type="number" hide domain={[0, 40]} />
                    <YAxis type="category" dataKey="label" width={92} tick={{ fontSize: 10 }} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-background/70 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Leaf className="h-4 w-4 text-primary" aria-hidden="true" />
              <h3 className="text-sm font-semibold">Compare alternatives</h3>
            </div>
            <div className="grid gap-2 lg:grid-cols-3">
              {recommendations.map((recommendation) => (
                <button
                  key={recommendation.id}
                  type="button"
                  onClick={() => selectRecommendation(recommendation.id)}
                  className={cn(
                    "rounded-md border p-3 text-left transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    recommendation.id === selected.id && "border-primary bg-primary/8",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{recommendation.title}</p>
                    <Badge variant={recommendation.id === selected.id ? "default" : "outline"}>
                      {formatPercent(recommendation.confidence)}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatCurrency(recommendation.expectedProfit)} profit, {recommendation.roi}x ROI
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                document.getElementById("timeline-panel")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Explain reasoning
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setActiveEvidenceTab("evidence");
                document.getElementById("evidence-panel")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              View evidence
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setActiveEvidenceTab("assumptions");
                document.getElementById("evidence-panel")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Compare assumptions
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
