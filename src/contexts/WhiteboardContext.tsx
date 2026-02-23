"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import type { Whiteboard, WhiteboardNode, WhiteboardState, CreateNodeInput, UpdateNodeInput } from "@/types";
import { generateId } from "@/lib/utils";

const STORAGE_KEY = "org-whiteboard-state";

interface WhiteboardContextType extends WhiteboardState {
  createWhiteboard: (name: string, description?: string) => void;
  setCurrentWhiteboard: (whiteboard: Whiteboard | null) => void;
  selectNode: (node: WhiteboardNode | null) => void;
  drillDown: (node: WhiteboardNode) => void;
  drillUp: () => void;
  navigateToBreadcrumb: (index: number) => void;
  createNode: (input: CreateNodeInput) => void;
  updateNode: (input: UpdateNodeInput) => void;
  deleteNode: (id: string) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
}

const WhiteboardContext = createContext<WhiteboardContextType | undefined>(undefined);

const defaultState: WhiteboardState = {
  currentWhiteboard: null,
  selectedNode: null,
  zoom: 1,
  pan: { x: 0, y: 0 },
  breadcrumbs: [],
  isLoading: false,
  error: null,
};

// Load state from localStorage
function loadState(): WhiteboardState {
  if (typeof window === "undefined") return defaultState;
  
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Restore dates
      if (parsed.currentWhiteboard) {
        parsed.currentWhiteboard.createdAt = new Date(parsed.currentWhiteboard.createdAt);
        parsed.currentWhiteboard.updatedAt = new Date(parsed.currentWhiteboard.updatedAt);
        // Recursively restore node dates
        const restoreDates = (node: WhiteboardNode) => {
          node.createdAt = new Date(node.createdAt);
          node.updatedAt = new Date(node.updatedAt);
          node.children.forEach(restoreDates);
        };
        restoreDates(parsed.currentWhiteboard.rootNode);
      }
      return { ...defaultState, ...parsed };
    }
  } catch (e) {
    console.error("Failed to load whiteboard state:", e);
  }
  return defaultState;
}

