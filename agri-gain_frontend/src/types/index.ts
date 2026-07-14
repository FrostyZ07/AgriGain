/* ─── Workspace Core Types ─── */

export type Phase = "landing" | "clarify" | "investigating" | "recommendation";

export type AgentStatus = "waiting" | "running" | "done";

export type PlannerStatus = "waiting" | "running" | "done";

export type TimelineTone = "info" | "success" | "update";

export interface Message {
  id: number;
  role: "user" | "ai";
  text: string;
}

export interface PlannerStep {
  id: string;
  label: string;
  status: PlannerStatus;
}

export interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  result: string | null;
}

export interface TimelineEvent {
  id: number;
  text: string;
  tone: TimelineTone;
  time: string;
}

/* ─── Waste & Recommendation Types ─── */

export interface WasteAlternative {
  id: string;
  name: string;
  profitPerTon: number;
  sustainability: number;
  investment: number;
  roi: string;
  timeWeeks: number;
  difficulty: "Low" | "Medium" | "High";
  confidence: number;
  reasons: string[];
}

export interface WasteType {
  name: string;
  defaultQty: number;
  usableRatio: number;
  knowledge: string[];
  alternatives: WasteAlternative[];
  buyers: { name: string; distance: string; price: string }[];
  schemes: { name: string; benefit: string }[];
  discovery: string;
  emoji?: string;
}

export interface Recommendation {
  alt: WasteAlternative;
  rationale: string;
  profit: number;
}

export interface Priority {
  key: string;
  label: string;
}

/* ─── Investigation State ─── */

export interface InvestigationState {
  phase: Phase;
  messages: Message[];
  waste: WasteType | null;
  quantity: number;
  priority: string | null;
  planner: PlannerStep[];
  agents: Agent[];
  timeline: TimelineEvent[];
  rec: Recommendation | null;
  confidence: number;
  selectedAlt: string | null;
  schemesVisible: boolean;
  scenarioNote: string | null;
  start: (text: string) => void;
  setPriority: (key: string) => void;
  followUp: (text: string) => void;
}
