"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Loader2, X, Send, Building2, Users, Wrench, GitBranch, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { useWhiteboard } from "@/contexts/WhiteboardContext";
import { MiniCanvasPreview } from "./MiniCanvasPreview";
import type { WhiteboardNode } from "@/types";

interface OrgBuilderWizardProps {
  onClose: () => void;
}

interface Message {
  role: 'assistant' | 'user';
  content: string;
  previewNode?: WhiteboardNode | null;
}

interface OrgData {
  name: string;
  description: string;
  departments: any[];
  teams: any[];
  roles: any[];
  tools: any[];
  workflows: any[];
  gaps: string[];
}

interface ConversationResponse {
  guidance: string;
  previewData: any;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function buildNode(type: string, name: string, description?: string, extra?: Partial<WhiteboardNode>): WhiteboardNode {
  return {
    id: generateId(),
    type: type as any,
    name,
    description: description || '',
    children: extra?.children || [],
    position: { x: 0, y: 0 },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...extra,
  };
}

// Convert API response to WhiteboardNode
function buildFromTemplate(template: any): WhiteboardNode {
  const departments = template.departments?.map((dept: any) => {
    const teams = dept.teams?.map((team: any) => {
      const children: WhiteboardNode[] = [];
      
      if (team.teamLead) {
        children.push(buildNode('teamLead', team.teamLead));
      }
      
      if (team.teamMembers) {
        team.teamMembers.forEach((member: string) => {
          children.push(buildNode('teamMember', member));
        });
      }
      
      if (team.tools) {
        team.tools.forEach((tool: string) => {
          children.push(buildNode('tool', tool));
        });
      }
      
      if (team.workflows) {
        team.workflows.forEach((wf: any) => {
          const processes = wf.processes?.map((proc: any) => {
            const agents = proc.agents?.map((agent: any) => {
              const automations = agent.automations?.map((auto: string) => 
                buildNode('automation', auto)
              ) || [];
              return buildNode('agent', agent.name, agent.description, { children: automations });
            }) || [];
            return buildNode('process', proc.name, proc.description, { children: agents });
          }) || [];
          children.push(buildNode('workflow', wf.name, wf.description, { 
            workflowType: wf.type,
            children: processes 
          }));
        });
      }
      
      return buildNode('team', team.name, team.description, { children });
    }) || [];
    
    return buildNode('department', dept.name, dept.description, { 
      departmentHead: dept.head,
      children: teams 
    });
  }) || [];
  
  return buildNode('organisation', template.name, template.description, { children: departments });
}

const STEPS = [
  { id: 'intro', label: 'Getting Started', icon: Building2 },
  { id: 'departments', label: 'Departments', icon: Building2 },
  { id: 'teams', label: 'Teams', icon: Users },
  { id: 'roles', label: 'Roles & People', icon: Users },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'workflows', label: 'Workflows', icon: GitBranch },
  { id: 'review', label: 'Review & Generate', icon: CheckCircle2 },
];

