"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import {
  Sparkles,
  Loader2,
  X,
  Send,
  Building2,
  Users,
  Wrench,
  GitBranch,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { useWhiteboard } from "@/contexts/WhiteboardContext";
import { MiniCanvasPreview } from "./MiniCanvasPreview";
import { buildRootNodeFromTemplate, buildWhiteboardFromTemplate } from "@/lib/orgTemplate";
import type { OrgTemplate } from "@/types/orgTemplate";

interface OrgBuilderWizardProps {
  onClose: () => void;
}

interface Message {
  role: "assistant" | "user";
  content: string;
  previewTemplate?: OrgTemplate | null;
}

interface OrgDataSummary {
  name: string;
  description: string;
  departments: string[];
  teams: string[];
  roles: string[];
  tools: string[];
  workflows: string[];
}

interface ConversationResponse {
  guidance: string;
  previewData: OrgTemplate | null;
}

const STEPS = [
  { id: "intro", label: "Getting Started", icon: Building2 },
  { id: "departments", label: "Departments", icon: Building2 },
  { id: "teams", label: "Teams", icon: Users },
  { id: "roles", label: "Roles & People", icon: Users },
  { id: "tools", label: "Tools", icon: Wrench },
  { id: "workflows", label: "Workflows", icon: GitBranch },
  { id: "review", label: "Review & Generate", icon: CheckCircle2 },
] as const;

const emptySummary: OrgDataSummary = {
  name: "",
  description: "",
  departments: [],
  teams: [],
  roles: [],
  tools: [],
  workflows: [],
};

