"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useWhiteboard } from "@/contexts/WhiteboardContext";
import type { WhiteboardNode } from "@/types";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `You are an AI assistant helping users modify their organizational whiteboard structure. You can:
1. Add new nodes (departments, teams, roles, tools, workflows)
2. Remove nodes by name
3. Update node names or descriptions
4. Add team members to teams
5. Add tools to teams/roles
6. Create workflows

When the user asks to make changes, respond with a JSON action in this format:
{"action": "add" | "remove" | "update", "target": "node name to target", "data": {...}}

For add actions, data should include: {type, name, description?}
For remove actions, just target is needed
For update actions, data should include the fields to update

If the user is just asking a question, respond normally without JSON.
Always be helpful and explain what you're doing.

Current organization context will be provided with each message.`;

export function ChatWidget() {
  const { currentWhiteboard, setCurrentWhiteboard, selectedNode } = useWhiteboard();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hi! I can help you modify your organization structure. Try saying things like 'Add a Marketing department' or 'Add John to the Engineering team'." }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const findNode = (node: WhiteboardNode, name: string): WhiteboardNode | null => {
    if (node.name.toLowerCase() === name.toLowerCase()) return node;
    for (const child of node.children) {
      const found = findNode(child, name);
      if (found) return found;
    }
    return null;
  };

  const findParentNode = (node: WhiteboardNode, targetId: string, parent: WhiteboardNode | null = null): WhiteboardNode | null => {
    if (node.id === targetId) return parent;
    for (const child of node.children) {
      const found = findParentNode(child, targetId, node);
      if (found !== undefined) return found;
    }
    return null;
  };

  const generateId = () => Math.random().toString(36).substring(2, 15);

  const cloneNode = (node: WhiteboardNode): WhiteboardNode => ({
    ...node,
    children: node.children.map(cloneNode),
    updatedAt: new Date(),
  });

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Get organization context
      const orgContext = currentWhiteboard ? 
        `Current organization: ${currentWhiteboard.name}. Root node: ${currentWhiteboard.rootNode.name} with ${currentWhiteboard.rootNode.children.length} departments.` :
        'No organization loaded.';

      const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;

      if (apiKey) {
        // Call OpenAI API
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: `${orgContext}\n\nUser request: ${userMessage}` }
            ],
            temperature: 0.7,
            max_tokens: 1000,
          }),
        });

        const data = await response.json();
        const assistantMessage = data.choices[0]?.message?.content || "I couldn't process that request.";
        
        // Try to parse and execute action
        const jsonMatch = assistantMessage.match(/\{[\s\S]*"action"[\s\S]*\}/);
        if (jsonMatch && currentWhiteboard) {
          try {
            const actionData = JSON.parse(jsonMatch[0]);
            executeAction(actionData);
          } catch {
            // Not a valid action, just show the message
          }
        }

        setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
      } else {
        // Fallback: Parse user intent locally
        const response = parseAndExecuteLocal(userMessage);
        setMessages(prev => [...prev, { role: 'assistant', content: response }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const parseAndExecuteLocal = (message: string): string => {
    if (!currentWhiteboard) {
      return "Please create or load an organization first.";
    }

    const lowerMessage = message.toLowerCase();

    // Add department
    if (lowerMessage.includes('add') && lowerMessage.includes('department')) {
      const nameMatch = message.match(/department\s+(?:called\s+)?["']?([A-Za-z\s]+?)["']?(?:\s|$|\.)/i);
      const deptName = nameMatch ? nameMatch[1].trim() : `New Department ${currentWhiteboard.rootNode.children.length + 1}`;
      
      const newDept: WhiteboardNode = {
        id: generateId(),
        type: 'department',
        name: deptName,
        description: '',
        children: [],
        position: { x: 0, y: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedRoot = cloneNode(currentWhiteboard.rootNode);
      updatedRoot.children.push(newDept);

      setCurrentWhiteboard({
        ...currentWhiteboard,
        rootNode: updatedRoot,
        updatedAt: new Date(),
      });

      return `I've added the "${deptName}" department to your organization. You can click on it to drill down and add teams.`;
    }

    // Add team
    if (lowerMessage.includes('add') && lowerMessage.includes('team')) {
      const targetDept = selectedNode?.type === 'department' ? selectedNode : 
        currentWhiteboard.rootNode.children.find(d => lowerMessage.includes(d.name.toLowerCase()));
      
      if (!targetDept) {
        return "Please select a department first, or specify which department to add the team to.";
      }

      const nameMatch = message.match(/team\s+(?:called\s+)?["']?([A-Za-z\s]+?)["']?(?:\s|$|\.)/i);
      const teamName = nameMatch ? nameMatch[1].trim() : `New Team ${targetDept.children.length + 1}`;

      const newTeam: WhiteboardNode = {
        id: generateId(),
        type: 'team',
        name: teamName,
        description: '',
        children: [],
        position: { x: 0, y: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedRoot = cloneNode(currentWhiteboard.rootNode);
      const dept = findNode(updatedRoot, targetDept.name);
      if (dept) dept.children.push(newTeam);

      setCurrentWhiteboard({
        ...currentWhiteboard,
        rootNode: updatedRoot,
        updatedAt: new Date(),
      });

      return `I've added the "${teamName}" team to ${targetDept.name}. Click on the team to add members and tools.`;
    }

    // Add tool
    if (lowerMessage.includes('add') && lowerMessage.includes('tool')) {
      const targetTeam = selectedNode?.type === 'team' ? selectedNode : null;
      
      if (!targetTeam) {
        return "Please select a team first to add a tool.";
      }

      const nameMatch = message.match(/tool\s+(?:called\s+)?["']?([A-Za-z\s]+?)["']?(?:\s|$|\.)/i);
      const toolName = nameMatch ? nameMatch[1].trim() : 'New Tool';

      const newTool: WhiteboardNode = {
        id: generateId(),
        type: 'tool',
        name: toolName,
        children: [],
        position: { x: 0, y: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedRoot = cloneNode(currentWhiteboard.rootNode);
      const team = findNode(updatedRoot, targetTeam.name);
      if (team) team.children.push(newTool);

      setCurrentWhiteboard({
        ...currentWhiteboard,
        rootNode: updatedRoot,
        updatedAt: new Date(),
      });

      return `I've added "${toolName}" as a tool for ${targetTeam.name}.`;
    }

    // Add member
    if (lowerMessage.includes('add') && (lowerMessage.includes('member') || lowerMessage.includes('person'))) {
      const targetTeam = selectedNode?.type === 'team' ? selectedNode : null;
      
      if (!targetTeam) {
        return "Please select a team first to add a member.";
      }

      const nameMatch = message.match(/(?:member|person)\s+(?:called\s+)?["']?([A-Za-z\s]+?)["']?(?:\s|$|\.)/i);
      const memberName = nameMatch ? nameMatch[1].trim() : 'New Member';

      const newMember: WhiteboardNode = {
        id: generateId(),
        type: 'teamMember',
        name: memberName,
        children: [],
        position: { x: 0, y: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedRoot = cloneNode(currentWhiteboard.rootNode);
      const team = findNode(updatedRoot, targetTeam.name);
      if (team) team.children.push(newMember);

      setCurrentWhiteboard({
        ...currentWhiteboard,
        rootNode: updatedRoot,
        updatedAt: new Date(),
      });

      return `I've added "${memberName}" as a team member to ${targetTeam.name}.`;
    }

    // Help
    if (lowerMessage.includes('help')) {
      return `I can help you with:
• "Add a department called Marketing"
• "Add a team called Frontend" (select a department first)
• "Add a tool called Figma" (select a team first)
• "Add a member called John" (select a team first)
• "Remove [name]"
• Click on nodes to select them before making changes`;
    }

    return "I'm not sure what you want to do. Try 'help' to see what I can do, or be more specific like 'Add a department called Marketing'.";
  };

  const executeAction = (actionData: { action: string; target?: string; data?: any }) => {
    if (!currentWhiteboard) return;

    const updatedRoot = cloneNode(currentWhiteboard.rootNode);

    switch (actionData.action) {
      case 'add':
        if (actionData.target) {
          const targetNode = findNode(updatedRoot, actionData.target);
          if (targetNode && actionData.data) {
            const newNode: WhiteboardNode = {
              id: generateId(),
              type: actionData.data.type || 'department',
              name: actionData.data.name || 'New Node',
              description: actionData.data.description || '',
              children: [],
              position: { x: 0, y: 0 },
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            targetNode.children.push(newNode);
          }
        }
        break;
      case 'remove':
        if (actionData.target) {
          const nodeToRemove = findNode(updatedRoot, actionData.target);
          if (nodeToRemove) {
            const parent = findParentNode(updatedRoot, nodeToRemove.id);
            if (parent) {
              parent.children = parent.children.filter(c => c.id !== nodeToRemove.id);
            }
          }
        }
        break;
      case 'update':
        if (actionData.target && actionData.data) {
          const nodeToUpdate = findNode(updatedRoot, actionData.target);
          if (nodeToUpdate) {
            Object.assign(nodeToUpdate, actionData.data);
          }
        }
        break;
    }

    setCurrentWhiteboard({
      ...currentWhiteboard,
      rootNode: updatedRoot,
      updatedAt: new Date(),
    });
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-full shadow-lg transition-all hover:scale-105"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="text-sm font-medium">Chat</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 h-[500px] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-violet-600 text-white">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          <span className="font-semibold">AI Assistant</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="text-white hover:bg-violet-700">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
              msg.role === 'user' 
                ? 'bg-violet-600 text-white rounded-br-none' 
                : 'bg-slate-100 text-slate-800 rounded-bl-none'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 px-3 py-2 rounded-lg rounded-bl-none">
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-slate-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
            disabled={isLoading}
          />
          <Button onClick={handleSend} disabled={isLoading || !input.trim()} className="bg-violet-600 hover:bg-violet-700">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}