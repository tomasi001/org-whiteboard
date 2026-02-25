import { describe, expect, it } from "vitest";
import type { WhiteboardNode } from "@/types";
import {
  addNodeToTree,
  deleteNodeFromTree,
  findNodeById,
  normalizeBreadcrumbIds,
  reparentNodeInTree,
  updateNodeInTree,
} from "@/lib/whiteboardTree";

function node(
  id: string,
  type: WhiteboardNode["type"],
  name: string,
  children: WhiteboardNode[] = []
): WhiteboardNode {
  const now = new Date();
  return {
    id,
    type,
    name,
    children,
    position: { x: 0, y: 0 },
    createdAt: now,
    updatedAt: now,
  };
}

function makeTree(): WhiteboardNode {
  return node("org", "organisation", "Acme", [
    node("dept-eng", "department", "Engineering", [
      node("team-fe", "team", "Frontend"),
    ]),
    node("dept-ops", "department", "Operations"),
  ]);
}

describe("whiteboardTree", () => {
  it("adds a node under the target parent", () => {
    const root = makeTree();
    const next = addNodeToTree(root, {
      parentId: "dept-eng",
      type: "team",
      name: "Backend",
    });

    const department = findNodeById(next, "dept-eng");
    expect(department?.children.map((child) => child.name)).toContain("Backend");
  });

  it("updates node fields", () => {
    const root = makeTree();
    const next = updateNodeInTree(root, {
      id: "team-fe",
      name: "Frontend Platform",
      description: "Owns web platform",
      departmentHead: "Sam",
    });

    const team = findNodeById(next, "team-fe");
    expect(team?.name).toBe("Frontend Platform");
    expect(team?.description).toBe("Owns web platform");
    expect(team?.departmentHead).toBe("Sam");
  });

  it("deletes a node recursively", () => {
    const root = makeTree();
    const next = deleteNodeFromTree(root, "team-fe");
    const team = findNodeById(next, "team-fe");
    expect(team).toBeNull();
  });

  it("normalizes breadcrumbs when IDs are invalid", () => {
    const root = makeTree();
    const breadcrumbs = normalizeBreadcrumbIds(root, ["missing-id", "team-fe"]);
    expect(breadcrumbs).toEqual(["org"]);
  });

  it("moves a node to another valid parent", () => {
    const root = makeTree();
    const moved = reparentNodeInTree(root, "team-fe", "dept-ops");
    const team = findNodeById(moved, "team-fe");
    expect(team?.parentId).toBe("dept-ops");
  });
});
