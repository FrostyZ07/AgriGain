"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

interface LandingProps {
  onStart: (text: string) => void;
}

const EXAMPLES = [
  "I have around 5 tonnes of rice husk",
  "8 tonnes of sugarcane bagasse after crushing",
  "3 tonnes of coconut shells piling up",
];

const CHIPS = [
  "Rice Husk",
  "Sugarcane Bagasse",
  "Coconut Shell",
  "Fruit Waste",
  "Corn Stalks",
];

export function Landing({ onStart }: LandingProps) {
  const [value, setValue] = useState("");

  const submit = () => {
    if (value.trim()) onStart(value.trim());
  };

  return (
    <div className="flex min-h-[calc(100vh-53px)] flex-col justify-between px-5 sm:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center py-16">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="font-mono-ag text-xs uppercase tracking-[0.25em] text-ag-terracotta"
        >
          AI Decision Workspace for Agricultural Waste
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut", delay: 0.08 }}
          className="mt-6 font-display leading-[1.05] tracking-tight text-ag-ink"
        >
          <span className="text-4xl font-extrabold sm:text-5xl lg:text-6xl">
            Don&rsquo;t Guess.
          </span>
          <br />
          <span className="text-5xl font-bold italic sm:text-6xl lg:text-7xl">
            Investigate.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut", delay: 0.16 }}
          className="mt-6 max-w-xl text-base leading-relaxed text-ag-muted"
        >
          Agri-Gain investigates your agricultural waste — calculating value,
          searching live markets, weighing every pathway — and explains exactly
          why one option beats the rest.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut", delay: 0.24 }}
          className="mt-10"
        >
          <label className="font-mono-ag text-[11px] uppercase tracking-[0.2em] text-ag-muted">
            What agricultural waste are you dealing with today?
          </label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              data-testid="landing-waste-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={EXAMPLES[0]}
              className="w-full border border-ag-border bg-ag-surface px-4 py-3.5 text-base text-ag-ink placeholder:text-ag-wait outline-none focus:ring-1 focus:ring-ag-green"
            />
            <button
              data-testid="start-investigation-btn"
              onClick={submit}
              disabled={!value.trim()}
              className="flex items-center justify-center gap-2 whitespace-nowrap bg-ag-green px-6 py-3.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-ag-green-dark disabled:opacity-40"
            >
              Start Investigation <ArrowRight size={16} />
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {CHIPS.map((c) => (
              <button
                key={c}
                data-testid={`example-chip-${c.toLowerCase().replace(/\s/g, "-")}`}
                onClick={() =>
                  setValue(`I have agricultural waste: ${c.toLowerCase()}`)
                }
                className="cursor-pointer rounded-full border border-ag-border bg-ag-surface px-3 py-1 text-xs text-ag-muted transition-colors duration-200 hover:border-ag-green hover:text-ag-green"
              >
                {c}
              </button>
            ))}
          </div>
        </motion.div>

        {/* How the Investigation Unfolds */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut", delay: 0.32 }}
          className="mt-12"
        >
          <p className="font-mono-ag text-[11px] uppercase tracking-[0.2em] text-ag-muted">
            How the Investigation Unfolds
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                num: "01",
                title: "Understand",
                desc: "Your situation and goals",
              },
              {
                num: "02",
                title: "Plan",
                desc: "Which agents to run",
              },
              {
                num: "03",
                title: "Estimate",
                desc: "Yield & economics",
              },
              {
                num: "04",
                title: "Search",
                desc: "Markets and buyers",
              },
              {
                num: "05",
                title: "Rank",
                desc: "Options by fit",
              },
              {
                num: "06",
                title: "Explain",
                desc: "Why & why not",
              },
            ].map((step) => (
              <div
                key={step.num}
                className="flex items-start gap-3 border border-ag-border bg-ag-surface p-3"
              >
                <span className="font-mono-ag text-sm font-medium text-ag-green shrink-0 leading-none mt-0.5">
                  {step.num}
                </span>
                <div>
                  <p className="text-sm font-medium text-ag-ink">
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ag-muted">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-px border-t border-ag-border py-8 sm:grid-cols-3">
        {[
          ["Investigates", "Five AI systems gather evidence in parallel — you watch every step."],
          ["Explains", "Every recommendation carries its reasoning, assumptions and confidence."],
          ["Recommends", "One clear decision, alternatives compared honestly beside it."],
        ].map(([title, desc]) => (
          <div key={title} className="py-2 pr-6">
            <p className="font-display text-sm font-bold text-ag-ink">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-ag-muted">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
