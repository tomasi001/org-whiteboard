import type { CreateNodeInput, UpdateNodeInput, WhiteboardNode } from "@/types";
import { generateId } from "@/lib/utils";

function createNode(input: CreateNodeInput): WhiteboardNode {
  const now = new Date();

  return {
    id: generateId(),
    type: input.type,
    name: input.name,
    description: input.description,
    parentId: input.parentId,
    children: [],
    position: input.position ?? { x: 0, y: 0 },
    departmentHead: input.departmentHead,
    workflowType: input.workflowType,
    documentationUrl: input.documentationUrl,
    createdAt: now,
    updatedAt: now,
  };
}

export function findNodeById(
  node: WhiteboardNode,
  id: string
): WhiteboardNode | null {
  if (node.id === id) return node;

  for (const child of node.children) {
    const match = findNodeById(child, id);
    if (match) return match;
  }

  return null;
}

export function addNodeToTree(
  root: WhiteboardNode,
  input: CreateNodeInput
): WhiteboardNode {
  const newNode = createNode(input);

  const visit = (node: WhiteboardNode): WhiteboardNode => {
    if (!input.parentId || node.id === input.parentId) {
      return {
        ...node,
        updatedAt: new Date(),
        children: [...node.children, newNode],
      };
    }

    return {
      ...node,
      children: node.children.map(visit),
    };
  };

  return visit(root);
}

export function updateNodeInTree(
  root: WhiteboardNode,
  input: UpdateNodeInput
): WhiteboardNode {
  const visit = (node: WhiteboardNode): WhiteboardNode => {
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

    return {
      ...node,
      children: node.children.map(visit),
    };
  };

  return visit(root);
}

export function deleteNodeFromTree(
  root: WhiteboardNode,
  id: string
): WhiteboardNode {
  const visit = (node: WhiteboardNode): WhiteboardNode => ({
    ...node,
    children: node.children
      .filter((child) => child.id !== id)
      .map(visit),
  });

  return visit(root);
}

export function collectNodeIds(node: WhiteboardNode): Set<string> {
  const ids = new Set<string>();

  const visit = (current: WhiteboardNode) => {
    ids.add(current.id);
    current.children.forEach(visit);
  };

  visit(node);
  return ids;
}

export function normalizeBreadcrumbIds(
  root: WhiteboardNode,
  breadcrumbIds: string[]
): string[] {
  const idSet = collectNodeIds(root);
  const nextIds = breadcrumbIds.filter((id) => idSet.has(id));

  if (nextIds.length === 0 || nextIds[0] !== root.id) {
    return [root.id];
  }

  return nextIds;
}

