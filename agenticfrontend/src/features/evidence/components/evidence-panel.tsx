"use client";

import { FileCheck2, GaugeCircle, HelpCircle } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Metric } from "@/components/shared/metric";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkspaceStore } from "@/features/workspace/store/workspace.store";
import { formatPercent } from "@/utils/format";

const confidenceHistory = [
  { step: "Start", value: 24 },
  { step: "Waste", value: 58 },
  { step: "Knowledge", value: 77 },
  { step: "Market", value: 88 },
  { step: "Ranked", value: 94 },
];

export function EvidencePanel() {
  const evidence = useWorkspaceStore((state) => state.evidence);
  const assumptions = useWorkspaceStore((state) => state.assumptions);
  const confidenceSignals = useWorkspaceStore((state) => state.confidenceSignals);
  const selectedRecommendationId = useWorkspaceStore((state) => state.selectedRecommendationId);
  const activeEvidenceTab = useWorkspaceStore((state) => state.activeEvidenceTab);
  const setActiveEvidenceTab = useWorkspaceStore((state) => state.setActiveEvidenceTab);
  const selectedRecommendation = useWorkspaceStore((state) =>
    state.recommendations.find((item) => item.id === selectedRecommendationId),
  );

  return (
    <section id="evidence-panel" className="rounded-lg border bg-card shadow-sm" aria-labelledby="evidence-title">
      <div className="border-b p-4">
        <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Evidence</p>
        <h2 id="evidence-title" className="mt-1 text-lg font-semibold">
          Trust and explainability
        </h2>
      </div>
      <div className="p-4">
        <Tabs value={activeEvidenceTab} onValueChange={(val: any) => setActiveEvidenceTab(val)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="evidence">Evidence</TabsTrigger>
            <TabsTrigger value="confidence">Confidence</TabsTrigger>
            <TabsTrigger value="assumptions">Assumptions</TabsTrigger>
          </TabsList>

          <TabsContent value="evidence" className="space-y-3">
            {evidence.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-background/70 p-4">
                <p className="text-sm font-medium">Evidence will appear as the investigation progresses.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Each item will show what was learned and how strongly it affects the recommendation.
                </p>
              </div>
            ) : (
              evidence.map((item) => (
                <article key={item.id} className="rounded-md border bg-background/70 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <FileCheck2 className="h-4 w-4 text-primary" aria-hidden="true" />
                        <p className="text-sm font-medium">{item.title}</p>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.summary}</p>
                    </div>
                    <Badge variant={item.quality === "high" ? "success" : "info"}>{item.quality}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Decision impact: {item.impact}%</p>
                </article>
              ))
            )}
          </TabsContent>

          <TabsContent value="confidence" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric
                label="Current confidence"
                value={selectedRecommendation ? formatPercent(selectedRecommendation.confidence) : "Pending"}
                detail={selectedRecommendation?.title ?? "Waiting for recommendation"}
              />
              <Metric label="Signals evaluated" value={confidenceSignals.length || "Pending"} detail="Positive and limiting factors" />
            </div>
            <div className="h-[180px] rounded-lg border bg-background/70 p-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={confidenceHistory} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
                  <XAxis dataKey="step" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {confidenceSignals.map((signal) => (
                <div key={signal.label} className="flex items-center justify-between rounded-md border bg-background/70 p-2 text-sm">
                  <span>{signal.label}</span>
                  <Badge variant={signal.direction === "positive" ? "success" : "warning"}>{signal.value}%</Badge>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="assumptions" className="space-y-3">
            {assumptions.map((assumption) => (
              <article key={assumption.id} className="rounded-md border bg-background/70 p-3">
                <div className="flex items-start gap-2">
                  <HelpCircle className="mt-0.5 h-4 w-4 text-accent" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium">{assumption.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{assumption.value}</p>
                  </div>
                  <Badge className="ml-auto" variant={assumption.certainty === "estimated" ? "warning" : "success"}>
                    {assumption.certainty}
                  </Badge>
                </div>
              </article>
            ))}
            <div className="rounded-md border bg-background/70 p-3 text-xs text-muted-foreground">
              <div className="mb-1 flex items-center gap-2 text-foreground">
                <GaugeCircle className="h-4 w-4" aria-hidden="true" />
                What could change the decision?
              </div>
              Moisture, transport distance, storage time, and current buyer demand can all refine the ranking.
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}
