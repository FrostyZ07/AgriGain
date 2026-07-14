"use client";

import { Moon, RotateCcw, SunMedium } from "lucide-react";
import { useTheme } from "next-themes";

import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { useWorkspaceStore } from "@/features/workspace/store/workspace.store";

export function WorkspaceHeader() {
  const { theme, setTheme } = useTheme();
  const phase = useWorkspaceStore((state) => state.phase);
  const resetWorkspace = useWorkspaceStore((state) => state.resetWorkspace);

  return (
    <header className="sticky top-0 z-20 border-b bg-background/88 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-3 lg:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              AG
            </div>
            <div>
              <p className="text-sm font-semibold leading-none">Agri-Gain</p>
              <p className="mt-1 text-xs text-muted-foreground">AI Decision Workspace for Agricultural Waste</p>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={phase} />
          <Button
            aria-label="Toggle theme"
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <SunMedium className="h-4 w-4 dark:hidden" aria-hidden="true" />
            <Moon className="hidden h-4 w-4 dark:block" aria-hidden="true" />
          </Button>
          <Button aria-label="Reset investigation" variant="ghost" size="icon" onClick={resetWorkspace}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </header>
  );
}
