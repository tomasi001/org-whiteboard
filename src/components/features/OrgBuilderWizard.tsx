"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import {
  Sparkles,
  Loader2,
  X,
  Send,
  CheckCircle2,
  AlertCircle,
  FileUp,
  Braces,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { useWhiteboard } from "@/contexts/WhiteboardContext";
import { MiniCanvasPreview } from "./MiniCanvasPreview";
import { buildRootNodeFromTemplate, buildWhiteboardFromTemplate } from "@/lib/orgTemplate";
import {
  emptyIntakeState,
  intakeStateToTemplate,
  isReadyToGenerate,
  summarizeTemplate,
} from "@/lib/orgIntake";
import type { OrgDataSummary, OrgIntakeState } from "@/lib/orgIntake";
import type { OrgTemplate } from "@/types/orgTemplate";
import { JsonNormalizationError, normalizeJsonInput } from "@/lib/jsonNormalization";

interface OrgBuilderWizardProps {
  onClose: () => void;
}

interface Message {
  role: "assistant" | "user";
  content: string;
  previewTemplate?: OrgTemplate | null;
}

interface UploadedDocument {
  name: string;
  parser: string;
  truncated: boolean;
}

interface ParseFileResponse {
  fileName: string;
  fileType: string;
  parser: string;
  extractedText: string;
  truncated: boolean;
}

interface ConversationResponse {
  guidance: string;
  state: OrgIntakeState;
  previewData: OrgTemplate | null;
  missingFields: string[];
  suggestions?: string[];
  readyToGenerate?: boolean;
}

const INITIAL_ASSISTANT_MESSAGE = `Welcome to the Org Builder.

Drop in anything you have and we'll shape it together.

You can:
- describe your business in your own words
- paste a full org JSON
- upload docs (PDF, DOCX, TXT, Markdown, CSV, JSON)

Start with a brain dump and I’ll turn it into a clean org map.`;

const STARTER_PROMPTS = [
  "Here is my full company overview. Build a practical org structure from it.",
  "Suggest a strong department setup for a service business with delivery + sales.",
  "I want a lean starter org. Keep it small but scalable.",
];

const FILE_ACCEPT =
  ".pdf,.docx,.txt,.md,.markdown,.csv,.json,.yaml,.yml,.xml,.html,.rtf,.log";

function renderMarkdown(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-roundo lowercase text-cardzzz-cream">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function asHistory(messages: Message[]): Array<{ role: "assistant" | "user"; content: string }> {
  return messages
    .slice(-12)
    .map((message) => ({ role: message.role, content: message.content }))
    .filter((message) => message.content.trim().length > 0);
}

