"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowRight, TrendingUp, Leaf, Clock, DollarSign } from "lucide-react";
import type { Recommendation, WasteType, Phase } from "@/types";
import { formatINR, cn } from "@/lib/utils";

interface RecommendationWorkspaceProps {
  phase: Phase;
  rec: Recommendation | null;
  waste: WasteType | null;
  quantity: number;
  confidence: number;
  selectedAlt: string | null;
  setSelectedAlt: (id: string | null) => void;
  scenarioNote: string | null;
  schemesVisible: boolean;
}

function statusLabel(phase: Phase): { label: string; dot: string; pulse: boolean } {
  if (phase === "recommendation")
    return { label: "—Performed", dot: "bg-ag-green", pulse: false };
  if (phase === "investigating")
    return { label: "—Investigating", dot: "bg-ag-ochre", pulse: true };
  return { label: "—Idle", dot: "bg-ag-wait", pulse: false };
}

export function RecommendationWorkspace({
  phase,
  rec,
  waste,
  quantity,
  confidence,
  selectedAlt,
  setSelectedAlt,
  scenarioNote,
  schemesVisible,
}: RecommendationWorkspaceProps) {
  const status = statusLabel(phase);

  if (!rec || !waste) {
    return (
      <section className="border border-ag-border bg-ag-surface">
        <div className="border-b border-ag-border px-4 py-2.5">
          <p className="font-mono-ag text-[10px] uppercase tracking-[0.2em] text-ag-muted">
            Recommendation
            <span className="ml-2 inline-flex items-center gap-1.5">
              <span className={cn("h-1.5 w-1.5 rounded-full", status.dot, status.pulse && "ag-pulse")} />
              <span className={cn("text-[9px]", phase === "investigating" ? "text-ag-ochre" : phase === "recommendation" ? "text-ag-green" : "text-ag-wait")}>
                {status.label}
              </span>
            </span>
          </p>
        </div>
        <div className="p-6 text-center">
          <p className="text-sm leading-relaxed text-ag-wait">
            Your recommendations will appear here after Agri-Gain finishes investigating
            your situation.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-ag-muted">
            Every recommendation will include financial analysis, sustainability impact,
            supporting evidence, confidence, and alternative opportunities.
          </p>
        </div>
      </section>
    );
  }

  const { alt, rationale, profit } = rec;

  return (
    <section className="border border-ag-border bg-ag-surface">
      <div className="border-b border-ag-border px-4 py-2.5">
        <p className="font-mono-ag text-[10px] uppercase tracking-[0.2em] text-ag-muted">
          Recommendation
          <span className="ml-2 inline-flex items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 rounded-full", status.dot, status.pulse && "ag-pulse")} />
            <span className={cn("text-[9px]", phase === "investigating" ? "text-ag-ochre" : phase === "recommendation" ? "text-ag-green" : "text-ag-wait")}>
              {status.label}
            </span>
          </span>
        </p>
      </div>

      <div className="p-4">
        {/* Scenario note */}
        <AnimatePresence>
          {scenarioNote && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 border border-ag-ochre/40 bg-ag-ochre/10 px-3 py-2 text-xs text-ag-ochre"
            >
              {scenarioNote}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hero Recommendation */}
        <div className="ag-fade-up border border-ag-green/30 bg-ag-green/[0.04] p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="font-mono-ag text-[10px] uppercase tracking-[0.2em] text-ag-green">
                Recommended Action
              </p>
              <h3 className="mt-1 font-display text-xl font-bold text-ag-ink">
                {alt.name}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-ag-muted">
                {rationale}
              </p>

              {/* Key metrics */}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="ag-count-up border border-ag-border p-3">
                  <div className="flex items-center gap-1.5">
                    <DollarSign size={12} className="text-ag-green" />
                    <p className="font-mono-ag text-[10px] uppercase tracking-[0.1em] text-ag-muted">
                      Profit
                    </p>
                  </div>
                  <p className="mt-1 font-display text-lg font-bold text-ag-ink">
                    {formatINR(profit)}
                  </p>
                </div>
                <div className="ag-count-up border border-ag-border p-3" style={{ animationDelay: "0.05s" }}>
                  <div className="flex items-center gap-1.5">
                    <TrendingUp size={12} className="text-ag-green" />
                    <p className="font-mono-ag text-[10px] uppercase tracking-[0.1em] text-ag-muted">
                      ROI
                    </p>
                  </div>
                  <p className="mt-1 font-display text-lg font-bold text-ag-ink">
                    {alt.roi}
                  </p>
                </div>
                <div className="ag-count-up border border-ag-border p-3" style={{ animationDelay: "0.1s" }}>
                  <div className="flex items-center gap-1.5">
                    <Leaf size={12} className="text-ag-green" />
                    <p className="font-mono-ag text-[10px] uppercase tracking-[0.1em] text-ag-muted">
                      Sustainability
                    </p>
                  </div>
                  <p className="mt-1 font-display text-lg font-bold text-ag-ink">
                    {alt.sustainability}/100
                  </p>
                </div>
                <div className="ag-count-up border border-ag-border p-3" style={{ animationDelay: "0.15s" }}>
                  <div className="flex items-center gap-1.5">
                    <Clock size={12} className="text-ag-green" />
                    <p className="font-mono-ag text-[10px] uppercase tracking-[0.1em] text-ag-muted">
                      Timeline
                    </p>
                  </div>
                  <p className="mt-1 font-display text-lg font-bold text-ag-ink">
                    {alt.timeWeeks} weeks
                  </p>
                </div>
              </div>

              {/* Confidence Bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <p className="font-mono-ag text-[10px] uppercase tracking-[0.15em] text-ag-muted">
                    Confidence
                  </p>
                  <p className="font-mono-ag text-sm font-medium text-ag-ink">
                    {confidence}%
                  </p>
                </div>
                <div className="mt-1 h-1.5 w-full bg-ag-border">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${confidence}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="h-full bg-ag-green"
                  />
                </div>
              </div>

              {/* Reason */}
              <div className="mt-3 border-t border-ag-border pt-3">
                <p className="font-mono-ag text-[10px] uppercase tracking-[0.15em] text-ag-muted">
                  Why this option?
                </p>
                <ul className="mt-1 space-y-1">
                  {alt.reasons.map((r) => (
                    <li key={r} className="flex items-start gap-2 text-xs text-ag-ink">
                      <Check size={12} className="mt-0.5 shrink-0 text-ag-green" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Alternative Opportunities */}
        <div className="mt-4">
          <p className="font-mono-ag text-[10px] uppercase tracking-[0.2em] text-ag-muted">
            Alternative Opportunities
          </p>
          <div className="mt-2 space-y-1">
            {waste.alternatives.map((a) => {
              const isSelected = selectedAlt === a.id;
              const isHero = a.id === alt.id;
              return (
                <button
                  key={a.id}
                  data-testid={`alt-${a.id}`}
                  onClick={() => setSelectedAlt(isSelected ? null : a.id)}
                  className={`flex w-full items-center justify-between border px-3 py-2.5 text-left transition-colors duration-200 ${
                    isHero
                      ? "border-ag-green bg-ag-green/[0.04]"
                      : isSelected
                        ? "border-ag-terracotta bg-ag-terracotta/[0.04]"
                        : "border-ag-border hover:border-ag-muted"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isHero && <Check size={12} className="text-ag-green" />}
                    <span
                      className={`text-sm ${
                        isHero ? "font-medium text-ag-green" : "text-ag-ink"
                      }`}
                    >
                      {a.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono-ag text-[11px] text-ag-muted">
                      {formatINR(Math.round(a.profitPerTon * quantity))}
                    </span>
                    <span
                      className={`font-mono-ag text-[10px] ${
                        isHero ? "text-ag-green" : "text-ag-muted"
                      }`}
                    >
                      {a.confidence}%
                    </span>
                    <ArrowRight
                      size={12}
                      className={`transition-transform duration-200 ${
                        isSelected ? "rotate-90 text-ag-terracotta" : "text-ag-muted"
                      }`}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected alternative details */}
          <AnimatePresence>
            {selectedAlt && (() => {
              const sel = waste.alternatives.find((a) => a.id === selectedAlt);
              if (!sel) return null;
              const isHero = sel.id === alt.id;
              return (
                <motion.div
                  key={sel.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-1 overflow-hidden border border-ag-terracotta/30 bg-ag-terracotta/[0.02]"
                >
                  <div className="p-3">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div>
                        <p className="font-mono-ag text-[9px] uppercase tracking-[0.15em] text-ag-muted">Investment</p>
                        <p className="mt-0.5 font-mono-ag text-xs font-medium text-ag-ink">{formatINR(sel.investment)}</p>
                      </div>
                      <div>
                        <p className="font-mono-ag text-[9px] uppercase tracking-[0.15em] text-ag-muted">ROI</p>
                        <p className="mt-0.5 font-mono-ag text-xs font-medium text-ag-ink">{sel.roi}</p>
                      </div>
                      <div>
                        <p className="font-mono-ag text-[9px] uppercase tracking-[0.15em] text-ag-muted">Difficulty</p>
                        <p className="mt-0.5 font-mono-ag text-xs font-medium text-ag-ink">{sel.difficulty}</p>
                      </div>
                      <div>
                        <p className="font-mono-ag text-[9px] uppercase tracking-[0.15em] text-ag-muted">Processing</p>
                        <p className="mt-0.5 font-mono-ag text-xs font-medium text-ag-ink">{sel.timeWeeks} weeks</p>
                      </div>
                    </div>
                    {isHero && (
                      <p className="mt-2 text-[11px] text-ag-green">✓ Current recommendation</p>
                    )}
                  </div>
                </motion.div>
              );
            })()}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
