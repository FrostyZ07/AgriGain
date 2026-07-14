"use client";

import { toast } from "sonner";
import { create } from "zustand";

import { demoProgressEvents, followUpActions, initialWorkspace } from "@/constants/demo-workspace";
import { investigationService } from "@/services/investigation/investigation.service";
import type { ConversationMessage, WorkspaceEvent, WorkspacePhase, WorkspaceSnapshot } from "@/types/workspace";

interface WorkspaceState extends WorkspaceSnapshot {
  isRunning: boolean;
  startInvestigation: (message: string) => void;
  applyFollowUp: (message: string) => Promise<void>;
  selectRecommendation: (id: string) => void;
  setActiveEvidenceTab: (tab: "evidence" | "confidence" | "assumptions") => void;
  applyEvent: (event: WorkspaceEvent) => void;
  resetWorkspace: () => void;
}

let scheduledEvents: number[] = [];

function clearScheduledEvents() {
  scheduledEvents.forEach((timer) => window.clearTimeout(timer));
  scheduledEvents = [];
}

function timestamp(): string {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
}

function inferUnderstanding(message: string) {
  const lower = message.toLowerCase();
  const waste = lower.includes("coconut")
    ? "Coconut shell"
    : lower.includes("fruit")
      ? "Fruit waste"
      : lower.includes("bagasse")
        ? "Sugarcane bagasse"
        : "Rice husk";

  const quantity = lower.match(/(\d+(?:\.\d+)?)\s*(ton|tons|tonne|tonnes|kg|kilogram)/);
  const goal = lower.includes("quick")
    ? "Quick disposal"
    : lower.includes("sustain")
      ? "Sustainability"
      : lower.includes("low investment")
        ? "Low investment"
        : "Maximum profit";

  return [
    { label: "Waste type", value: waste, confidence: 96, source: "inferred" as const },
    { label: "Quantity", value: quantity ? `${quantity[1]} ${quantity[2]}` : "5 tonnes", confidence: quantity ? 94 : 62, source: quantity ? ("user" as const) : ("inferred" as const) },
    { label: "Primary goal", value: goal, confidence: 92, source: "inferred" as const },
    { label: "Storage", value: "Unknown", confidence: 24, source: "unknown" as const },
  ];
}

function updatePhase(state: WorkspaceState, phase: WorkspacePhase, event: Extract<WorkspaceEvent, { type: "phase" }>) {
  state.phase = phase;
  if (event.objective) {
    state.currentObjective = event.objective;
  }
  if (event.activeQuestion) {
    state.activeQuestion = event.activeQuestion;
  }
}

