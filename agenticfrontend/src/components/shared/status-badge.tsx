import { Activity, CheckCircle2, CircleDashed, PauseCircle, RefreshCcw, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { ModuleStatus, WorkspacePhase } from "@/types/workspace";

interface StatusBadgeProps {
  status: ModuleStatus | WorkspacePhase;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = {
    idle: { label: "Idle", icon: CircleDashed, variant: "muted" as const },
    understanding: { label: "Understanding", icon: Activity, variant: "info" as const },
    planning: { label: "Planning", icon: Activity, variant: "info" as const },
    investigating: { label: "Investigating", icon: Activity, variant: "info" as const },
    recommending: { label: "Building", icon: RefreshCcw, variant: "warning" as const },
    ready: { label: "Ready", icon: CheckCircle2, variant: "success" as const },
    refining: { label: "Refining", icon: RefreshCcw, variant: "warning" as const },
    waiting: { label: "Waiting", icon: CircleDashed, variant: "muted" as const },
    running: { label: "Running", icon: Activity, variant: "info" as const },
    completed: { label: "Completed", icon: CheckCircle2, variant: "success" as const },
    updated: { label: "Updated", icon: RefreshCcw, variant: "warning" as const },
    unavailable: { label: "Unavailable", icon: XCircle, variant: "warning" as const },
    skipped: { label: "Skipped", icon: PauseCircle, variant: "muted" as const },
  }[status];

  const Icon = config.icon;

  return (
    <Badge variant={config.variant}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {config.label}
    </Badge>
  );
}