function renderMarkdown(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function summarizeTemplate(template: OrgTemplate): OrgDataSummary {
  const departments = template.departments ?? [];
  const teams = departments.flatMap((department) => department.teams ?? []);
  const workflows = [
    ...(template.workflows ?? []),
    ...departments.flatMap((department) => department.workflows ?? []),
    ...teams.flatMap((team) => team.workflows ?? []),
  ];

  return {
    name: template.name,
    description: template.description ?? "",
    departments: unique(departments.map((department) => department.name)),
    teams: unique(teams.map((team) => team.name)),
    roles: unique(
      teams.flatMap((team) => [
        ...(team.teamLead ? [team.teamLead] : []),
        ...(team.teamMembers ?? []),
      ])
    ),
    tools: unique(teams.flatMap((team) => team.tools ?? [])),
    workflows: unique(workflows.map((workflow) => workflow.name)),
  };
}

function mergeSummary(base: OrgDataSummary, next: OrgDataSummary): OrgDataSummary {
  return {
    name: next.name || base.name,
    description: next.description || base.description,
    departments: unique([...base.departments, ...next.departments]),
    teams: unique([...base.teams, ...next.teams]),
    roles: unique([...base.roles, ...next.roles]),
    tools: unique([...base.tools, ...next.tools]),
    workflows: unique([...base.workflows, ...next.workflows]),
  };
}

function identifyGaps(summary: OrgDataSummary, step: number): string[] {
  const gaps: string[] = [];

  if (step >= 1 && summary.departments.length === 0) gaps.push("No departments defined yet");
  if (step >= 2 && summary.teams.length === 0) gaps.push("No teams defined yet");
  if (step >= 3 && summary.roles.length === 0) gaps.push("No roles/people defined yet");
  if (step >= 4 && summary.tools.length === 0) gaps.push("No tools defined yet");
  if (step >= 5 && summary.workflows.length === 0) gaps.push("No workflows defined yet");

  return gaps;
}

export function OrgBuilderWizard({ onClose }: OrgBuilderWizardProps) {
  const { setCurrentWhiteboard } = useWhiteboard();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Welcome to the Org Builder. I will help you create a complete organisational structure.

Let's start with the basics:

**What is the name of your organisation?**

And briefly, what does your organisation do?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [orgSummary, setOrgSummary] = useState<OrgDataSummary>(emptySummary);
  const [suggestedGaps, setSuggestedGaps] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const callConversation = async (userMessage: string): Promise<ConversationResponse> => {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: userMessage,
        mode: "conversation",
        orgData: orgSummary,
        currentStep: STEPS[currentStep].id,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new Error(payload?.error ?? "Failed to get wizard response");
    }

    const data = (await response.json()) as ConversationResponse;
    return {
      guidance: data.guidance,
      previewData: data.previewData ?? null,
    };
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((previous) => [...previous, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await callConversation(userMessage);
      let nextSummary = orgSummary;

      if (response.previewData) {
        nextSummary = mergeSummary(orgSummary, summarizeTemplate(response.previewData));
        setOrgSummary(nextSummary);
      } else if (currentStep === 0 && !orgSummary.name) {
        const inferredName = userMessage.split(/[,\n]/)[0]?.trim();
        if (inferredName) {
          nextSummary = {
            ...orgSummary,
            name: inferredName,
            description: userMessage,
          };
          setOrgSummary(nextSummary);
        }
      }

      setSuggestedGaps(identifyGaps(nextSummary, currentStep));
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: response.guidance,
          previewTemplate: response.previewData,
        },
      ]);
    } catch (error) {
      console.error("Wizard error:", error);
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            "I couldn't process that just now. Please try again, or continue describing your organisation in more detail.",
          previewTemplate: null,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      const index = currentStep + 1;
      setCurrentStep(index);
      setSuggestedGaps(identifyGaps(orgSummary, index));
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      const index = currentStep - 1;
      setCurrentStep(index);
      setSuggestedGaps(identifyGaps(orgSummary, index));
    }
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setMessages((previous) => [
      ...previous,
      {
        role: "assistant",
        content: "Generating your organisational structure...",
      },
    ]);

    try {
      const prompt = `Create an organisational structure using this context:

Name: ${orgSummary.name || "My Organisation"}
Description: ${orgSummary.description || "Organisation structure planning"}
Departments: ${orgSummary.departments.join(", ") || "Not provided"}
Teams: ${orgSummary.teams.join(", ") || "Not provided"}
Roles/People: ${orgSummary.roles.join(", ") || "Not provided"}
Tools: ${orgSummary.tools.join(", ") || "Not provided"}
Workflows: ${orgSummary.workflows.join(", ") || "Not provided"}

Ensure the structure is realistic and complete.`;

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Failed to generate organisation");
      }

      const generated = (await response.json()) as OrgTemplate;
      setCurrentWhiteboard(buildWhiteboardFromTemplate(generated));
      onClose();
    } catch (error) {
      console.error("Generate error:", error);
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            "Generation failed. Please provide more concrete details (departments, teams, key workflows) and try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-4xl mx-4 h-[90vh] flex flex-col overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b flex-shrink-0 bg-white">
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <Sparkles className="w-5 h-5 text-violet-600" />
            <span className="text-slate-900 font-semibold">Org Builder Wizard</span>
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4 text-slate-600" />
          </Button>
        </CardHeader>

        <div className="border-b px-4 py-2 flex-shrink-0 bg-slate-50">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isComplete = index < currentStep;

              return (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => setCurrentStep(index)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                      isActive
                        ? "bg-violet-100 text-violet-700 font-medium"
                        : isComplete
                          ? "text-emerald-600"
                          : "text-slate-400"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{step.label}</span>
                  </button>
                  {index < STEPS.length - 1 && (
                    <ArrowRight className="w-3 h-3 mx-1 text-slate-300" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {suggestedGaps.length > 0 && (
          <div className="px-4 py-2 bg-amber-50 border-b flex-shrink-0">
            <div className="flex items-center gap-2 text-xs text-amber-700">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Suggested areas to define: {suggestedGaps.join(", ")}</span>
            </div>
          </div>
        )}

        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} flex-col ${
                message.role === "assistant" ? "items-start" : "items-end"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === "user"
                    ? "bg-violet-600 text-white"
                    : "bg-white border border-slate-200 text-slate-900"
                }`}
              >
                <div className="text-sm">
                  {message.role === "assistant"
                    ? renderMarkdown(message.content)
                    : message.content}
                </div>
              </div>

              {message.role === "assistant" && message.previewTemplate && (
                <div className="mt-2 w-full">
                  <MiniCanvasPreview
                    rootNode={buildRootNodeFromTemplate(message.previewTemplate)}
                    onConfirm={() => {
                      if (currentStep < STEPS.length - 1) nextStep();
                    }}
                    onCancel={() => undefined}
                  />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 rounded-lg px-4 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        <div className="border-t p-4 flex-shrink-0 bg-white">
          <div className="flex gap-2">
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && !event.shiftKey && handleSend()}
                placeholder="Describe your organisation..."
                className="flex-1 px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-400"
                disabled={isLoading}
              />
              <Button onClick={handleSend} disabled={isLoading || !input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex gap-1">
              {currentStep > 0 && (
                <Button variant="outline" onClick={prevStep} disabled={isLoading}>
                  Back
                </Button>
              )}
              {currentStep < STEPS.length - 1 ? (
                <Button onClick={nextStep} disabled={isLoading}>
                  Next Step
                </Button>
              ) : (
                <Button
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Generate Org Chart
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
