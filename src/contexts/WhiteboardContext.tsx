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
  CreateNodeInput,
  LayoutMode,
  NodeType,
  UpdateNodeInput,
  Whiteboard,
  WhiteboardKind,
  WhiteboardNode,
  WhiteboardState,
} from "@/types";
import { generateId } from "@/lib/utils";
import {
  addNodeToTree,
  collectNodeIds,
  deleteNodeFromTree,
  findNodeById,
  normalizeBreadcrumbIds,
  reparentNodeInTree,
  setNodePositionsInTree,
  updateNodeInTree,
} from "@/lib/whiteboardTree";

export const STORAGE_KEY = "org-whiteboard-state";

interface WhiteboardContextType extends WhiteboardState {
  createWhiteboard: (name: string, description?: string) => void;
  resetWhiteboard: () => void;
  setCurrentWhiteboard: (whiteboard: Whiteboard | null) => void;
  openWhiteboard: (id: string) => void;
  deleteWhiteboard: (id: string) => void;
  openAutomationBoard: (nodeId: string) => void;
  returnToParentBoard: () => void;
  selectNode: (node: WhiteboardNode | null) => void;
  drillDown: (node: WhiteboardNode) => void;
  drillUp: () => void;
  navigateToBreadcrumb: (index: number) => void;
  createNode: (input: CreateNodeInput) => void;
  updateNode: (input: UpdateNodeInput) => void;
  setNodePositions: (positions: Record<string, { x: number; y: number }>) => void;
  moveNode: (id: string, parentId: string) => void;
  deleteNode: (id: string) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  setLayerColor: (nodeType: NodeType, color: string) => void;
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
  documents: Whiteboard[];
  activeWhiteboardId: string | null;
  ui: UiState;
}

type Action =
  | {
      type: "CREATE_WHITEBOARD";
      payload: { name: string; description?: string; kind?: WhiteboardKind };
    }
  | { type: "SET_WHITEBOARD"; payload: { whiteboard: Whiteboard | null } }
  | { type: "OPEN_WHITEBOARD"; payload: { id: string } }
  | { type: "DELETE_WHITEBOARD"; payload: { id: string } }
  | { type: "RESET_WHITEBOARD" }
  | { type: "OPEN_AUTOMATION_BOARD"; payload: { nodeId: string } }
  | { type: "RETURN_TO_PARENT_BOARD" }
  | { type: "SELECT_NODE"; payload: { nodeId: string | null } }
  | { type: "DRILL_DOWN"; payload: { nodeId: string } }
  | { type: "DRILL_UP" }
  | { type: "NAVIGATE_BREADCRUMB"; payload: { index: number } }
  | { type: "CREATE_NODE"; payload: { input: CreateNodeInput } }
  | { type: "UPDATE_NODE"; payload: { input: UpdateNodeInput } }
  | {
      type: "SET_NODE_POSITIONS";
      payload: { positions: Record<string, { x: number; y: number }> };
    }
  | { type: "MOVE_NODE"; payload: { id: string; parentId: string } }
  | { type: "DELETE_NODE"; payload: { id: string } }
  | { type: "SET_LAYOUT_MODE"; payload: { mode: LayoutMode } }
  | { type: "SET_LAYER_COLOR"; payload: { nodeType: NodeType; color: string } }
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

function withBoardDefaults(whiteboard: Whiteboard): Whiteboard {
  return {
    ...whiteboard,
    kind: whiteboard.kind ?? "organisation",
    layoutMode: whiteboard.layoutMode ?? "auto",
    layerColors: whiteboard.layerColors ?? {},
  };
}

function createWhiteboardDocument(
  name: string,
  description?: string,
  kind: WhiteboardKind = "organisation",
  createdBy = "user",
  parentBoardId?: string,
  parentAutomationNodeId?: string
): Whiteboard {
  const now = new Date();
  const rootNode: WhiteboardNode = {
    id: generateId(),
    type: kind === "automation" ? "automation" : "organisation",
    name,
    description,
    children: [],
    position: { x: 0, y: 0 },
    createdAt: now,
    updatedAt: now,
  };

  return {
    id: generateId(),
    name,
    description,
    rootNode,
    kind,
    parentBoardId,
    parentAutomationNodeId,
    layoutMode: "auto",
    layerColors: {},
    createdAt: now,
    updatedAt: now,
    createdBy,
  };
}

