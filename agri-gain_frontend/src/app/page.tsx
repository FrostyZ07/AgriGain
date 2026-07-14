"use client";

import { useInvestigation } from "@/hooks/use-investigation";
import { TopBar } from "@/components/topbar";
import { Landing } from "@/components/landing";
import { ConversationPanel } from "@/components/conversation-panel";
import { PlannerPanel } from "@/components/planner-panel";
import { AgentBoard } from "@/components/agent-board";
import { Timeline } from "@/components/timeline";
import { RecommendationWorkspace } from "@/components/recommendation-workspace";
import { EvidencePanel } from "@/components/evidence-panel";

export default function Home() {
  const {
    phase,
    messages,
    waste,
    quantity,
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
  } = useInvestigation();

  const isActive = phase !== "landing";

  return (
    <div className="min-h-screen bg-ag-bg">
      <TopBar phase={phase} />

      {!isActive ? (
        <Landing onStart={start} />
      ) : (
        <main className="mx-auto grid max-w-7xl grid-cols-1 gap-4 p-4 sm:p-6 lg:grid-cols-3">
          {/* Left Column — Conversation & Planner */}
          <div className="flex flex-col gap-4 lg:col-span-1">
            <ConversationPanel
              phase={phase}
              messages={messages}
              setPriority={setPriority}
              followUp={followUp}
            />
            {phase !== "clarify" && (
              <>
                <PlannerPanel planner={planner} />
                <AgentBoard agents={agents} />
              </>
            )}
          </div>

          {/* Right 2/3 — Recommendation & Timeline & Evidence */}
          <div className="flex flex-col gap-4 lg:col-span-2">
            <RecommendationWorkspace
              phase={phase}
              rec={rec}
              waste={waste}
              quantity={quantity}
              confidence={confidence}
              selectedAlt={selectedAlt}
              setSelectedAlt={setSelectedAlt}
              scenarioNote={scenarioNote}
              schemesVisible={schemesVisible}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Timeline timeline={timeline} />
              <EvidencePanel waste={waste} schemesVisible={schemesVisible} />
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
