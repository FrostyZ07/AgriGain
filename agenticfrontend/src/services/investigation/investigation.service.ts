import { apiClient } from "@/services/api/client";
import type { WorkspaceEvent } from "@/types/workspace";

export interface StartInvestigationRequest {
  message: string;
  objective?: string;
}

export interface StartInvestigationResponse {
  sessionId: string;
  events: WorkspaceEvent[];
}

export const investigationService = {
  async start(request: StartInvestigationRequest): Promise<StartInvestigationResponse> {
    const { data } = await apiClient.post<StartInvestigationResponse>("/investigations", request);
    return data;
  },
};
