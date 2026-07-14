"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import { PRIORITIES } from "@/lib/waste-data";
import type { Message, Phase } from "@/types";

interface ConversationPanelProps {
  phase: Phase;
  messages: Message[];
  setPriority: (key: string) => void;
  followUp: (text: string) => void;
}

const SUGGESTED = [
  "Compare compost instead",
  "What if transport costs double?",
  "Find nearby buyers",
  "Government schemes",
  "Lower investment options",
  "Explain this recommendation",
];

export function ConversationPanel({
  phase,
  messages,
  setPriority,
  followUp,
}: ConversationPanelProps) {
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  const send = () => {
    if (!input.trim()) return;
    followUp(input.trim());
    setInput("");
  };

  return (
    <section
      data-testid="conversation-panel"
      className="flex flex-col border border-ag-border bg-ag-surface"
    >
      <div className="border-b border-ag-border px-4 py-2.5">
        <p className="font-mono-ag text-[10px] uppercase tracking-[0.2em] text-ag-muted">
          Conversation
        </p>
      </div>

      <div className="flex max-h-[420px] min-h-[180px] flex-1 flex-col gap-4 overflow-y-auto p-4">
        {messages.map((m) => (
          <div key={m.id} className="ag-fade-up">
            <p
              className={`font-mono-ag text-[10px] uppercase tracking-[0.15em] ${
                m.role === "user" ? "text-ag-terracotta" : "text-ag-green"
              }`}
            >
              {m.role === "user" ? "You" : "Agri-Gain"}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-ag-ink whitespace-pre-line">
              {m.text}
            </p>
          </div>
        ))}

        {phase === "clarify" &&
          messages.some((m) => m.role === "ai") && (
            <div className="ag-fade-up flex flex-wrap gap-2 pt-1">
              {PRIORITIES.map((p) => (
                <button
                  key={p.key}
                  data-testid={`priority-chip-${p.key}`}
                  onClick={() => setPriority(p.key)}
                  className="cursor-pointer rounded-full border border-ag-border px-3 py-1.5 text-xs text-ag-ink transition-colors duration-200 hover:border-ag-green hover:bg-ag-green hover:text-white"
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        <div ref={endRef} />
      </div>

      {phase === "investigating" && (
        <div className="border-t border-ag-border px-4 py-3">
          <p className="flex items-center gap-2 font-mono-ag text-[11px] text-ag-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-ag-ochre ag-pulse" />{" "}
            Investigation in progress…
          </p>
        </div>
      )}

      {phase === "recommendation" && (
        <div className="border-t border-ag-border p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {SUGGESTED.map((s) => (
              <button
                key={s}
                data-testid={`suggested-action-${s
                  .toLowerCase()
                  .replace(/[^a-z]+/g, "-")}`}
                onClick={() => followUp(s)}
                className="cursor-pointer rounded-full border border-ag-border px-2.5 py-1 text-[11px] text-ag-muted transition-colors duration-200 hover:border-ag-terracotta hover:text-ag-terracotta"
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              data-testid="followup-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask a follow-up — the investigation continues…"
              className="w-full border border-ag-border bg-ag-bg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ag-green"
            />
            <button
              data-testid="followup-send-btn"
              onClick={send}
              disabled={!input.trim()}
              className="bg-ag-green px-3 text-white transition-colors duration-200 hover:bg-ag-green-dark disabled:opacity-40"
            >
              <ArrowUp size={15} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