// Save state to localStorage
function saveState(state: WhiteboardState) {
  if (typeof window === "undefined") return;
  
  try {
    const toSave = {
      currentWhiteboard: state.currentWhiteboard,
      zoom: state.zoom,
      pan: state.pan,
      breadcrumbs: state.breadcrumbs,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.error("Failed to save whiteboard state:", e);
  }
}

export function WhiteboardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WhiteboardState>(defaultState);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const loaded = loadState();
    setState(loaded);
    setIsHydrated(true);
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (isHydrated) {
      saveState(state);
    }
  }, [state, isHydrated]);

  const createWhiteboard = useCallback((name: string, description?: string) => {
    const rootNode: WhiteboardNode = {
      id: generateId(),
      type: "organisation",
      name,
      description,
      children: [],
      position: { x: 0, y: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const whiteboard: Whiteboard = {
      id: generateId(),
      name,
      description,
      rootNode,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: "user",
    };

    setState((prev) => ({
      ...prev,
      currentWhiteboard: whiteboard,
      breadcrumbs: [rootNode],
    }));
  }, []);

  const setCurrentWhiteboard = useCallback((whiteboard: Whiteboard | null) => {
    setState((prev) => ({
      ...prev,
      currentWhiteboard: whiteboard,
      breadcrumbs: whiteboard ? [whiteboard.rootNode] : [],
    }));
  }, []);

  const selectNode = useCallback((node: WhiteboardNode | null) => {
    setState((prev) => ({ ...prev, selectedNode: node }));
  }, []);

  const drillDown = useCallback((node: WhiteboardNode) => {
    setState((prev) => {
      const newBreadcrumbs = [...prev.breadcrumbs, node];
      return { ...prev, breadcrumbs: newBreadcrumbs, selectedNode: null };
    });
  }, []);

  const drillUp = useCallback(() => {
    setState((prev) => {
      if (prev.breadcrumbs.length <= 1) return prev;
      const newBreadcrumbs = prev.breadcrumbs.slice(0, -1);
      return { ...prev, breadcrumbs: newBreadcrumbs, selectedNode: null };
    });
  }, []);

  const navigateToBreadcrumb = useCallback((index: number) => {
    setState((prev) => {
      if (index < 0 || index >= prev.breadcrumbs.length) return prev;
      const newBreadcrumbs = prev.breadcrumbs.slice(0, index + 1);
      return { ...prev, breadcrumbs: newBreadcrumbs, selectedNode: null };
    });
  }, []);

  const createNode = useCallback((input: CreateNodeInput) => {
    setState((prev) => {
      if (!prev.currentWhiteboard) return prev;

      const newNode: WhiteboardNode = {
        id: generateId(),
        type: input.type,
        name: input.name,
        description: input.description,
        parentId: input.parentId,
        children: [],
        position: input.position || { x: 0, y: 0 },
        documentationUrl: input.documentationUrl,
        workflowType: input.workflowType,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const addNodeToTree = (node: WhiteboardNode): WhiteboardNode => {
        if (!input.parentId || node.id === input.parentId) {
          return { ...node, children: [...node.children, newNode], updatedAt: new Date() };
        }
        return { ...node, children: node.children.map(addNodeToTree) };
      };

      const newRootNode = addNodeToTree(prev.currentWhiteboard.rootNode);
      const updatedWhiteboard = {
        ...prev.currentWhiteboard,
        rootNode: newRootNode,
        updatedAt: new Date(),
      };

      return { ...prev, currentWhiteboard: updatedWhiteboard };
    });
  }, []);

  const updateNode = useCallback((input: UpdateNodeInput) => {
    setState((prev) => {
      if (!prev.currentWhiteboard) return prev;

      const updateNodeInTree = (node: WhiteboardNode): WhiteboardNode => {
        if (node.id === input.id) {
          return {
            ...node,
            name: input.name ?? node.name,
            description: input.description ?? node.description,
            position: input.position ?? node.position,
            documentationUrl: input.documentationUrl ?? node.documentationUrl,
            workflowType: input.workflowType ?? node.workflowType,
            updatedAt: new Date(),
          };
        }
        return { ...node, children: node.children.map(updateNodeInTree) };
      };

      const newRootNode = updateNodeInTree(prev.currentWhiteboard.rootNode);
      const updatedWhiteboard = {
        ...prev.currentWhiteboard,
        rootNode: newRootNode,
        updatedAt: new Date(),
      };

      return { ...prev, currentWhiteboard: updatedWhiteboard };
    });
  }, []);

  const deleteNode = useCallback((id: string) => {
    setState((prev) => {
      if (!prev.currentWhiteboard) return prev;
      if (prev.currentWhiteboard.rootNode.id === id) return prev;

      const deleteNodeFromTree = (node: WhiteboardNode): WhiteboardNode => ({
        ...node,
        children: node.children
          .filter((child) => child.id !== id)
          .map(deleteNodeFromTree),
      });

      const newRootNode = deleteNodeFromTree(prev.currentWhiteboard.rootNode);
      const updatedWhiteboard = {
        ...prev.currentWhiteboard,
        rootNode: newRootNode,
        updatedAt: new Date(),
      };

      return {
        ...prev,
        currentWhiteboard: updatedWhiteboard,
        selectedNode: prev.selectedNode?.id === id ? null : prev.selectedNode,
      };
    });
  }, []);

  const setZoom = useCallback((zoom: number) => {
    setState((prev) => ({ ...prev, zoom: Math.max(0.1, Math.min(3, zoom)) }));
  }, []);

  const setPan = useCallback((pan: { x: number; y: number }) => {
    setState((prev) => ({ ...prev, pan }));
  }, []);

  return (
    <WhiteboardContext.Provider
      value={{
        ...state,
        createWhiteboard,
        setCurrentWhiteboard,
        selectNode,
        drillDown,
        drillUp,
        navigateToBreadcrumb,
        createNode,
        updateNode,
        deleteNode,
        setZoom,
        setPan,
      }}
    >
      {children}
    </WhiteboardContext.Provider>
  );
}

export function useWhiteboard() {
  const context = useContext(WhiteboardContext);
  if (!context) {
    throw new Error("useWhiteboard must be used within a WhiteboardProvider");
  }
  return context;
}
