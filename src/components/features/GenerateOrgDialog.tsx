"use client";

import { useState } from "react";
import { Sparkles, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/Card";
import { useWhiteboard } from "@/contexts/WhiteboardContext";
import { buildWhiteboardFromTemplate } from "@/lib/orgTemplate";
import type { OrgTemplate } from "@/types/orgTemplate";

interface GenerateOrgDialogProps {
  onClose: () => void;
}

export function GenerateOrgDialog({ onClose }: GenerateOrgDialogProps) {
  const { setCurrentWhiteboard } = useWhiteboard();
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Please describe your organization");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Failed to generate organization");
      }

      const generated = (await response.json()) as OrgTemplate;
      const whiteboard = buildWhiteboardFromTemplate(generated);

      setCurrentWhiteboard(whiteboard);
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to generate organization.";
      setError(message);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const examplePrompts = [
    "A tech startup called Acme Software with engineering, sales, and marketing teams",
    "A hospital with emergency, surgery, and nursing departments",
    "A retail company with stores and e-commerce",
    "A manufacturing company with production and supply chain",
    "A financial services company with investment and risk management",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-500" />
            Generate Organization with AI
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Describe your organization in detail. The AI will think about the structure and generate a comprehensive hierarchy with departments, teams, roles, tools, workflows, and automations.
          </p>

          <div>
            <label className="text-sm font-medium text-slate-700">Organization Description</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your organization (e.g., 'A tech startup with 50 employees focused on AI products. We have an engineering team, product team, and sales team...')"
              className="w-full mt-1 h-32 px-3 py-2 rounded-md border border-slate-300 bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-400"
              disabled={isLoading}
            />
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Quick Examples</p>
            <div className="flex flex-wrap gap-2">
              {examplePrompts.map((example, i) => (
                <button
                  key={i}
                  onClick={() => setPrompt(example)}
                  className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-violet-100 hover:text-violet-700 rounded-full text-slate-600 transition-colors"
                  disabled={isLoading}
                >
                  {example.length > 50 ? example.substring(0, 50) + '...' : example}
                </button>
              ))}
            </div>
          </div>
        </CardContent>

        <CardFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={isLoading || !prompt.trim()} className="bg-violet-600 hover:bg-violet-700">
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate with AI
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