function restoreNodeDates(node: WhiteboardNode, parentId?: string): WhiteboardNode {
  return {
    ...node,
    parentId: node.parentId ?? parentId,
    createdAt: new Date(node.createdAt),
    updatedAt: new Date(node.updatedAt),
    children: node.children.map((child) => restoreNodeDates(child, node.id)),
  };
}

function restoreWhiteboardDates(whiteboard: Whiteboard): Whiteboard {
  return withBoardDefaults({
    ...whiteboard,
    createdAt: new Date(whiteboard.createdAt),
    updatedAt: new Date(whiteboard.updatedAt),
    rootNode: restoreNodeDates(whiteboard.rootNode),
  });
}

function getActiveDocument(state: InternalState): Whiteboard | null {
  if (!state.activeWhiteboardId) return null;
  return state.documents.find((document) => document.id === state.activeWhiteboardId) ?? null;
}

function upsertDocument(documents: Whiteboard[], document: Whiteboard): Whiteboard[] {
  const index = documents.findIndex((entry) => entry.id === document.id);

  if (index === -1) {
    return [...documents, document];
  }

  const next = [...documents];
  next[index] = document;
  return next;
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
    ui.selectedNodeId && validNodeIds.has(ui.selectedNodeId) ? ui.selectedNodeId : null;

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

function resetUiForDocument(
  ui: UiState,
  document: Whiteboard | null,
  selectedNodeId: string | null = null
): UiState {
  if (!document) {
    return {
      ...ui,
      selectedNodeId: null,
      breadcrumbIds: [],
      zoom: 1,
      pan: { x: 0, y: 0 },
    };
  }

  return {
    ...ui,
    selectedNodeId,
    breadcrumbIds: [document.rootNode.id],
    zoom: 1,
    pan: { x: 0, y: 0 },
  };
}

function mapActiveDocument(
  state: InternalState,
  updater: (document: Whiteboard) => Whiteboard
): InternalState {
  const activeDocument = getActiveDocument(state);
  if (!activeDocument) return state;

  const updatedDocument = withBoardDefaults(updater(activeDocument));
  if (updatedDocument === activeDocument) return state;

  const documents = state.documents.map((document) =>
    document.id === activeDocument.id ? updatedDocument : document
  );

  return {
    documents,
    activeWhiteboardId: updatedDocument.id,
    ui: normalizeUiForDocument(state.ui, updatedDocument),
  };
}

function loadState(): InternalState {
  if (typeof window === "undefined") {
    return { documents: [], activeWhiteboardId: null, ui: defaultUiState };
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return { documents: [], activeWhiteboardId: null, ui: defaultUiState };
    }

    const parsed = JSON.parse(saved) as {
      whiteboards?: Whiteboard[];
      activeWhiteboardId?: string | null;
      currentWhiteboard?: Whiteboard | null;
      selectedNodeId?: string | null;
      breadcrumbIds?: string[];
      zoom?: number;
      pan?: { x: number; y: number };
    };

    const documents = Array.isArray(parsed.whiteboards)
      ? parsed.whiteboards.map(restoreWhiteboardDates)
      : parsed.currentWhiteboard
        ? [restoreWhiteboardDates(parsed.currentWhiteboard)]
        : [];

    const fallbackActiveId = documents.length > 0 ? documents[documents.length - 1].id : null;
    const activeWhiteboardId =
      parsed.activeWhiteboardId && documents.some((document) => document.id === parsed.activeWhiteboardId)
        ? parsed.activeWhiteboardId
        : fallbackActiveId;

    const activeDocument =
      activeWhiteboardId !== null
        ? documents.find((document) => document.id === activeWhiteboardId) ?? null
        : null;

    const ui = normalizeUiForDocument(
      {
        ...defaultUiState,
        selectedNodeId: parsed.selectedNodeId ?? null,
        breadcrumbIds: parsed.breadcrumbIds ?? (activeDocument ? [activeDocument.rootNode.id] : []),
        zoom: parsed.zoom ?? 1,
        pan: parsed.pan ?? { x: 0, y: 0 },
      },
      activeDocument
    );

    return {
      documents,
      activeWhiteboardId,
      ui,
    };
  } catch (error) {
    console.error("Failed to load whiteboard state:", error);
    return { documents: [], activeWhiteboardId: null, ui: defaultUiState };
  }
}

