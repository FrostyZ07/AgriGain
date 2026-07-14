"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { SendHorizontal } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { useWorkspaceStore } from "@/features/workspace/store/workspace.store";
import { cn } from "@/utils/cn";

const conversationSchema = z.object({
  message: z.string().min(3, "Describe the waste or follow-up in a few words."),
});

type ConversationForm = z.infer<typeof conversationSchema>;

export function ConversationPanel() {
  const phase = useWorkspaceStore((state) => state.phase);
  const conversation = useWorkspaceStore((state) => state.conversation);
  const suggestedActions = useWorkspaceStore((state) => state.suggestedActions);
  const startInvestigation = useWorkspaceStore((state) => state.startInvestigation);
  const applyFollowUp = useWorkspaceStore((state) => state.applyFollowUp);
  const isRunning = useWorkspaceStore((state) => state.isRunning);

  const form = useForm<ConversationForm>({
    resolver: zodResolver(conversationSchema),
    defaultValues: {
      message: "",
    },
  });

  const submitMessage = (values: ConversationForm) => {
    if (phase === "idle") {
      startInvestigation(values.message);
    } else {
      applyFollowUp(values.message);
    }
    form.reset();
  };

  const handleSuggestion = (message: string) => {
    if (phase === "idle") {
      startInvestigation(message);
    } else {
      applyFollowUp(message);
    }
  };

  return (
    <section className="rounded-lg border bg-card shadow-sm" aria-labelledby="conversation-title">
      <div className="border-b p-4">
        <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Conversation</p>
        <h2 id="conversation-title" className="mt-1 text-lg font-semibold">
          Describe, refine, continue
        </h2>
      </div>
      <div className="space-y-3 p-4">
        <form onSubmit={form.handleSubmit(submitMessage)} className="space-y-2">
          <div className="flex gap-2">
            <input
              aria-label="Investigation message"
              className="min-h-10 flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={phase === "idle" ? "Example: 5 tonnes rice husk, maximize profit" : "Ask a what-if or compare options"}
              {...form.register("message")}
            />
            <Button type="submit" size="icon" disabled={isRunning}>
              <SendHorizontal className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          {form.formState.errors.message ? (
            <p className="text-xs text-destructive">{form.formState.errors.message.message}</p>
          ) : null}
        </form>

        <div className="flex flex-wrap gap-2">
          {suggestedActions.slice(0, 4).map((action) => (
            <Button key={action} type="button" variant="secondary" size="sm" onClick={() => handleSuggestion(action)}>
              {action}
            </Button>
          ))}
        </div>

        <div className="max-h-[320px] space-y-3 overflow-auto pr-1">
          {conversation.map((message) => (
            <article
              key={message.id}
              className={cn(
                "rounded-md border p-3 text-sm",
                message.author === "user" ? "ml-6 bg-primary/8" : "mr-6 bg-background/70",
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
                  {message.author === "user" ? "You" : "Agri-Gain"}
                </span>
                <span className="text-xs text-muted-foreground">{message.timestamp}</span>
              </div>
              <p className="leading-relaxed">{message.content}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
