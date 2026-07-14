"use client";

import type { TimelineEvent } from "@/types";

interface TimelineProps {
  timeline: TimelineEvent[];
}

const TONE: Record<string, string> = {
  info: "bg-ag-wait",
  success: "bg-ag-green",
  update: "bg-ag-terracotta",
};

export function Timeline({ timeline }: TimelineProps) {
  return (
    <section
      data-testid="investigation-timeline"
      className="border border-ag-border bg-ag-surface"
    >
      <div className="border-b border-ag-border px-4 py-2.5">
        <p className="font-mono-ag text-[10px] uppercase tracking-[0.2em] text-ag-muted">
          Investigation Timeline
        </p>
      </div>
      {timeline.length === 0 ? (
        <p className="p-4 text-xs leading-relaxed text-ag-wait">
          Discoveries will appear here as the investigation progresses.
        </p>
      ) : (
        <ul className="max-h-[300px] overflow-y-auto p-4">
          {timeline.map((e, i) => (
            <li
              key={e.id}
              className={`ag-fade-up flex items-start gap-3 pb-3 last:pb-0 ${
                i === 0 ? "" : "opacity-70"
              }`}
            >
              <span
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                  TONE[e.tone] || TONE.info
                }`}
              />
              <div>
                <p className="text-xs leading-relaxed text-ag-ink">{e.text}</p>
                <p className="font-mono-ag text-[10px] text-ag-wait">
                  {e.time}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
