// Core types for Org Whiteboard

export type NodeType = 
  | 'organisation'
  | 'department'
  | 'team'
  | 'role'
  | 'workflow'
  | 'process'
  | 'agent'
  | 'automation';

export type WorkflowType = 'agentic' | 'linear';

export interface WhiteboardNode {
  id: string;
  type: NodeType;
  name: string;
  description?: string;
  parentId?: string;
  children: WhiteboardNode[];
  position: { x: number; y: number };
  metadata?: Record<string, unknown>;
  documentationUrl?: string;
  workflowType?: WorkflowType;
  createdAt: Date;
  updatedAt: Date;
}

export interface Whiteboard {
  id: string;
  name: string;
  description?: string;
  rootNode: WhiteboardNode;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'hierarchy' | 'workflow' | 'dependency';
  label?: string;
}

export interface WhiteboardState {
  currentWhiteboard: Whiteboard | null;
  selectedNode: WhiteboardNode | null;
  zoom: number;
  pan: { x: number; y: number };
  breadcrumbs: WhiteboardNode[];
  isLoading: boolean;
  error: string | null;
}

export interface CreateNodeInput {
  type: NodeType;
  name: string;
  description?: string;
  parentId?: string;
  position?: { x: number; y: number };
  documentationUrl?: string;
  workflowType?: WorkflowType;
}

export interface UpdateNodeInput {
  id: string;
  name?: string;
  description?: string;
  position?: { x: number; y: number };
  documentationUrl?: string;
  workflowType?: WorkflowType;
}
