"use client";

import React, {
  createContext,
  useContext,
  useMemo,
  useReducer,
  useEffect,
  type ReactNode,
} from "react";
import type {
  Whiteboard,
  WhiteboardNode,
  WhiteboardState,
  CreateNodeInput,
  UpdateNodeInput,
} from "@/types";
import { generateId } from "@/lib/utils";
import {
  addNodeToTree,
  collectNodeIds,
  deleteNodeFromTree,
  findNodeById,
  normalizeBreadcrumbIds,
  updateNodeInTree,
} from "@/lib/whiteboardTree";

export const STORAGE_KEY = "org-whiteboard-state";

interface WhiteboardContextType extends WhiteboardState {
  createWhiteboard: (name: string, description?: string) => void;
  resetWhiteboard: () => void;
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

interface UiState {
  selectedNodeId: string | null;
  breadcrumbIds: string[];
  zoom: number;
  pan: { x: number; y: number };
  isLoading: boolean;
  error: string | null;
}

interface InternalState {
  document: Whiteboard | null;
  ui: UiState;
}

type Action =
  | { type: "CREATE_WHITEBOARD"; payload: { name: string; description?: string } }
  | { type: "SET_WHITEBOARD"; payload: { whiteboard: Whiteboard | null } }
  | { type: "RESET_WHITEBOARD" }
  | { type: "SELECT_NODE"; payload: { nodeId: string | null } }
  | { type: "DRILL_DOWN"; payload: { nodeId: string } }
  | { type: "DRILL_UP" }
  | { type: "NAVIGATE_BREADCRUMB"; payload: { index: number } }
  | { type: "CREATE_NODE"; payload: { input: CreateNodeInput } }
  | { type: "UPDATE_NODE"; payload: { input: UpdateNodeInput } }
  | { type: "DELETE_NODE"; payload: { id: string } }
  | { type: "SET_ZOOM"; payload: { zoom: number } }
  | { type: "SET_PAN"; payload: { pan: { x: number; y: number } } };

const defaultUiState: UiState = {
  selectedNodeId: null,
  breadcrumbIds: [],
  zoom: 1,
  pan: { x: 0, y: 0 },
  isLoading: false,
  error: null,
};

const WhiteboardContext = createContext<WhiteboardContextType | undefined>(undefined);

function restoreNodeDates(node: WhiteboardNode): WhiteboardNode {
  return {
    ...node,
    createdAt: new Date(node.createdAt),
    updatedAt: new Date(node.updatedAt),
    children: node.children.map(restoreNodeDates),
  };
}

function loadState(): InternalState {
  if (typeof window === "undefined") {
    return { document: null, ui: defaultUiState };
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { document: null, ui: defaultUiState };

    const parsed = JSON.parse(saved) as {
      currentWhiteboard: Whiteboard | null;
      selectedNodeId?: string | null;
      breadcrumbIds?: string[];
      zoom?: number;
      pan?: { x: number; y: number };
    };

    let restoredWhiteboard: Whiteboard | null = null;
    if (parsed.currentWhiteboard) {
      restoredWhiteboard = {
        ...parsed.currentWhiteboard,
        createdAt: new Date(parsed.currentWhiteboard.createdAt),
        updatedAt: new Date(parsed.currentWhiteboard.updatedAt),
        rootNode: restoreNodeDates(parsed.currentWhiteboard.rootNode),
      };
    }

    const breadcrumbIds = restoredWhiteboard
      ? normalizeBreadcrumbIds(
          restoredWhiteboard.rootNode,
          parsed.breadcrumbIds ?? [restoredWhiteboard.rootNode.id]
        )
      : [];

    return {
      document: restoredWhiteboard,
      ui: {
        ...defaultUiState,
        selectedNodeId: parsed.selectedNodeId ?? null,
        breadcrumbIds,
        zoom: parsed.zoom ?? 1,
        pan: parsed.pan ?? { x: 0, y: 0 },
      },
    };
  } catch (error) {
    console.error("Failed to load whiteboard state:", error);
    return { document: null, ui: defaultUiState };
  }
}

function saveState(state: InternalState): void {
  if (typeof window === "undefined") return;

  try {
    const payload = {
      currentWhiteboard: state.document,
      selectedNodeId: state.ui.selectedNodeId,
      breadcrumbIds: state.ui.breadcrumbIds,
      zoom: state.ui.zoom,
      pan: state.ui.pan,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error("Failed to save whiteboard state:", error);
  }
}

function normalizeUiForDocument(ui: UiState, document: Whiteboard | null): UiState {
  if (!document) {
    return {
      ...ui,
      selectedNodeId: null,
      breadcrumbIds: [],
    };
  }

  const validNodeIds = collectNodeIds(document.rootNode);
  const selectedNodeId =
    ui.selectedNodeId && validNodeIds.has(ui.selectedNodeId)
      ? ui.selectedNodeId
      : null;
  const breadcrumbIds = normalizeBreadcrumbIds(
    document.rootNode,
    ui.breadcrumbIds.length > 0 ? ui.breadcrumbIds : [document.rootNode.id]
  );

  return {
    ...ui,
    selectedNodeId,
    breadcrumbIds,
  };
}

function reducer(state: InternalState, action: Action): InternalState {
  switch (action.type) {
    case "CREATE_WHITEBOARD": {
      const now = new Date();
      const rootNode: WhiteboardNode = {
        id: generateId(),
        type: "organisation",
        name: action.payload.name,
        description: action.payload.description,
        children: [],
        position: { x: 0, y: 0 },
        createdAt: now,
        updatedAt: now,
      };

      const whiteboard: Whiteboard = {
        id: generateId(),
        name: action.payload.name,
        description: action.payload.description,
        rootNode,
        createdAt: now,
        updatedAt: now,
        createdBy: "user",
      };

      return {
        document: whiteboard,
        ui: {
          ...state.ui,
          selectedNodeId: null,
          breadcrumbIds: [rootNode.id],
        },
      };
    }

    case "SET_WHITEBOARD": {
      const document = action.payload.whiteboard;
      const ui = normalizeUiForDocument(state.ui, document);
      return { document, ui };
    }

    case "RESET_WHITEBOARD":
      return { document: null, ui: { ...state.ui, selectedNodeId: null, breadcrumbIds: [] } };

    case "SELECT_NODE":
      return {
        ...state,
        ui: { ...state.ui, selectedNodeId: action.payload.nodeId },
      };

    case "DRILL_DOWN": {
      if (!state.document) return state;
      const nextBreadcrumbIds = [...state.ui.breadcrumbIds, action.payload.nodeId];
      return {
        ...state,
        ui: {
          ...state.ui,
          selectedNodeId: null,
          breadcrumbIds: normalizeBreadcrumbIds(state.document.rootNode, nextBreadcrumbIds),
        },
      };
    }

    case "DRILL_UP": {
      if (state.ui.breadcrumbIds.length <= 1) return state;
      return {
        ...state,
        ui: {
          ...state.ui,
          selectedNodeId: null,
          breadcrumbIds: state.ui.breadcrumbIds.slice(0, -1),
        },
      };
    }

    case "NAVIGATE_BREADCRUMB": {
      if (
        action.payload.index < 0 ||
        action.payload.index >= state.ui.breadcrumbIds.length
      ) {
        return state;
      }

      return {
        ...state,
        ui: {
          ...state.ui,
          selectedNodeId: null,
          breadcrumbIds: state.ui.breadcrumbIds.slice(0, action.payload.index + 1),
        },
      };
    }

    case "CREATE_NODE": {
      if (!state.document) return state;

      const rootNode = addNodeToTree(state.document.rootNode, action.payload.input);
      const document = {
        ...state.document,
        rootNode,
        updatedAt: new Date(),
      };

      return {
        document,
        ui: normalizeUiForDocument(state.ui, document),
      };
    }

    case "UPDATE_NODE": {
      if (!state.document) return state;

      const rootNode = updateNodeInTree(state.document.rootNode, action.payload.input);
      const document = {
        ...state.document,
        rootNode,
        updatedAt: new Date(),
      };

      return {
        document,
        ui: normalizeUiForDocument(state.ui, document),
      };
    }

    case "DELETE_NODE": {
      if (!state.document) return state;
      if (state.document.rootNode.id === action.payload.id) return state;

      const rootNode = deleteNodeFromTree(state.document.rootNode, action.payload.id);
      const document = {
        ...state.document,
        rootNode,
        updatedAt: new Date(),
      };

      return {
        document,
        ui: normalizeUiForDocument(state.ui, document),
      };
    }

    case "SET_ZOOM":
      return {
        ...state,
        ui: {
          ...state.ui,
          zoom: Math.max(0.1, Math.min(3, action.payload.zoom)),
        },
      };

    case "SET_PAN":
      return {
        ...state,
        ui: {
          ...state.ui,
          pan: action.payload.pan,
        },
      };

    default:
      return state;
  }
}

export function WhiteboardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const { document, ui } = state;

  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        saveState({
          document,
          ui,
        }),
      250
    );
    return () => window.clearTimeout(timer);
  }, [document, ui]);

  const breadcrumbs = useMemo<WhiteboardNode[]>(() => {
    if (!document) return [];
    return ui.breadcrumbIds
      .map((id) => findNodeById(document.rootNode, id))
      .filter((node): node is WhiteboardNode => node !== null);
  }, [document, ui.breadcrumbIds]);

  const selectedNode = useMemo<WhiteboardNode | null>(() => {
    if (!document || !ui.selectedNodeId) return null;
    return findNodeById(document.rootNode, ui.selectedNodeId);
  }, [document, ui.selectedNodeId]);

  const contextValue = useMemo<WhiteboardContextType>(
    () => ({
      currentWhiteboard: document,
      selectedNode,
      zoom: ui.zoom,
      pan: ui.pan,
      breadcrumbs,
      isLoading: ui.isLoading,
      error: ui.error,
      createWhiteboard: (name, description) =>
        dispatch({ type: "CREATE_WHITEBOARD", payload: { name, description } }),
      resetWhiteboard: () => {
        localStorage.removeItem(STORAGE_KEY);
        dispatch({ type: "RESET_WHITEBOARD" });
      },
      setCurrentWhiteboard: (whiteboard) =>
        dispatch({ type: "SET_WHITEBOARD", payload: { whiteboard } }),
      selectNode: (node) =>
        dispatch({ type: "SELECT_NODE", payload: { nodeId: node?.id ?? null } }),
      drillDown: (node) =>
        dispatch({ type: "DRILL_DOWN", payload: { nodeId: node.id } }),
      drillUp: () => dispatch({ type: "DRILL_UP" }),
      navigateToBreadcrumb: (index) =>
        dispatch({ type: "NAVIGATE_BREADCRUMB", payload: { index } }),
      createNode: (input) => dispatch({ type: "CREATE_NODE", payload: { input } }),
      updateNode: (input) => dispatch({ type: "UPDATE_NODE", payload: { input } }),
      deleteNode: (id) => dispatch({ type: "DELETE_NODE", payload: { id } }),
      setZoom: (zoom) => dispatch({ type: "SET_ZOOM", payload: { zoom } }),
      setPan: (pan) => dispatch({ type: "SET_PAN", payload: { pan } }),
    }),
    [breadcrumbs, document, selectedNode, ui]
  );

  return (
    <WhiteboardContext.Provider value={contextValue}>
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
