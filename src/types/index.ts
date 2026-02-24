// Core types for Org Whiteboard

export type NodeType = 
  | 'organisation'
  | 'department'
  | 'team'
  | 'teamLead'
  | 'teamMember'
  | 'role'
  | 'subRole'
  | 'tool'
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
  departmentHead?: string;
  workflowType?: WorkflowType;
  documentationUrl?: string;
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
  departmentHead?: string;
}

export interface UpdateNodeInput {
  id: string;
  name?: string;
  description?: string;
  position?: { x: number; y: number };
  documentationUrl?: string;
  workflowType?: WorkflowType;
}

export type {
  OrgTemplate,
  OrgTemplateAgent,
  OrgTemplateDepartment,
  OrgTemplateProcess,
  OrgTemplateTeam,
  OrgTemplateWorkflow,
} from "./orgTemplate";