export function OrgBuilderWizard({ onClose }: OrgBuilderWizardProps) {
  const { setCurrentWhiteboard } = useWhiteboard();

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: INITIAL_ASSISTANT_MESSAGE,
    },
  ]);
  const [input, setInput] = useState("");
  const [jsonDraft, setJsonDraft] = useState("");
  const [showJsonInput, setShowJsonInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [intakeState, setIntakeState] = useState<OrgIntakeState>(emptyIntakeState);
  const [orgSummary, setOrgSummary] = useState<OrgDataSummary>(() =>
    summarizeTemplate(intakeStateToTemplate(emptyIntakeState))
  );
  const [missingFields, setMissingFields] = useState<string[]>([
    "organisation name",
    "organisation description",
    "at least one department or agent layer",
  ]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [readyToGenerate, setReadyToGenerate] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);

  const messagesRef = useRef<Message[]>(messages);
  const intakeStateRef = useRef<OrgIntakeState>(intakeState);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesRef.current = messages;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    intakeStateRef.current = intakeState;
  }, [intakeState]);

  const callConversation = async (
    userPrompt: string,
    source: "message" | "json" | "document",
    structuredJson?: string
  ): Promise<ConversationResponse> => {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: userPrompt,
        mode: "conversation",
        state: intakeStateRef.current,
        source,
        conversationHistory: asHistory(messagesRef.current),
        structuredJson,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new Error(payload?.error ?? "Failed to get wizard response");
    }

    return (await response.json()) as ConversationResponse;
  };

  const applyConversationResult = (response: ConversationResponse): OrgTemplate | null => {
    const preview = response.previewData ?? intakeStateToTemplate(response.state);

    setIntakeState(response.state);
    setOrgSummary(summarizeTemplate(preview));
    setMissingFields(response.missingFields ?? []);
    setSuggestions(response.suggestions ?? []);
    setReadyToGenerate(response.readyToGenerate ?? isReadyToGenerate(response.state));

    return preview;
  };

  const runConversationTurn = async (
    userVisibleMessage: string,
    modelPrompt: string,
    source: "message" | "json" | "document",
    structuredJson?: string
  ) => {
    setMessages((previous) => [...previous, { role: "user", content: userVisibleMessage }]);
    setIsLoading(true);

    try {
      const response = await callConversation(modelPrompt, source, structuredJson);
      const preview = applyConversationResult(response);

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: response.guidance,
          previewTemplate: preview,
        },
      ]);
    } catch (error) {
      console.error("Wizard error:", error);
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            "I hit a processing issue on that message. Please send it again or upload a doc and I’ll keep going.",
          previewTemplate: null,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || isUploading) return;

    const userMessage = input.trim();
    setInput("");
    await runConversationTurn(userMessage, userMessage, "message");
  };

  const handleJsonImport = async () => {
    if (!jsonDraft.trim() || isLoading || isUploading) return;

    try {
      const { normalized } = normalizeJsonInput(jsonDraft);
      await runConversationTurn(
        "Pasted structured org JSON.",
        `Use this structured JSON as baseline context and map it into the best org structure you can. The format may differ from your native template, so infer fields intelligently and continue with only unanswered essentials.\n\n${normalized}`,
        "json",
        normalized
      );

      setShowJsonInput(false);
      setJsonDraft("");
    } catch (error) {
      const message =
        error instanceof JsonNormalizationError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Invalid JSON payload.";
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: `That JSON could not be parsed. Please check the syntax and try again. (${message})`,
        },
      ]);
    }
  };

  const parseUploadedFile = async (file: File): Promise<ParseFileResponse> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/intake/parse", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new Error(payload?.error ?? `Failed to parse ${file.name}`);
    }

    return (await response.json()) as ParseFileResponse;
  };

  const handleDocumentUpload: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const files = Array.from(event.target.files ?? []);
    event.currentTarget.value = "";

    if (files.length === 0 || isLoading || isUploading) return;

    setIsUploading(true);

    try {
      for (const file of files) {
        try {
          const parsed = await parseUploadedFile(file);
          setUploadedDocuments((previous) => [
            ...previous,
            {
              name: parsed.fileName,
              parser: parsed.parser,
              truncated: parsed.truncated,
            },
          ]);

          const modelPrompt = `Ingest this company document and update the current org draft.
Document name: ${parsed.fileName}
Document type: ${parsed.fileType || "unknown"}

Extracted text:
${parsed.extractedText}`;

          await runConversationTurn(
            `Uploaded file: ${parsed.fileName}`,
            modelPrompt,
            "document"
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown upload error.";
          setMessages((previous) => [
            ...previous,
            {
              role: "assistant",
              content: `Document upload failed for ${file.name}: ${message}`,
            },
          ]);
        }
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerate = async () => {
    if (isLoading || isUploading) return;

    setIsLoading(true);
    setMessages((previous) => [
      ...previous,
      {
        role: "assistant",
        content: "Building your org structure now...",
      },
    ]);

    try {
      const prompt = `Generate a complete organisation structure from this intake data.

${JSON.stringify(intakeStateRef.current, null, 2)}

Preserve confirmed details and fill practical gaps.`;

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          mode: "generate",
          state: intakeStateRef.current,
        }),
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
            "Couldn’t generate that yet. Add a bit more detail and run it again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const busy = isLoading || isUploading;

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
                readyToGenerate
                  ? "border-green-300/40 bg-green-400/20 text-cardzzz-cream"
                  : "border-white/25 bg-black/20 text-cardzzz-cream/85"
              }`}
            >
              {readyToGenerate ? "Ready" : "Shaping your map"}
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
              {`${orgSummary.departments.length} departments, ${orgSummary.teams.length} teams, ${orgSummary.roles.length} people, ${orgSummary.workflows.length} agent flows`}
            </div>
            <div>
              <span className="text-cardzzz-cream">Company:</span>{" "}
              {orgSummary.name || "Not named yet"}
            </div>
          </div>
        </div>

        {(missingFields.length > 0 || suggestions.length > 0) && (
          <div className="px-4 py-2 border-b border-white/20 bg-cardzzz-accent/30 text-xs font-satoshi text-cardzzz-cream space-y-1">
            {missingFields.length > 0 && (
              <div className="flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5" />
                <span>Still need: {missingFields.join(", ")}</span>
              </div>
            )}
            {suggestions.length > 0 && (
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5" />
                <span>Good upgrades: {suggestions.join(" | ")}</span>
              </div>
            )}
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
                className={`max-w-[88%] rounded-lg px-4 py-2 ${
                  message.role === "user"
                    ? "bg-cardzzz-cream text-cardzzz-accent border border-cardzzz-cream/50"
                    : "bg-white/10 backdrop-blur-md border border-white/20 text-cardzzz-cream"
                }`}
              >
                <div className="text-sm font-satoshi whitespace-pre-wrap">
                  {message.role === "assistant"
                    ? renderMarkdown(message.content)
                    : message.content}
                </div>
              </div>

              {message.role === "assistant" && message.previewTemplate && (
                <div className="mt-2 w-full">
                  <MiniCanvasPreview
                    rootNode={buildRootNodeFromTemplate(message.previewTemplate)}
                    onConfirm={() => undefined}
                    onCancel={() => undefined}
                  />
                </div>
              )}
            </div>
          ))}

          {busy && (
            <div className="flex justify-start">
              <div className="bg-white/10 border border-white/20 rounded-lg px-4 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-cardzzz-cream" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </CardContent>

        <div className="border-t border-white/20 p-4 flex-shrink-0 bg-black/20 backdrop-blur-md space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              <FileUp className="w-4 h-4 mr-2" />
              Drop Files
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowJsonInput((current) => !current)}
              disabled={busy}
            >
              <Braces className="w-4 h-4 mr-2" />
              Paste JSON
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={FILE_ACCEPT}
              multiple
              onChange={handleDocumentUpload}
              className="hidden"
            />
          </div>

          {uploadedDocuments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {uploadedDocuments.map((document, index) => (
                <span
                  key={`${document.name}-${index}`}
                  className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-1 text-xs font-satoshi text-cardzzz-cream/90"
                >
                  <FileText className="w-3 h-3" />
                  {document.name}
                  <span className="text-cardzzz-cream/65">({document.parser})</span>
                  {document.truncated && <span className="text-cardzzz-cream/65">truncated</span>}
                </span>
              ))}
            </div>
          )}

          {showJsonInput && (
            <div className="space-y-2 p-3 rounded-[16.168px] border border-white/20 bg-black/20">
              <textarea
                value={jsonDraft}
                onChange={(event) => setJsonDraft(event.target.value)}
                placeholder="Paste your org JSON here..."
                rows={8}
                className="w-full rounded-[16.168px] border border-white/20 bg-black/20 px-3 py-2 text-sm font-mono text-cardzzz-cream placeholder:text-cardzzz-cream/60 caret-cardzzz-cream focus:outline-none focus:ring-2 focus:ring-cardzzz-cream/70"
                disabled={busy}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowJsonInput(false);
                    setJsonDraft("");
                  }}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleJsonImport} disabled={busy || !jsonDraft.trim()}>
                  Use This JSON
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => setInput(prompt)}
                disabled={busy}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-satoshi text-cardzzz-cream/90 transition hover:bg-white/20 disabled:opacity-60"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Tell me about your business in plain language..."
                className="flex-1 h-[54px] px-4 py-2 rounded-[16.168px] border border-white/20 bg-black/20 backdrop-blur-md text-cardzzz-cream placeholder:text-cardzzz-cream/70 caret-cardzzz-cream font-satoshi focus:outline-none focus:ring-2 focus:ring-cardzzz-cream/70 focus:border-cardzzz-cream"
                disabled={busy}
              />
              <Button onClick={handleSend} disabled={busy || !input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <Button onClick={handleGenerate} disabled={busy || !readyToGenerate}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Generate Org Chart
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
