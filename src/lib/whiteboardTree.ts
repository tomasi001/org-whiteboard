import type {
  CreateNodeInput,
  UpdateNodeInput,
  WhiteboardKind,
  WhiteboardNode,
} from "@/types";
import { generateId } from "@/lib/utils";
import { getAllowedChildTypes } from "@/lib/hierarchy";

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
    automationBoardId: undefined,
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
  input: CreateNodeInput,
  boardKind: WhiteboardKind = "organisation"
): WhiteboardNode {
  void boardKind;
  const newNode = createNode(input);
  const targetParentId = input.parentId ?? root.id;

  const visit = (node: WhiteboardNode): WhiteboardNode => {
    if (node.id === targetParentId) {
      const allowedChildren = getAllowedChildTypes(node.type);
      if (!allowedChildren.includes(input.type)) {
        return node;
      }

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
        automationBoardId: input.automationBoardId ?? node.automationBoardId,
        documentationUrl: input.documentationUrl ?? node.documentationUrl,
        workflowType: input.workflowType ?? node.workflowType,
        departmentHead: input.departmentHead ?? node.departmentHead,
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

function hasDescendant(node: WhiteboardNode, targetId: string): boolean {
  if (node.id === targetId) return true;
  return node.children.some((child) => hasDescendant(child, targetId));
}

function removeNodeById(
  root: WhiteboardNode,
  targetId: string
): { nextRoot: WhiteboardNode; removedNode: WhiteboardNode | null } {
  let removedNode: WhiteboardNode | null = null;

  const visit = (node: WhiteboardNode): WhiteboardNode => {
    const nextChildren: WhiteboardNode[] = [];
    let removedDirectChild = false;

    for (const child of node.children) {
      if (child.id === targetId) {
        removedNode = child;
        removedDirectChild = true;
        continue;
      }
      nextChildren.push(visit(child));
    }

    return {
      ...node,
      children: nextChildren,
      updatedAt: removedDirectChild ? new Date() : node.updatedAt,
    };
  };

  return {
    nextRoot: visit(root),
    removedNode,
  };
}

function insertExistingNode(
  root: WhiteboardNode,
  parentId: string,
  nodeToInsert: WhiteboardNode
): WhiteboardNode {
  const visit = (node: WhiteboardNode): WhiteboardNode => {
    if (node.id === parentId) {
      return {
        ...node,
        children: [...node.children, { ...nodeToInsert, parentId }],
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

export function reparentNodeInTree(
  root: WhiteboardNode,
  nodeId: string,
  newParentId: string,
  boardKind: WhiteboardKind = "organisation"
): WhiteboardNode {
  void boardKind;
  if (root.id === nodeId) return root;

  const nodeToMove = findNodeById(root, nodeId);
  const newParent = findNodeById(root, newParentId);

  if (!nodeToMove || !newParent) return root;
  if (hasDescendant(nodeToMove, newParentId)) return root;
  if (!getAllowedChildTypes(newParent.type).includes(nodeToMove.type)) return root;
  if (nodeToMove.parentId === newParentId) return root;

  const { nextRoot, removedNode } = removeNodeById(root, nodeId);
  if (!removedNode) return root;

  return insertExistingNode(nextRoot, newParentId, {
    ...removedNode,
    parentId: newParentId,
    updatedAt: new Date(),
  });
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

export function setNodePositionsInTree(
  root: WhiteboardNode,
  positions: Record<string, { x: number; y: number }>
): WhiteboardNode {
  const visit = (node: WhiteboardNode): WhiteboardNode => {
    const nextPosition = positions[node.id];
    const nextChildren = node.children.map(visit);
    const childrenChanged = nextChildren.some((child, index) => child !== node.children[index]);
    const positionChanged =
      Boolean(nextPosition) &&
      (nextPosition.x !== node.position.x || nextPosition.y !== node.position.y);

    if (!childrenChanged && !positionChanged) {
      return node;
    }

    return {
      ...node,
      position: nextPosition ?? node.position,
      children: nextChildren,
      updatedAt: positionChanged ? new Date() : node.updatedAt,
    };
  };

  return visit(root);
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
