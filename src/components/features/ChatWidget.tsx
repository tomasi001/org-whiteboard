"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useWhiteboard } from "@/contexts/WhiteboardContext";
import type { NodeType, Whiteboard, WhiteboardNode, WorkflowType } from "@/types";
import { hierarchyRules } from "@/lib/hierarchy";
import {
  addNodeToTree,
  deleteNodeFromTree,
  findNodeById,
  updateNodeInTree,
} from "@/lib/whiteboardTree";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatActionData {
  type?: NodeType;
  name?: string;
  description?: string;
  workflowType?: WorkflowType;
}

interface ChatAction {
  action: "add" | "remove" | "update" | "none";
  targetId?: string;
  targetName?: string;
  reply: string;
  data?: ChatActionData;
}

interface ChatApiResponse {
  reply: string;
  action: ChatAction | null;
}

interface WhiteboardSnapshotNode {
  id: string;
  type: NodeType;
  name: string;
  description?: string;
  children: WhiteboardSnapshotNode[];
}

function toSnapshotNode(node: WhiteboardNode): WhiteboardSnapshotNode {
  return {
    id: node.id,
    type: node.type,
    name: node.name,
    description: node.description,
    children: node.children.map(toSnapshotNode),
  };
}

export function ChatWidget() {
  const { currentWhiteboard, setCurrentWhiteboard, selectedNode } = useWhiteboard();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        'I can apply whiteboard edits. Try: "add a Marketing department", "add a Frontend team", "add tool Figma", or "remove \\"Sales\\"".',
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const applyAction = (whiteboard: Whiteboard, action: ChatAction): Whiteboard => {
    if (action.action === "none") return whiteboard;

    if (action.action === "add") {
      if (!action.targetId || !action.data?.type || !action.data.name) {
        return whiteboard;
      }

      const parent = findNodeById(whiteboard.rootNode, action.targetId);
      if (!parent) return whiteboard;

      const allowedChildren = hierarchyRules[parent.type] ?? [];
      if (!allowedChildren.includes(action.data.type)) {
        return whiteboard;
      }

      const rootNode = addNodeToTree(whiteboard.rootNode, {
        parentId: parent.id,
        type: action.data.type,
        name: action.data.name,
        description: action.data.description,
        workflowType: action.data.workflowType,
      });

      return { ...whiteboard, rootNode, updatedAt: new Date() };
    }

    if (action.action === "remove") {
      if (!action.targetId || action.targetId === whiteboard.rootNode.id) {
        return whiteboard;
      }

      const rootNode = deleteNodeFromTree(whiteboard.rootNode, action.targetId);
      return { ...whiteboard, rootNode, updatedAt: new Date() };
    }

    if (action.action === "update") {
      if (!action.targetId) return whiteboard;

      const rootNode = updateNodeInTree(whiteboard.rootNode, {
        id: action.targetId,
        name: action.data?.name,
        description: action.data?.description,
        workflowType: action.data?.workflowType,
      });

      return { ...whiteboard, rootNode, updatedAt: new Date() };
    }

    return whiteboard;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          selectedNodeId: selectedNode?.id,
          currentWhiteboard: currentWhiteboard
            ? {
                id: currentWhiteboard.id,
                name: currentWhiteboard.name,
                rootNode: toSnapshotNode(currentWhiteboard.rootNode),
              }
            : null,
        }),
      });

      const data = (await response.json()) as ChatApiResponse;
      const assistantReply =
        data.reply || "I could not process that request right now.";

      if (currentWhiteboard && data.action) {
        const updatedWhiteboard = applyAction(currentWhiteboard, data.action);
        if (updatedWhiteboard !== currentWhiteboard) {
          setCurrentWhiteboard(updatedWhiteboard);
        }
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: assistantReply },
      ]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Unable to reach the chat service. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
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
      <div className="flex items-center justify-between px-4 py-3 bg-violet-600 text-white">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          <span className="font-semibold">AI Assistant</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(false)}
          className="text-white hover:bg-violet-700"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                message.role === "user"
                  ? "bg-violet-600 text-white rounded-br-none"
                  : "bg-slate-100 text-slate-800 rounded-bl-none"
              }`}
            >
              {message.content}
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

      <div className="p-3 border-t border-slate-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleSend()}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="bg-violet-600 hover:bg-violet-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

