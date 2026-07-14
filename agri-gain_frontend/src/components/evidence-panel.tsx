"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, BookOpen, MapPin, Landmark } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { WasteType } from "@/types";

interface EvidencePanelProps {
  waste: WasteType | null;
  schemesVisible: boolean;
}

export function EvidencePanel({ waste, schemesVisible }: EvidencePanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!waste) {
    return (
      <section className="border border-ag-border bg-ag-surface">
        <div className="border-b border-ag-border px-4 py-2.5">
          <p className="font-mono-ag text-[10px] uppercase tracking-[0.2em] text-ag-muted">
            Evidence
          </p>
        </div>
        <div className="p-4">
          <p className="text-xs leading-relaxed text-ag-wait">
            Supporting evidence will appear here as the investigation progresses —
            including knowledge references, market data, buyer information, and
            government schemes.
          </p>
        </div>
      </section>
    );
  }

  const sections = [
    {
      id: "knowledge",
      label: "Agricultural Knowledge",
      icon: BookOpen,
      count: waste.knowledge.length,
      items: waste.knowledge.map((k) => ({ text: k, source: "Knowledge Base" })),
    },
    {
      id: "buyers",
      label: "Nearby Buyers",
      icon: MapPin,
      count: waste.buyers.length,
      items: waste.buyers.map(
        (b) => ({ text: `${b.name} — ${b.distance}, ${b.price}`, source: "Buyer Discovery" })
      ),
    },
    {
      id: "schemes",
      label: "Government Schemes",
      icon: Landmark,
      count: waste.schemes.length,
      items: waste.schemes.map(
        (s) => ({ text: `${s.name}: ${s.benefit}`, source: "Government Portal" })
      ),
      hidden: !schemesVisible,
    },
  ];

  return (
    <section className="border border-ag-border bg-ag-surface">
      <div className="border-b border-ag-border px-4 py-2.5">
        <p className="font-mono-ag text-[10px] uppercase tracking-[0.2em] text-ag-muted">
          Evidence
        </p>
      </div>
      <div className="divide-y divide-ag-border">
        {sections.filter((s) => !s.hidden).map((section) => {
          const isOpen = expanded === section.id;
          const Icon = section.icon;
          return (
            <div key={section.id}>
              <button
                data-testid={`evidence-section-${section.id}`}
                onClick={() => setExpanded(isOpen ? null : section.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors duration-200 hover:bg-ag-bg"
              >
                <div className="flex items-center gap-2">
                  <Icon size={13} className="text-ag-muted" />
                  <span className="text-sm text-ag-ink">{section.label}</span>
                  <span className="font-mono-ag text-[10px] text-ag-wait">
                    ({section.count})
                  </span>
                </div>
                {isOpen ? (
                  <ChevronDown size={14} className="text-ag-muted" />
                ) : (
                  <ChevronRight size={14} className="text-ag-muted" />
                )}
              </button>
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <ul className="space-y-2 border-t border-ag-border px-4 py-3">
                      {section.items.map((item, i) => (
                        <li key={i} className="ag-slide-in-right" style={{ animationDelay: `${i * 0.04}s` }}>
                          <p className="text-xs leading-relaxed text-ag-ink">
                            {item.text}
                          </p>
                          <p className="font-mono-ag text-[9px] uppercase tracking-[0.15em] text-ag-wait">
                            Source: {item.source}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}
