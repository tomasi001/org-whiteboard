"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useWhiteboard } from "@/contexts/WhiteboardContext";
import { buildRootNodeFromTemplate, buildWhiteboardFromTemplate } from "@/lib/orgTemplate";
import { summarizeTemplate } from "@/lib/orgIntake";
import { MiniCanvasPreview } from "./MiniCanvasPreview";
import type { OrgTemplate } from "@/types/orgTemplate";

interface OrgBuilderWizardProps {
  onClose: () => void;
}

interface Message {
  role: "assistant" | "user";
  content: string;
  previewTemplate?: OrgTemplate | null;
}

interface OrgBuilderAgentResponse {
  guidance: string;
  updatedDraft: OrgTemplate;
  questions: string[];
  isValidForProceed: boolean;
}

type WizardStage = "onboarding" | "review";

const INITIAL_MESSAGE =
  "Start with two details only: your company name and a short company description. I will propose an initial org structure with department heads and starter teams.";

function renderAssistantMessage(response: OrgBuilderAgentResponse): string {
  const questionLine =
    response.questions.length > 0
      ? `\n\nNext check: ${response.questions[0]}`
      : "\n\nReply with revisions, or proceed to whiteboard.";

  return `${response.guidance}${questionLine}`;
}

export function OrgBuilderWizard({ onClose }: OrgBuilderWizardProps) {
  const { setCurrentWhiteboard } = useWhiteboard();
  const [stage, setStage] = useState<WizardStage>("onboarding");
  const [companyName, setCompanyName] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");
  const [feedbackInput, setFeedbackInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: INITIAL_MESSAGE },
  ]);
  const [currentDraft, setCurrentDraft] = useState<OrgTemplate | null>(null);
  const [isProceedReady, setIsProceedReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const summary = summarizeTemplate(currentDraft);
  const canProceed = Boolean(currentDraft) && isProceedReady && !isLoading;

  const continueToWhiteboard = (template: OrgTemplate | null) => {
    if (!template) return;
    setCurrentWhiteboard(buildWhiteboardFromTemplate(template));
    onClose();
  };

  const callAgent = async (payload: {
    mode: "initial" | "revision";
    onboarding?: { companyName: string; companyDescription: string };
    currentDraft?: OrgTemplate;
    feedback?: string;
  }): Promise<OrgBuilderAgentResponse> => {
    const response = await fetch("/api/org-builder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const parsed = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new Error(parsed?.error ?? "Failed to process org builder request.");
    }

    return (await response.json()) as OrgBuilderAgentResponse;
  };

  const submitOnboarding = async () => {
    const name = companyName.trim();
    const description = companyDescription.trim();

    if (!name || !description) {
      setError("Company name and description are required.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setMessages((previous) => [
      ...previous,
      {
        role: "user",
        content: `Company: ${name}\nDescription: ${description}`,
      },
    ]);

    try {
      const response = await callAgent({
        mode: "initial",
        onboarding: { companyName: name, companyDescription: description },
      });

      setCurrentDraft(response.updatedDraft);
      setIsProceedReady(response.isValidForProceed);
      setStage("review");
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: renderAssistantMessage(response),
          previewTemplate: response.updatedDraft,
        },
      ]);
    } catch (submitError) {
      console.error("Org builder onboarding error:", submitError);
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            "I could not create the first draft just now. Please retry with the same details.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const submitRevision = async () => {
    const feedback = feedbackInput.trim();
    if (!feedback || !currentDraft) return;

    setIsLoading(true);
    setError(null);
    setFeedbackInput("");
    setMessages((previous) => [...previous, { role: "user", content: feedback }]);

    try {
      const response = await callAgent({
        mode: "revision",
        currentDraft,
        feedback,
      });

      setCurrentDraft(response.updatedDraft);
      setIsProceedReady(response.isValidForProceed);
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: renderAssistantMessage(response),
          previewTemplate: response.updatedDraft,
        },
      ]);
    } catch (revisionError) {
      console.error("Org builder revision error:", revisionError);
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            "I could not apply that revision. Your last valid draft is still intact. You can retry the request or proceed.",
          previewTemplate: currentDraft,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-5xl mx-4 h-[92vh] flex flex-col overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b border-white/20 flex-shrink-0 bg-black/20 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <CardTitle className="flex items-center gap-2 text-cardzzz-cream">
              <Sparkles className="w-5 h-5 text-cardzzz-accent" />
              <span className="font-roundo lowercase tracking-wide text-cardzzz-cream">
                org builder wizard
              </span>
            </CardTitle>
            <span
              className={`rounded-full border px-2 py-1 text-xs font-satoshi ${
                stage === "review"
                  ? "border-green-300/40 bg-green-400/20 text-cardzzz-cream"
                  : "border-white/25 bg-black/20 text-cardzzz-cream/85"
              }`}
            >
              {stage === "review" ? "Review Mode" : "Onboarding"}
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4 text-cardzzz-cream" />
          </Button>
        </CardHeader>

        <div className="border-b border-white/20 px-4 py-2 bg-black/20 backdrop-blur-md">
          <div className="grid gap-2 md:grid-cols-2 text-xs font-satoshi text-cardzzz-cream/90">
            <div>
              <span className="text-cardzzz-cream">Live snapshot:</span>{" "}
              {`${summary.departments.length} departments, ${summary.teams.length} teams, ${summary.roles.length} roles, ${summary.workflows.length} agent flows`}
            </div>
            <div>
              <span className="text-cardzzz-cream">Company:</span>{" "}
              {summary.name || companyName || "Not named yet"}
            </div>
          </div>
        </div>

        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} flex-col ${
                message.role === "assistant" ? "items-start" : "items-end"
              }`}
            >
              <div
                className={`max-w-[88%] rounded-lg px-4 py-2 text-sm font-satoshi whitespace-pre-wrap ${
                  message.role === "user"
                    ? "bg-cardzzz-cream text-cardzzz-accent border border-cardzzz-cream/50"
                    : "bg-white/10 backdrop-blur-md border border-white/20 text-cardzzz-cream"
                }`}
              >
                {message.content}
              </div>

              {message.role === "assistant" && message.previewTemplate && (
                <div className="mt-2 w-full">
                  <MiniCanvasPreview
                    rootNode={buildRootNodeFromTemplate(message.previewTemplate)}
                  />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/10 border border-white/20 rounded-lg px-4 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-cardzzz-cream" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </CardContent>

        <div className="border-t border-white/20 p-4 flex-shrink-0 bg-black/20 backdrop-blur-md space-y-3">
          {error && (
            <div className="flex items-start gap-2 rounded-[12px] border border-cardzzz-cream/40 bg-cardzzz-accent/40 px-3 py-2 text-sm font-satoshi text-cardzzz-cream">
              <AlertCircle className="w-4 h-4 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {stage === "onboarding" && (
            <div className="space-y-3">
              <div className="grid gap-2">
                <label
                  htmlFor="org-builder-company-name"
                  className="text-xs font-satoshi text-cardzzz-cream/90"
                >
                  Company Name
                </label>
                <input
                  id="org-builder-company-name"
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder="Acme Labs"
                  className="h-[48px] px-4 rounded-[16.168px] border border-white/20 bg-black/20 text-cardzzz-cream placeholder:text-cardzzz-cream/70 caret-cardzzz-cream font-satoshi focus:outline-none focus:ring-2 focus:ring-cardzzz-cream/70"
                  disabled={isLoading}
                />
              </div>

              <div className="grid gap-2">
                <label
                  htmlFor="org-builder-company-description"
                  className="text-xs font-satoshi text-cardzzz-cream/90"
                >
                  Company Description
                </label>
                <textarea
                  id="org-builder-company-description"
                  value={companyDescription}
                  onChange={(event) => setCompanyDescription(event.target.value)}
                  placeholder="What does your company do, and what functions need to exist?"
                  rows={4}
                  className="w-full rounded-[16.168px] border border-white/20 bg-black/20 px-3 py-2 text-sm font-satoshi text-cardzzz-cream placeholder:text-cardzzz-cream/70 caret-cardzzz-cream focus:outline-none focus:ring-2 focus:ring-cardzzz-cream/70"
                  disabled={isLoading}
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={submitOnboarding} disabled={isLoading}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Initial Structure
                </Button>
              </div>
            </div>
          )}

          {stage === "review" && (
            <div className="space-y-3">
              <div className="text-xs font-satoshi text-cardzzz-cream/85">
                Request any edits in plain language. Example: add Finance department, set Sales
                head to Jane, add an SDR team under Sales.
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={feedbackInput}
                  onChange={(event) => setFeedbackInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void submitRevision();
                    }
                  }}
                  placeholder="Describe the change request..."
                  className="flex-1 h-[54px] px-4 py-2 rounded-[16.168px] border border-white/20 bg-black/20 backdrop-blur-md text-cardzzz-cream placeholder:text-cardzzz-cream/70 caret-cardzzz-cream font-satoshi focus:outline-none focus:ring-2 focus:ring-cardzzz-cream/70 focus:border-cardzzz-cream"
                  disabled={isLoading}
                />
                <Button
                  onClick={submitRevision}
                  disabled={isLoading || !feedbackInput.trim()}
                  data-testid="submit-revision"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-satoshi text-cardzzz-cream/80">
                  Proceed is manual only. Nothing auto-launches.
                </div>
                <Button
                  onClick={() => continueToWhiteboard(currentDraft)}
                  disabled={!canProceed}
                  data-testid="proceed-to-whiteboard"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Proceed to Whiteboard
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
