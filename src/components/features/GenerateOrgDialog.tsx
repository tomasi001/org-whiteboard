"use client";

import { useState } from "react";
import { Sparkles, Loader2, FileText, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/Card";
import { generateOrganization } from "@/lib/generateOrg";
import { useWhiteboard } from "@/contexts/WhiteboardContext";
import type { WhiteboardNode } from "@/types";

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
      const generated = await generateOrganization(prompt);
      
      // Convert GeneratedNode to WhiteboardNode format
      const convertNode = (node: any): WhiteboardNode => ({
        id: node.id,
        type: node.type,
        name: node.name,
        description: node.description,
        departmentHead: node.departmentHead,
        workflowType: node.workflowType,
        children: node.children.map(convertNode),
        position: { x: 0, y: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const whiteboard = {
        id: Math.random().toString(36).substring(2, 15),
        name: generated.name,
        description: generated.description,
        rootNode: convertNode(generated.rootNode),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: "user",
      };

      setCurrentWhiteboard(whiteboard);
      onClose();
    } catch (err) {
      setError("Failed to generate organization. Please try again.");
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
            Generate Organization
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Describe your organization and we'll generate a complete hierarchical structure with departments, teams, roles, tools, workflows, and automations.
          </p>

          <div>
            <label className="text-sm font-medium text-slate-700">Organization Description</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your organization (e.g., 'A tech startup with 50 employees focused on AI products...')"
              className="w-full mt-1 h-32 px-3 py-2 rounded-md border border-slate-300 bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-400"
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
                  className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600 transition-colors"
                  disabled={isLoading}
                >
                  {example.substring(0, 40)}...
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 pt-4 border-t border-slate-200">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <FileText className="w-4 h-4" />
              <span>JSON import coming soon</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Upload className="w-4 h-4" />
              <span>Document upload coming soon</span>
            </div>
          </div>
        </CardContent>

        <CardFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={isLoading || !prompt.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Organization
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}