function reduceEvent(state: WorkspaceState, event: WorkspaceEvent): Partial<WorkspaceState> {
  const next: WorkspaceState = { ...state };

  if ("timeline" in event && event.timeline) {
    next.timeline = [{ ...event.timeline, time: timestamp() }, ...next.timeline];
  }

  switch (event.type) {
    case "phase":
      updatePhase(next, event.phase, event);
      if (event.phase === "ready") {
        next.isRunning = false;
        next.suggestedActions = followUpActions;
      }
      break;
    case "module":
      next.modules = next.modules.map((module) =>
        module.id === event.moduleId
          ? {
              ...module,
              status: event.status,
              progress: event.progress,
              latestFinding: event.latestFinding,
            }
          : module,
      );
      break;
    case "planner":
      next.planner = next.planner.map((decision) =>
        decision.id === event.decisionId
          ? {
              ...decision,
              status: event.status,
              reason: event.reason,
            }
          : decision,
      );
      break;
    case "evidence":
      next.evidence = [event.evidence, ...next.evidence.filter((item) => item.id !== event.evidence.id)];
      break;
    case "recommendations":
      next.phase = "recommending";
      next.recommendations = event.recommendations;
      next.selectedRecommendationId = event.selectedRecommendationId ?? event.recommendations[0]?.id ?? next.selectedRecommendationId;
      break;
    case "confidence":
      next.recommendations = next.recommendations.map((recommendation) =>
        recommendation.id === event.recommendationId
          ? { ...recommendation, confidence: event.confidence }
          : recommendation,
      );
      next.confidenceSignals = event.signals;
      break;
  }

  return next;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  ...initialWorkspace,
  isRunning: false,
  startInvestigation: async (message: string) => {
    clearScheduledEvents();
    const userMessage: ConversationMessage = {
      id: `user-${Date.now()}`,
      author: "user",
      content: message,
      timestamp: timestamp(),
    };

    const assistantMessage: ConversationMessage = {
      id: `assistant-${Date.now()}`,
      author: "assistant",
      content:
        "Understood. I am going to contact the Agri-Gain Multi-Agent platform to investigate the waste profile, compare opportunities, and collect evidence.",
      timestamp: timestamp(),
    };

    set({
      ...initialWorkspace,
      phase: "understanding",
      currentObjective: "Understand the situation and begin investigation",
      activeQuestion: "Querying Agri-Gain Multi-Agent platform...",
      conversation: [assistantMessage, userMessage, ...initialWorkspace.conversation],
      understanding: inferUnderstanding(message),
      isRunning: true,
      timeline: [
        {
          id: `timeline-${Date.now()}`,
          time: timestamp(),
          title: "Investigation started",
          detail: "Connecting to the agent orchestrator server...",
          type: "conversation",
        },
      ],
    });

    try {
      // Query the actual FastAPI backend /investigations endpoint!
      const res = await investigationService.start({ message });
      
      // Play back backend events dynamically
      res.events.forEach((event, index) => {
        const timer = window.setTimeout(() => {
          set((state) => reduceEvent(state, event));
        }, 550 + index * 520);
        scheduledEvents.push(timer);
      });
    } catch (err) {
      console.warn("Failed to fetch live backend events, falling back to mock progression:", err);
      toast.error("Backend offline", {
        description: "Falling back to simulated agent progression.",
      });
      
      demoProgressEvents.forEach((event, index) => {
        const timer = window.setTimeout(() => {
          set((state) => reduceEvent(state, event));
        }, 550 + index * 520);
        scheduledEvents.push(timer);
      });
    }
  },
  applyFollowUp: async (message: string) => {
    clearScheduledEvents();
    const userMessage: ConversationMessage = {
      id: `follow-up-${Date.now()}`,
      author: "user",
      content: message,
      timestamp: timestamp(),
    };

    const assistantMessage: ConversationMessage = {
      id: `follow-up-answer-${Date.now()}`,
      author: "assistant",
      content:
        "Analyzing follow-up and refining recommendation paths...",
      timestamp: timestamp(),
    };

    const state = get();
    const wasteField = state.understanding.find((u) => u.label.toLowerCase().includes("waste"));
    const qtyField = state.understanding.find((u) => u.label.toLowerCase().includes("quantity"));
    const wasteType = wasteField?.value && wasteField.value !== "Unknown" ? wasteField.value : "";
    const quantity = qtyField?.value && qtyField.value !== "Unknown" ? qtyField.value : "";

    let combinedQuery = message;
    if (wasteType || quantity) {
      combinedQuery = `Context: User has ${quantity} of ${wasteType}. Refinement: ${message}`;
    }

    set((s) => ({
      conversation: [assistantMessage, userMessage, ...s.conversation],
      phase: "refining",
      isRunning: true,
      currentObjective: `Refine investigation: ${message}`,
      activeQuestion: "Checking what changed and re-running agents.",
      timeline: [
        {
          id: `follow-up-timeline-${Date.now()}`,
          time: timestamp(),
          title: "Follow-up added",
          detail: `Refinement request: "${message}"`,
          type: "planner",
        },
        ...s.timeline,
      ],
      modules: s.modules.map((module) =>
        module.id === "ranking"
          ? { ...module, status: "running", progress: 48, latestFinding: "Re-running planner and re-ranking options." }
          : module,
      ),
    }));

    try {
      const res = await investigationService.start({ message: combinedQuery });
      
      res.events.forEach((event, index) => {
        const timer = window.setTimeout(() => {
          set((s) => reduceEvent(s, event));
        }, 550 + index * 520);
        scheduledEvents.push(timer);
      });
    } catch (err) {
      console.warn("Failed to refine live backend events, falling back to mock:", err);
      toast.error("Backend offline", {
        description: "Reverted to simulated refinement progression.",
      });

      window.setTimeout(() => {
        set((s) => ({
          isRunning: false,
          phase: "ready",
          modules: s.modules.map((module) =>
            module.id === "ranking"
              ? { ...module, status: "updated", progress: 100, latestFinding: "Recommendation updated using prior evidence." }
              : module,
          ),
          timeline: [
            {
              id: `follow-up-complete-${Date.now()}`,
              time: timestamp(),
              title: "Recommendation refined",
              detail: "The current recommendation was preserved while assumptions and comparison context updated.",
              type: "recommendation",
            },
            ...s.timeline,
          ],
        }));
        toast.success("Investigation refined", {
          description: "The workspace reused existing evidence and updated the active decision.",
        });
      }, 1300);
    }
  },
  selectRecommendation: (id: string) => set({ selectedRecommendationId: id }),
  setActiveEvidenceTab: (tab: "evidence" | "confidence" | "assumptions") => set({ activeEvidenceTab: tab }),
  applyEvent: (event: WorkspaceEvent) => set((s) => reduceEvent(s, event)),
  resetWorkspace: () => {
    clearScheduledEvents();
    set({ ...initialWorkspace, isRunning: false });
  },
}));