function saveState(state: InternalState): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        whiteboards: state.documents,
        activeWhiteboardId: state.activeWhiteboardId,
        selectedNodeId: state.ui.selectedNodeId,
        breadcrumbIds: state.ui.breadcrumbIds,
        zoom: state.ui.zoom,
        pan: state.ui.pan,
      })
    );
  } catch (error) {
    console.error("Failed to save whiteboard state:", error);
  }
}

function reducer(state: InternalState, action: Action): InternalState {
  switch (action.type) {
    case "CREATE_WHITEBOARD": {
      const whiteboard = createWhiteboardDocument(
        action.payload.name,
        action.payload.description,
        action.payload.kind ?? "organisation"
      );

      return {
        documents: [...state.documents, whiteboard],
        activeWhiteboardId: whiteboard.id,
        ui: resetUiForDocument(state.ui, whiteboard),
      };
    }

    case "SET_WHITEBOARD": {
      const document = action.payload.whiteboard
        ? withBoardDefaults(action.payload.whiteboard)
        : null;

      if (!document) {
        return {
          ...state,
          activeWhiteboardId: null,
          ui: resetUiForDocument(state.ui, null),
        };
      }

      const isSameAsActive = state.activeWhiteboardId === document.id;

      return {
        documents: upsertDocument(state.documents, document),
        activeWhiteboardId: document.id,
        ui: isSameAsActive
          ? normalizeUiForDocument(state.ui, document)
          : resetUiForDocument(state.ui, document),
      };
    }

    case "OPEN_WHITEBOARD": {
      const document = state.documents.find((entry) => entry.id === action.payload.id) ?? null;
      if (!document) return state;

      return {
        ...state,
        activeWhiteboardId: document.id,
        ui: resetUiForDocument(state.ui, document),
      };
    }

    case "DELETE_WHITEBOARD": {
      const documents = state.documents.filter((entry) => entry.id !== action.payload.id);

      if (state.activeWhiteboardId !== action.payload.id) {
        return {
          ...state,
          documents,
        };
      }

      return {
        documents,
        activeWhiteboardId: null,
        ui: resetUiForDocument(state.ui, null),
      };
    }

    case "RESET_WHITEBOARD": {
      if (!state.activeWhiteboardId) {
        return {
          documents: [],
          activeWhiteboardId: null,
          ui: resetUiForDocument(state.ui, null),
        };
      }

      const documents = state.documents.filter(
        (document) => document.id !== state.activeWhiteboardId
      );

      return {
        documents,
        activeWhiteboardId: null,
        ui: resetUiForDocument(state.ui, null),
      };
    }

    case "OPEN_AUTOMATION_BOARD": {
      const activeDocument = getActiveDocument(state);
      if (!activeDocument) return state;

      const node = findNodeById(activeDocument.rootNode, action.payload.nodeId);
      if (!node || node.type !== "automation") return state;

      if (node.automationBoardId) {
        const existingBoard = state.documents.find(
          (document) => document.id === node.automationBoardId
        );

        if (existingBoard) {
          return {
            ...state,
            activeWhiteboardId: existingBoard.id,
            ui: resetUiForDocument(state.ui, existingBoard),
          };
        }
      }

      const automationBoard = createWhiteboardDocument(
        `${node.name} Flow`,
        node.description ?? `Automation flow for ${node.name}`,
        "automation",
        activeDocument.createdBy,
        activeDocument.id,
        node.id
      );

      const updatedRoot = updateNodeInTree(activeDocument.rootNode, {
        id: node.id,
        automationBoardId: automationBoard.id,
      });

      const updatedParentBoard: Whiteboard = withBoardDefaults({
        ...activeDocument,
        rootNode: updatedRoot,
        updatedAt: new Date(),
      });

      const documents = [
        ...state.documents.map((document) =>
          document.id === updatedParentBoard.id ? updatedParentBoard : document
        ),
        { ...automationBoard, layerColors: { ...updatedParentBoard.layerColors } },
      ];

      return {
        documents,
        activeWhiteboardId: automationBoard.id,
        ui: resetUiForDocument(state.ui, automationBoard),
      };
    }

    case "RETURN_TO_PARENT_BOARD": {
      const activeDocument = getActiveDocument(state);
      if (!activeDocument || activeDocument.kind !== "automation" || !activeDocument.parentBoardId) {
        return state;
      }

      const parentBoard =
        state.documents.find((document) => document.id === activeDocument.parentBoardId) ?? null;
      if (!parentBoard) return state;

      const selectedNodeId =
        activeDocument.parentAutomationNodeId &&
        findNodeById(parentBoard.rootNode, activeDocument.parentAutomationNodeId)
          ? activeDocument.parentAutomationNodeId
          : null;

      return {
        ...state,
        activeWhiteboardId: parentBoard.id,
        ui: resetUiForDocument(state.ui, parentBoard, selectedNodeId),
      };
    }

    case "SELECT_NODE":
      return {
        ...state,
        ui: {
          ...state.ui,
          selectedNodeId: action.payload.nodeId,
        },
      };

    case "DRILL_DOWN": {
      const activeDocument = getActiveDocument(state);
      if (!activeDocument) return state;

      const nextBreadcrumbIds = [...state.ui.breadcrumbIds, action.payload.nodeId];
      return {
        ...state,
        ui: {
          ...state.ui,
          selectedNodeId: null,
          breadcrumbIds: normalizeBreadcrumbIds(activeDocument.rootNode, nextBreadcrumbIds),
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
      if (action.payload.index < 0 || action.payload.index >= state.ui.breadcrumbIds.length) {
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

    case "CREATE_NODE":
      return mapActiveDocument(state, (document) => {
        const rootNode = addNodeToTree(
          document.rootNode,
          action.payload.input,
          document.kind ?? "organisation"
        );

        if (rootNode === document.rootNode) return document;
        return {
          ...document,
          rootNode,
          updatedAt: new Date(),
        };
      });

    case "UPDATE_NODE":
      return mapActiveDocument(state, (document) => {
        const rootNode = updateNodeInTree(document.rootNode, action.payload.input);
        if (rootNode === document.rootNode) return document;

        return {
          ...document,
          rootNode,
          updatedAt: new Date(),
        };
      });

    case "SET_NODE_POSITIONS":
      return mapActiveDocument(state, (document) => {
        const rootNode = setNodePositionsInTree(document.rootNode, action.payload.positions);
        if (rootNode === document.rootNode) return document;

        return {
          ...document,
          rootNode,
          updatedAt: new Date(),
        };
      });

    case "MOVE_NODE":
      return mapActiveDocument(state, (document) => {
        if (document.rootNode.id === action.payload.id) return document;

        const rootNode = reparentNodeInTree(
          document.rootNode,
          action.payload.id,
          action.payload.parentId,
          document.kind ?? "organisation"
        );

        if (rootNode === document.rootNode) return document;

        return {
          ...document,
          rootNode,
          updatedAt: new Date(),
        };
      });

    case "DELETE_NODE":
      return mapActiveDocument(state, (document) => {
        if (document.rootNode.id === action.payload.id) return document;

        const rootNode = deleteNodeFromTree(document.rootNode, action.payload.id);
        if (rootNode === document.rootNode) return document;

        return {
          ...document,
          rootNode,
          updatedAt: new Date(),
        };
      });

    case "SET_LAYOUT_MODE":
      return mapActiveDocument(state, (document) => ({
        ...document,
        layoutMode: action.payload.mode,
        updatedAt: new Date(),
      }));

    case "SET_LAYER_COLOR":
      return mapActiveDocument(state, (document) => ({
        ...document,
        layerColors: {
          ...document.layerColors,
          [action.payload.nodeType]: action.payload.color,
        },
        updatedAt: new Date(),
      }));

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

  const currentWhiteboard = getActiveDocument(state);

  useEffect(() => {
    const timer = window.setTimeout(() => saveState(state), 250);
    return () => window.clearTimeout(timer);
  }, [state]);

  const breadcrumbs = useMemo<WhiteboardNode[]>(() => {
    if (!currentWhiteboard) return [];

    return state.ui.breadcrumbIds
      .map((id) => findNodeById(currentWhiteboard.rootNode, id))
      .filter((node): node is WhiteboardNode => node !== null);
  }, [currentWhiteboard, state.ui.breadcrumbIds]);

  const selectedNode = useMemo<WhiteboardNode | null>(() => {
    if (!currentWhiteboard || !state.ui.selectedNodeId) return null;
    return findNodeById(currentWhiteboard.rootNode, state.ui.selectedNodeId);
  }, [currentWhiteboard, state.ui.selectedNodeId]);

  const contextValue = useMemo<WhiteboardContextType>(
    () => ({
      whiteboards: [...state.documents].sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
      ),
      currentWhiteboard,
      selectedNode,
      zoom: state.ui.zoom,
      pan: state.ui.pan,
      breadcrumbs,
      isLoading: state.ui.isLoading,
      error: state.ui.error,
      createWhiteboard: (name, description) =>
        dispatch({ type: "CREATE_WHITEBOARD", payload: { name, description } }),
      resetWhiteboard: () => dispatch({ type: "RESET_WHITEBOARD" }),
      setCurrentWhiteboard: (whiteboard) =>
        dispatch({ type: "SET_WHITEBOARD", payload: { whiteboard } }),
      openWhiteboard: (id) => dispatch({ type: "OPEN_WHITEBOARD", payload: { id } }),
      deleteWhiteboard: (id) => dispatch({ type: "DELETE_WHITEBOARD", payload: { id } }),
      openAutomationBoard: (nodeId) =>
        dispatch({ type: "OPEN_AUTOMATION_BOARD", payload: { nodeId } }),
      returnToParentBoard: () => dispatch({ type: "RETURN_TO_PARENT_BOARD" }),
      selectNode: (node) =>
        dispatch({ type: "SELECT_NODE", payload: { nodeId: node?.id ?? null } }),
      drillDown: (node) => dispatch({ type: "DRILL_DOWN", payload: { nodeId: node.id } }),
      drillUp: () => dispatch({ type: "DRILL_UP" }),
      navigateToBreadcrumb: (index) =>
        dispatch({ type: "NAVIGATE_BREADCRUMB", payload: { index } }),
      createNode: (input) => dispatch({ type: "CREATE_NODE", payload: { input } }),
      updateNode: (input) => dispatch({ type: "UPDATE_NODE", payload: { input } }),
      setNodePositions: (positions) =>
        dispatch({ type: "SET_NODE_POSITIONS", payload: { positions } }),
      moveNode: (id, parentId) => dispatch({ type: "MOVE_NODE", payload: { id, parentId } }),
      deleteNode: (id) => dispatch({ type: "DELETE_NODE", payload: { id } }),
      setLayoutMode: (mode) => dispatch({ type: "SET_LAYOUT_MODE", payload: { mode } }),
      setLayerColor: (nodeType, color) =>
        dispatch({ type: "SET_LAYER_COLOR", payload: { nodeType, color } }),
      setZoom: (zoom) => dispatch({ type: "SET_ZOOM", payload: { zoom } }),
      setPan: (pan) => dispatch({ type: "SET_PAN", payload: { pan } }),
    }),
    [breadcrumbs, currentWhiteboard, selectedNode, state.documents, state.ui]
  );

  return <WhiteboardContext.Provider value={contextValue}>{children}</WhiteboardContext.Provider>;
}

export function useWhiteboard() {
  const context = useContext(WhiteboardContext);
  if (!context) {
    throw new Error("useWhiteboard must be used within a WhiteboardProvider");
  }
  return context;
}
