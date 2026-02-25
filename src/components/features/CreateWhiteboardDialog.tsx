"use client";

import { useState } from "react";
import { Plus, X, Sparkles } from "lucide-react";
import { useWhiteboard } from "@/contexts/WhiteboardContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/Card";
import { GenerateOrgDialog } from "./GenerateOrgDialog";
import { OrgBuilderWizard } from "./OrgBuilderWizard";

export function CreateWhiteboardDialog() {
  const { createWhiteboard, currentWhiteboard } = useWhiteboard();
  const [isOpen, setIsOpen] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = () => {
    if (!name.trim()) return;
    createWhiteboard(name.trim(), description.trim() || undefined);
    setName("");
    setDescription("");
    setIsOpen(false);
  };

  if (currentWhiteboard) {
    return null;
  }

  if (showGenerate) {
    return <GenerateOrgDialog onClose={() => setShowGenerate(false)} />;
  }

  if (showWizard) {
    return <OrgBuilderWizard onClose={() => setShowWizard(false)} />;
  }

  if (isOpen) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>create new whiteboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-satoshi text-cardzzz-cream">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter organisation name"
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-satoshi text-cardzzz-cream">Description (optional)</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description"
                className="mt-1"
              />
            </div>
          </CardContent>
          <CardFooter className="gap-2">
            <Button onClick={handleCreate} className="flex-1">
              Create Whiteboard
            </Button>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50">
      <div className="text-center max-w-lg">
        <h1 className="text-4xl font-roundo lowercase tracking-wide text-cardzzz-cream mb-4">
          org whiteboard
        </h1>
        <p className="text-lg text-cardzzz-cream/85 mb-8 font-satoshi">
          Build nested hierarchical structures with drill-down capabilities for departments, roles, and workflows.
        </p>
        
        <div className="grid gap-4 text-left max-w-md mx-auto mb-8">
          <div className="flex items-start gap-3 p-4 bg-white/10 backdrop-blur-md rounded-[16.168px] border border-white/20">
            <div className="p-2 bg-cardzzz-cream/20 text-cardzzz-cream rounded-[12px]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h3 className="font-roundo lowercase text-cardzzz-cream">nested structures</h3>
              <p className="text-sm text-cardzzz-cream/80 font-satoshi">Click into departments, teams, and roles for deeper insight</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-4 bg-white/10 backdrop-blur-md rounded-[16.168px] border border-white/20">
            <div className="p-2 bg-cardzzz-cream/20 text-cardzzz-cream rounded-[12px]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            </div>
            <div>
              <h3 className="font-roundo lowercase text-cardzzz-cream">workflow mapping</h3>
              <p className="text-sm text-cardzzz-cream/80 font-satoshi">Visualise both agentic and linear automation structures</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-4 bg-white/10 backdrop-blur-md rounded-[16.168px] border border-white/20">
            <div className="p-2 bg-cardzzz-cream/20 text-cardzzz-cream rounded-[12px]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-roundo lowercase text-cardzzz-cream">ai generation</h3>
              <p className="text-sm text-cardzzz-cream/80 font-satoshi">Describe your org and let AI build the structure</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={() => setIsOpen(true)}
            size="lg"
            variant="outline"
            className="px-[25px] whitespace-nowrap"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Blank
          </Button>
          <Button
            onClick={() => setShowWizard(true)}
            size="lg"
            variant="secondary"
            className="px-[25px] whitespace-nowrap"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            Guided Setup
          </Button>
          <Button
            onClick={() => setShowGenerate(true)}
            size="lg"
            className="px-[25px] whitespace-nowrap"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            Quick Generate
          </Button>
        </div>
      </div>
    </div>
  );
}
