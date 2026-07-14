export type WorkspacePhase =
  | "idle"
  | "understanding"
  | "planning"
  | "investigating"
  | "recommending"
  | "ready"
  | "refining";

export type ModuleStatus = "waiting" | "running" | "completed" | "updated" | "unavailable" | "skipped";

export type EvidenceQuality = "high" | "medium" | "estimated" | "unavailable";

export interface ConversationMessage {
  id: string;
  author: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface UnderstandingField {
  label: string;
  value: string;
  confidence: number;
  source: "user" | "inferred" | "unknown";
}

export interface PlannerDecision {
  id: string;
  label: string;
  status: ModuleStatus;
  reason: string;
  required: boolean;
}

export interface InvestigationModule {
  id: string;
  name: string;
  status: ModuleStatus;
  progress: number;
  latestFinding: string;
}

export interface EvidenceItem {
  id: string;
  title: string;
  category: string;
  summary: string;
  quality: EvidenceQuality;
  impact: number;
}

export interface ConfidenceSignal {
  label: string;
  value: number;
  direction: "positive" | "limiting";
}

export interface Recommendation {
  id: string;
  title: string;
  rank: number;
  confidence: number;
  expectedProfit: number;
  roi: number;
  investment: number;
  timeline: string;
  difficulty: "Low" | "Medium" | "High";
  sustainabilityScore: number;
  summary: string;
  advantages: string[];
  limitations: string[];
  drivers: Array<{ label: string; value: number }>;
}

export interface TimelineEvent {
  id: string;
  time: string;
  title: string;
  detail: string;
  type: "planner" | "evidence" | "recommendation" | "confidence" | "conversation";
}

export interface Assumption {
  id: string;
  label: string;
  value: string;
  certainty: EvidenceQuality;
}

export interface WorkspaceSnapshot {
  phase: WorkspacePhase;
  currentObjective: string;
  activeQuestion: string;
  selectedRecommendationId: string;
  activeEvidenceTab: "evidence" | "confidence" | "assumptions";
  conversation: ConversationMessage[];
  understanding: UnderstandingField[];
  planner: PlannerDecision[];
  modules: InvestigationModule[];
  evidence: EvidenceItem[];
  recommendations: Recommendation[];
  confidenceSignals: ConfidenceSignal[];
  assumptions: Assumption[];
  timeline: TimelineEvent[];
  suggestedActions: string[];
}

export type WorkspaceEvent =
  | {
      type: "phase";
      phase: WorkspacePhase;
      objective?: string;
      activeQuestion?: string;
      timeline?: TimelineEvent;
    }
  | {
      type: "module";
      moduleId: string;
      status: ModuleStatus;
      progress: number;
      latestFinding: string;
      timeline?: TimelineEvent;
    }
  | {
      type: "planner";
      decisionId: string;
      status: ModuleStatus;
      reason: string;
      timeline?: TimelineEvent;
    }
  | {
      type: "evidence";
      evidence: EvidenceItem;
      timeline?: TimelineEvent;
    }
  | {
      type: "recommendations";
      recommendations: Recommendation[];
      selectedRecommendationId?: string;
      timeline?: TimelineEvent;
    }
  | {
      type: "confidence";
      recommendationId: string;
      confidence: number;
      signals: ConfidenceSignal[];
      timeline?: TimelineEvent;
    };
