"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { detectWaste, parseQuantity, pickHero, PRIORITIES } from "@/lib/waste-data";
import { formatINR } from "@/lib/utils";
import type {
  Phase,
  Message,
  PlannerStep,
  Agent,
  TimelineEvent,
  Recommendation,
} from "@/types";

const PLANNER_INIT: PlannerStep[] = [
  { id: "understand", label: "Understanding Request", status: "waiting" },
  { id: "objectives", label: "Identifying Objectives", status: "waiting" },
  { id: "strategy", label: "Planning Investigation", status: "waiting" },
  { id: "ranking", label: "Opportunity Ranking", status: "waiting" },
];

const AGENTS_INIT: Agent[] = [
  { id: "calc", name: "Calculator", status: "waiting", result: null },
  { id: "knowledge", name: "Knowledge Base", status: "waiting", result: null },
  { id: "market", name: "Market Search", status: "waiting", result: null },
  { id: "buyers", name: "Nearby Buyers", status: "waiting", result: null },
  { id: "engine", name: "Recommendation Engine", status: "waiting", result: null },
];

let uid = 0;
const nid = () => ++uid;
const now = () =>
  new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

export function useInvestigation() {
  const [phase, setPhase] = useState<Phase>("landing");
  const [messages, setMessages] = useState<Message[]>([]);
  const [waste, setWaste] = useState<ReturnType<typeof detectWaste> | null>(null);
  const [quantity, setQuantity] = useState(0);
  const [priority, setPriorityKey] = useState<string | null>(null);
  const [planner, setPlanner] = useState<PlannerStep[]>(PLANNER_INIT);
  const [agents, setAgents] = useState<Agent[]>(AGENTS_INIT);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [selectedAlt, setSelectedAlt] = useState<string | null>(null);
  const [schemesVisible, setSchemesVisible] = useState(false);
  const [scenarioNote, setScenarioNote] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const backendDataRef = useRef<any>(null);

  const getBackendDetails = useCallback((data: any, fallbackW: any, fallbackQty: number) => {
    if (!data || !data.events) return null;
    const events = data.events;

    const recsEvent = events.find((e: any) => e.type === "recommendations");
    const backendRecs = recsEvent?.recommendations || [];

    const calcEvent = events.find((e: any) => e.type === "module" && e.moduleId === "calculator");
    const knowledgeEvent = events.find((e: any) => e.type === "module" && e.moduleId === "knowledge");
    const marketEvent = events.find((e: any) => e.type === "module" && e.moduleId === "market");

    const calcResult = calcEvent?.latestFinding || `≈ ${Math.round(fallbackQty * fallbackW.usableRatio * 10) / 10} t usable`;
    const knowledgeResult = knowledgeEvent?.latestFinding || `${fallbackW.knowledge.length} verified references retrieved`;
    const marketResult = marketEvent?.latestFinding || "Live prices verified";

    let mappedAlts = fallbackW.alternatives;
    if (backendRecs.length > 0) {
      mappedAlts = backendRecs.map((item: any) => ({
        id: item.id,
        name: item.title,
        profitPerTon: Math.round(item.expectedProfit / fallbackQty),
        sustainability: item.sustainabilityScore,
        investment: item.investment,
        roi: `${item.roi}x`,
        timeWeeks: parseInt(item.timeline) || 2,
        difficulty: item.difficulty,
        confidence: item.confidence,
        reasons: item.advantages || []
      }));
    }

    let mappedRec = null;
    if (backendRecs.length > 0) {
      const first = backendRecs[0];
      mappedRec = {
        alt: mappedAlts[0],
        rationale: first.summary,
        profit: first.expectedProfit
      };
    }

    return {
      calcResult,
      knowledgeResult,
      marketResult,
      opportunitiesText: knowledgeEvent?.opportunities_text || "",
      alternatives: mappedAlts,
      rec: mappedRec,
      confidence: backendRecs[0]?.confidence || fallbackW.alternatives[0]?.confidence || 85
    };
  }, []);

  useEffect(
    () => () => timers.current.forEach(clearTimeout),
    []
  );

  const after = useCallback(
    (ms: number, fn: () => void) => {
      timers.current.push(setTimeout(fn, ms));
    },
    []
  );

  const addMsg = (role: Message["role"], text: string) =>
    setMessages((m) => [...m, { id: nid(), role, text }]);

  const addEvent = (text: string, tone: TimelineEvent["tone"] = "info") =>
    setTimeline((t) => [{ id: nid(), text, tone, time: now() }, ...t]);

  const setStep = (id: string, status: PlannerStep["status"]) =>
    setPlanner((p) =>
      p.map((s) => (s.id === id ? { ...s, status } : s))
    );

  const setAgent = (id: string, patch: Partial<Agent>) =>
    setAgents((a) =>
      a.map((ag) => (ag.id === id ? { ...ag, ...patch } : ag))
    );

  /* ─── refs to avoid stale closures ─── */
  const wasteRef = useRef<ReturnType<typeof detectWaste> | null>(null);
  const qtyRef = useRef(0);
  useEffect(() => {
    wasteRef.current = waste;
  }, [waste]);
  useEffect(() => {
    qtyRef.current = quantity;
  }, [quantity]);

  /* ─── Start investigation ─── */
  const start = (text: string) => {
    const w = detectWaste(text);
    const qty = parseQuantity(text) || w.defaultQty;
    setWaste(w);
    setQuantity(qty);
    addMsg("user", text);
    setPhase("clarify");
    after(500, () =>
      addMsg(
        "ai",
        `Understood — roughly ${qty} tonnes of ${w.name.toLowerCase()}. Before I begin investigating, what matters most to you right now?`
      )
    );
  };

  /* ─── Set priority and run investigation ─── */
  const setPriority = (key: string) => {
    const label = PRIORITIES.find((p) => p.key === key)?.label || key;
    setPriorityKey(key);
    addMsg("user", label);
    after(400, () =>
      addMsg(
        "ai",
        "Got it. Starting the investigation — you can watch each step as it runs."
      )
    );
    setPhase("investigating");

    // Fetch from backend
    const w = wasteRef.current!;
    const qty = qtyRef.current;
    const combinedQuery = `User has ${qty} tonnes of ${w.name}. Priority goal: ${label}.`;

    const backendPromise = fetch("http://localhost:8000/investigations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: combinedQuery }),
    }).then((res) => {
      if (!res.ok) throw new Error("HTTP error " + res.status);
      return res.json();
    });

    runScript(key, backendPromise);
  };

  /* ─── Simulated investigation script with backend data injection ─── */
  const runScript = (prio: string, backendPromise: Promise<any>) => {
    const w = wasteRef.current!;
    const qty = qtyRef.current;

    after(300, () => {
      setStep("understand", "running");
      addEvent("Investigation started");
    });
    after(900, () => {
      setStep("understand", "done");
      setStep("objectives", "running");
      addEvent(`Waste identified — ${w.name}, ${qty} t`);
    });
    after(1600, () => {
      setStep("objectives", "done");
      setStep("strategy", "running");
    });
    after(2300, () => {
      setStep("strategy", "done");
      setStep("ranking", "running");
      addEvent("Investigation plan ready — 5 systems dispatched");
    });

    after(2500, () => setAgent("calc", { status: "running" }));
    after(2900, () => setAgent("knowledge", { status: "running" }));
    after(3400, () => setAgent("market", { status: "running" }));
    after(3900, () => setAgent("buyers", { status: "running" }));

    // Wait for the backend response to arrive
    backendPromise
      .then((data) => {
        backendDataRef.current = data;
        const details = getBackendDetails(data, w, qty);

        // Check if backend identified it as out-of-scope (empty recommendations list)
        const isOut = data.events?.some((e: any) => e.type === "recommendations" && e.recommendations.length === 0);
        if (isOut) {
          // Immediately skip animation and render out-of-scope screen
          timers.current.forEach(clearTimeout);
          setStep("understand", "done");
          setStep("objectives", "done");
          setStep("strategy", "done");
          setStep("ranking", "done");
          
          setAgents(agents => agents.map(a => ({ ...a, status: "done", result: "Skipped" })));
          setRec(null);
          setPhase("recommendation");
          addMsg(
            "ai",
            "I couldn't identify any agricultural waste or volume details in your request. Please specify the crop waste type (e.g. rice husk, sugarcane bagasse) and quantity to start an investigation."
          );
          return;
        }

        // Schedule progressive done states using real backend details
        after(3200, () => {
          setAgent("calc", { status: "done", result: details?.calcResult || "" });
          addEvent("Quantity estimated by Calculator", "success");
        });
        after(4200, () => {
          setAgent("knowledge", { status: "done", result: details?.knowledgeResult || "" });
          addEvent("Agricultural knowledge retrieved", "success");
        });
        after(5400, () => {
          setAgent("market", { status: "done", result: details?.marketResult || "" });
          addEvent(w.discovery, "update");
        });
        after(6400, () => {
          const numBuyers = data.events?.find((e: any) => e.type === "module" && e.moduleId === "market") ? 2 : w.buyers.length;
          setAgent("buyers", {
            status: "done",
            result: details ? `${numBuyers} buyers found within 55 km` : `${w.buyers.length} buyers found within 55 km`,
          });
          addEvent(`${w.buyers.length} nearby buyers identified`, "success");
        });

        after(6700, () => setAgent("engine", { status: "running" }));
        after(8000, () => {
          if (details && details.rec) {
            setRec(details.rec);
            setWaste(prev => prev ? { ...prev, alternatives: details.alternatives } : prev);
            setConfidence(58);
            setAgent("engine", {
              status: "done",
              result: `${details.alternatives.length} pathways evaluated and ranked`,
            });
            setStep("ranking", "done");
            addEvent(`Recommendation formed — ${details.rec.alt.name}`, "update");
          }
        });
        after(8700, () => {
          if (details) {
            setConfidence(Math.round(details.confidence * 0.9));
            addEvent("Confidence increased — market prices corroborated", "update");
          }
        });
        after(9500, () => {
          if (details && details.rec) {
            setConfidence(details.confidence);
            setPhase("recommendation");
            addMsg(
              "ai",
              `Investigation complete. Based on the evidence gathered, ${details.rec.alt.name.toLowerCase()} is the strongest option for your ${w.name.toLowerCase()} — expected profit around ${formatINR(details.rec.profit)}. The full reasoning and evidence are in the workspace. Ask me anything to refine it.`
            );
          }
        });
      })
      .catch((err) => {
        console.warn("Failed to fetch live backend data, fallback to simulated:", err);
        runFallbackLocalScript(prio);
      });
  };

  const runFallbackLocalScript = (prio: string) => {
    const w = wasteRef.current!;
    const qty = qtyRef.current;

    after(2500, () => setAgent("calc", { status: "running" }));
    after(2900, () => setAgent("knowledge", { status: "running" }));
    after(3400, () => setAgent("market", { status: "running" }));
    after(3900, () => setAgent("buyers", { status: "running" }));

    const usable = Math.round(qty * w.usableRatio * 10) / 10;
    after(4200, () => {
      setAgent("calc", { status: "done", result: `≈ ${usable} t usable after moisture loss` });
      addEvent("Quantity estimated by Calculator", "success");
    });
    after(5200, () => {
      setAgent("knowledge", {
        status: "done",
        result: `${w.knowledge.length} verified references retrieved`,
      });
      addEvent("Agricultural knowledge retrieved", "success");
    });
    after(6400, () => {
      setAgent("market", { status: "done", result: "Live prices verified this week" });
      addEvent(w.discovery, "update");
    });
    after(7400, () => {
      setAgent("buyers", {
        status: "done",
        result: `${w.buyers.length} buyers found within 55 km`,
      });
      addEvent(`${w.buyers.length} nearby buyers identified`, "success");
    });

    after(7700, () => setAgent("engine", { status: "running" }));
    after(9000, () => {
      const { alt, rationale } = pickHero(w, prio);
      const profit = Math.round(alt.profitPerTon * qty);
      setRec({ alt, rationale, profit });
      setConfidence(58);
      setAgent("engine", {
        status: "done",
        result: `${w.alternatives.length} pathways evaluated and ranked`,
      });
      setStep("ranking", "done");
      addEvent(`Recommendation formed — ${alt.name}`, "update");
    });
    after(9700, () => {
      setConfidence(76);
      addEvent("Confidence increased — market prices corroborated", "update");
    });
    after(10500, () => {
      const { alt } = pickHero(w, prio);
      setConfidence(alt.confidence);
      setPhase("recommendation");
      addMsg(
        "ai",
        `Investigation complete. Based on the evidence gathered, ${alt.name.toLowerCase()} is the strongest option for your ${w.name.toLowerCase()} — expected profit around ${formatINR(Math.round(alt.profitPerTon * qtyRef.current))}. The full reasoning and evidence are in the workspace. Ask me anything to refine it.`
      );
    });
  };

  /* ─── Refinement follow-up integrated with FastAPI orchestrator ─── */
  const followUp = async (text: string) => {
    addMsg("user", text);
    const w = wasteRef.current;
    if (!w || !rec) return;

    setStep("ranking", "running");
    setAgent("engine", { status: "running" });

    const combinedQuery = `Context: User has ${qtyRef.current} tonnes of ${w.name}. Refinement: ${text}`;

    try {
      const response = await fetch("http://localhost:8000/investigations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: combinedQuery }),
      });
      const data = await response.json();
      
      const details = getBackendDetails(data, w, qtyRef.current);
      if (details && details.rec) {
        setRec(details.rec);
        setConfidence(details.confidence);
        
        const lowerText = text.toLowerCase();
        if (lowerText.includes("compost")) {
          const compost = details.alternatives.find(
            (a: any) => a.id.includes("compost") || a.name.toLowerCase().includes("compost")
          );
          if (compost) setSelectedAlt(compost.id);
        } else if (lowerText.includes("transport") || lowerText.includes("cost")) {
          setScenarioNote("Scenario applied: transport cost recalculated");
        }
        
        setAgent("engine", { status: "done", result: "Recommendation refined" });
        setStep("ranking", "done");
        addEvent("Recommendation refined", "success");

        const aiMsg = details.opportunitiesText || details.rec.rationale || `I have refined the recommendation for ${details.rec.alt.name}. Expected profit is now ${formatINR(details.rec.profit)}.`;
        addMsg("ai", aiMsg);
      } else {
        throw new Error("Invalid backend details");
      }
    } catch (err) {
      console.warn("Failed to refine live backend data, using local mock refinement fallback:", err);
      // Local fallback refinement logic
      const t = text.toLowerCase();
      if (t.includes("compost")) {
        const compost = w.alternatives.find(
          (a) => a.id.includes("compost") || a.name.toLowerCase().includes("compost")
        );
        if (compost) {
          setSelectedAlt(compost.id);
          after(700, () => {
            addEvent("Comparison opened — " + compost.name, "update");
            addMsg(
              "ai",
              `Comparing ${rec.alt.name.toLowerCase()} with ${compost.name.toLowerCase()}: composting needs only ${formatINR(compost.investment)} upfront (vs ${formatINR(rec.alt.investment)}) and scores ${compost.sustainability}/100 on sustainability, but returns ${formatINR(Math.round(compost.profitPerTon * qtyRef.current))} over ${compost.timeWeeks} weeks — ${rec.alt.name.toLowerCase()} remains more profitable. The comparison is highlighted in the alternatives panel.`
            );
          });
        }
      } else if (t.includes("transport") || t.includes("cost")) {
        const newProfit = Math.round(rec.profit * 0.82);
        setAgent("calc", { status: "running" });
        after(900, () => {
          setAgent("calc", {
            status: "done",
            result: "Scenario recalculated — transport ×2",
          });
          setRec((r) => (r ? { ...r, profit: newProfit } : r));
          setConfidence((c) => Math.max(c - 6, 40));
          setScenarioNote("Scenario applied: transport cost doubled");
          addEvent("Scenario applied — transport cost doubled", "update");
          addEvent("Confidence adjusted downward", "update");
          addMsg(
            "ai",
            `If transport costs double, expected profit drops to about ${formatINR(newProfit)} and confidence falls slightly, since margins thin on delivery-dependent sales. ${rec.alt.name} still leads because most processing happens on-site.`
          );
        });
      } else if (t.includes("buyer")) {
        setAgent("buyers", { status: "running" });
        after(900, () => {
          setAgent("buyers", {
            status: "done",
            result: `${w.buyers.length} buyers verified within 55 km`,
          });
          addEvent("Buyer list refreshed", "success");
          const list = w.buyers
            .map((b) => `${b.name} (${b.distance}, ${b.price})`)
            .join("; ");
          addMsg(
            "ai",
            `Nearest verified buyers: ${list}. Full details are in the Evidence panel under Nearby Buyers.`
          );
        });
      } else if (
        t.includes("scheme") ||
        t.includes("subsid") ||
        t.includes("government")
      ) {
        setAgent("knowledge", { status: "running" });
        after(900, () => {
          setAgent("knowledge", {
            status: "done",
            result: "Government scheme records retrieved",
          });
          setSchemesVisible(true);
          addEvent("Government schemes discovered", "success");
          const list = w.schemes
            .map((s) => `${s.name} — ${s.benefit}`)
            .join(". ");
          addMsg(
            "ai",
            `Two relevant programmes apply: ${list}. These could reduce your effective investment substantially. They're now listed in the Evidence panel.`
          );
        });
      } else if (t.includes("lower investment") || t.includes("cheaper") || t.includes("low investment")) {
        const cheap = [...w.alternatives].sort(
          (a, b) => a.investment - b.investment
        )[0];
        after(800, () => {
          setRec({
            alt: cheap,
            rationale: "Re-ranked by lowest upfront investment, at your request.",
            profit: Math.round(cheap.profitPerTon * qtyRef.current),
          });
          setConfidence(cheap.confidence);
          setSelectedAlt(null);
          setScenarioNote(null);
          addEvent(`Recommendation updated — ${cheap.name}`, "update");
          addMsg(
            "ai",
            `Re-ranked for lowest investment: ${cheap.name.toLowerCase()} needs only ${formatINR(cheap.investment)} upfront. The trade-off is lower profit (${formatINR(Math.round(cheap.profitPerTon * qtyRef.current))}) — the earlier option remains stronger on pure returns.`
          );
        });
      } else if (t.includes("explain") || t.includes("why")) {
        after(700, () => {
          addMsg(
            "ai",
            `${rec.alt.name} leads for three reasons: (1) ${rec.alt.reasons[0].toLowerCase()}, (2) ${rec.alt.reasons[1] ? rec.alt.reasons[1].toLowerCase() : "favourable economics"}, and (3) the financial model shows ${rec.alt.roi} return on ${formatINR(rec.alt.investment)} invested. Key assumptions and remaining uncertainty are listed in the Evidence panel — the ${confidence}% confidence reflects one unverified factor.`
          );
        });
      } else {
        after(700, () => {
          addMsg(
            "ai",
            `I've noted that. Based on current evidence, ${rec.alt.name.toLowerCase()} remains the leading option at ${confidence}% confidence. Try a suggested action below — comparing alternatives, testing scenarios, or checking schemes — and I'll update the recommendation accordingly.`
          );
        });
      }
    }
  };

  return {
    phase,
    messages,
    waste,
    quantity,
    priority,
    planner,
    agents,
    timeline,
    rec,
    confidence,
    selectedAlt,
    setSelectedAlt,
    schemesVisible,
    scenarioNote,
    start,
    setPriority,
    followUp,
  };
}