export function OrgBuilderWizard({ onClose }: OrgBuilderWizardProps) {
  const { setCurrentWhiteboard } = useWhiteboard();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Welcome to the Org Builder! I'll help you create a comprehensive organisational structure.

Let's start with the basics:

**What is the name of your organisation?**

And briefly, what does your organisation do? This helps me understand the type of structure that would work best.`
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [orgData, setOrgData] = useState<OrgData>({
    name: '',
    description: '',
    departments: [],
    teams: [],
    roles: [],
    tools: [],
    workflows: [],
    gaps: [],
  });
  const [suggestedGaps, setSuggestedGaps] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const callAI = async (userMessage: string): Promise<ConversationResponse> => {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt: userMessage,
        mode: 'conversation',
        orgData: orgData,
        currentStep: STEPS[currentStep].id,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to get response');
    }

    const data = await response.json();
    return {
      guidance: data.guidance || "Thanks for sharing! Let me ask a follow-up question.",
      previewData: data.previewData || null,
    };
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Update org data based on current step and input
      const updatedOrgData = { ...orgData };
      
      if (currentStep === 0 && !orgData.name) {
        // Extract org name from first message
        updatedOrgData.name = userMessage.split(/[,\n]/)[0].trim();
        updatedOrgData.description = userMessage;
      }

      // Call AI for conversational response
      const aiPrompt = `You are an expert organisational designer helping build an org structure step by step.
      
Current step: ${STEPS[currentStep].label}
Current org data: ${JSON.stringify(updatedOrgData, null, 2)}
User's latest input: ${userMessage}

You are guiding the user through defining their organisation. Be conversational, helpful, and specific.
Ask follow-up questions to gather detailed information.

${currentStep === 0 ? `After getting the org name and description, ask about their DEPARTMENTS. Ask: "What departments do you currently have? List them out, or describe the main areas of your business."` : ''}
${currentStep === 1 ? `You're gathering DEPARTMENT information. Ask about each department's purpose, who leads it, and what teams are within it. If they mention departments, acknowledge them and ask about teams within each.` : ''}
${currentStep === 2 ? `You're gathering TEAM information. For each team, ask about: team lead, team members, and what tools they use.` : ''}
${currentStep === 3 ? `You're gathering ROLE & PEOPLE information. Ask about specific roles, who fills them, and their responsibilities.` : ''}
${currentStep === 4 ? `You're gathering TOOL information. Ask about tools each team/role uses. Suggest common tools if they're unsure.` : ''}
${currentStep === 5 ? `You're gathering WORKFLOW information. Ask about processes - which are automated (linear) vs AI-driven (agentic).` : ''}
${currentStep === 6 ? `You're in the REVIEW phase. Summarize what they've told you and ask if they want to generate the org chart now, or if they want to add/modify anything.` : ''}

Keep responses concise (2-4 sentences) and conversational. Ask one question at a time.`;

      const aiResponse = await callAI(aiPrompt);
      
      // Build preview node from previewData if available
      let previewNode: WhiteboardNode | null = null;
      if (aiResponse.previewData) {
        previewNode = buildFromTemplate(aiResponse.previewData);
      }
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: aiResponse.guidance,
        previewNode 
      }]);
      setOrgData(updatedOrgData);

      // Auto-advance steps based on conversation progress
      if (currentStep < STEPS.length - 1) {
        // Simple auto-advance logic - could be enhanced
        const stepKeywords: Record<string, string[]> = {
          departments: ['department', 'departments', 'division', 'divisions'],
          teams: ['team', 'teams', 'group', 'groups'],
          roles: ['role', 'roles', 'person', 'people', 'member', 'lead'],
          tools: ['tool', 'tools', 'software', 'platform', 'system'],
          workflows: ['workflow', 'process', 'automation', 'agentic', 'linear'],
        };

        const currentStepId = STEPS[currentStep].id;
        const keywords = stepKeywords[currentStepId] || [];
        const hasKeywords = keywords.some(kw => 
          userMessage.toLowerCase().includes(kw) || aiResponse.guidance.toLowerCase().includes(kw)
        );

        if (hasKeywords || userMessage.length > 100) {
          // Collect suggested gaps
          const gaps = identifyGaps(updatedOrgData, currentStep);
          setSuggestedGaps(gaps);
        }
      }

    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "I'm having trouble connecting right now. Could you try again? In the meantime, you can continue describing your organisation.",
        previewNode: null 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const identifyGaps = (data: OrgData, step: number): string[] => {
    const gaps: string[] = [];
    
    if (step >= 1 && data.departments.length === 0) {
      gaps.push("No departments defined yet");
    }
    if (step >= 2 && data.teams.length === 0) {
      gaps.push("No teams defined yet");
    }
    if (step >= 3 && data.roles.length === 0) {
      gaps.push("No roles/people defined yet");
    }
    if (step >= 4 && data.tools.length === 0) {
      gaps.push("No tools defined yet");
    }
    if (step >= 5 && data.workflows.length === 0) {
      gaps.push("No workflows defined yet");
    }

    return gaps;
  };

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
      const stepQuestions: Record<string, string> = {
        departments: "Now let's define your **departments**. What are the main departments or divisions in your organisation? For example: Engineering, Sales, Marketing, Operations, etc.",
        teams: "Great! Now let's map out your **teams**. Within each department, what teams exist? For example, Engineering might have Frontend, Backend, DevOps teams.",
        roles: "Excellent! Now let's identify **roles and people**. Who are the key people in each team? What are their roles? Team leads, specialists, etc.",
        tools: "Perfect! Now let's document the **tools** each team uses. What software, platforms, or tools does each team rely on? For example: Jira, Slack, GitHub, Salesforce, etc.",
        workflows: "Almost there! Let's map out your **workflows and processes**. What are the key processes in your organisation? Which ones are automated (linear) vs AI-driven (agentic)?",
        review: "Let's **review** everything we've gathered. I'll now compile this into a comprehensive organisational structure. Ready to generate your org chart?",
      };
      
      const stepId = STEPS[currentStep + 1].id;
      if (stepQuestions[stepId]) {
        setMessages(prev => [...prev, { role: 'assistant', content: stepQuestions[stepId], previewNode: null }]);
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setMessages(prev => [...prev, { 
      role: 'assistant', 
      content: "Generating your organisational structure..." 
    }]);

    try {
      // Build comprehensive prompt from collected data
      const buildPrompt = `Create an organisational structure with the following details:
      
Name: ${orgData.name || 'My Organisation'}
Description: ${orgData.description}

${orgData.departments.length > 0 ? `Departments: ${orgData.departments.join(', ')}` : ''}
${orgData.teams.length > 0 ? `Teams: ${orgData.teams.join(', ')}` : ''}
${orgData.roles.length > 0 ? `Roles: ${orgData.roles.join(', ')}` : ''}
${orgData.tools.length > 0 ? `Tools: ${orgData.tools.join(', ')}` : ''}
${orgData.workflows.length > 0 ? `Workflows: ${orgData.workflows.join(', ')}` : ''}

Generate a complete organisational structure based on this information.`;

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: buildPrompt }),
      });

      if (!response.ok) throw new Error('Failed to generate');

      const generated = await response.json();
      
      const whiteboard = {
        id: generateId(),
        name: generated.name || orgData.name || 'My Organisation',
        description: generated.description || orgData.description,
        rootNode: buildFromTemplate(generated),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: "user",
      };

      setCurrentWhiteboard(whiteboard);
      onClose();
    } catch (error) {
      console.error('Error generating:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "I had trouble generating the structure. Let's try again - can you provide a bit more detail about your organisation?" 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-4xl mx-4 h-[90vh] flex flex-col overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b flex-shrink-0">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-500" />
            Org Builder Wizard
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>

        {/* Progress Steps */}
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
                      isActive ? 'bg-violet-100 text-violet-700 font-medium' :
                      isComplete ? 'text-emerald-600' : 'text-slate-400'
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

        {/* Suggested Gaps */}
        {suggestedGaps.length > 0 && (
          <div className="px-4 py-2 bg-amber-50 border-b flex-shrink-0">
            <div className="flex items-center gap-2 text-xs text-amber-700">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Suggested areas to define: {suggestedGaps.join(', ')}</span>
            </div>
          </div>
        )}

        {/* Chat Messages */}
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} flex-col ${msg.role === 'assistant' ? 'items-start' : 'items-end'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  msg.role === 'user'
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-100 text-slate-800'
                }`}
              >
                <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
              </div>
              
              {/* Preview embedded in chat */}
              {msg.role === 'assistant' && msg.previewNode && (
                <div className="mt-2 w-full max-w-md">
                  <MiniCanvasPreview 
                    rootNode={msg.previewNode}
                    onConfirm={() => {
                      // User confirmed the preview, move to next step
                      if (currentStep < STEPS.length - 1) {
                        nextStep();
                      }
                    }}
                    onCancel={() => {
                      // User wants to make changes, stay on current step
                    }}
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

        {/* Input Area */}
        <div className="border-t p-4 flex-shrink-0 bg-white">
          <div className="flex gap-2">
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
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