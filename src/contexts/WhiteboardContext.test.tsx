import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { WhiteboardProvider, useWhiteboard } from "@/contexts/WhiteboardContext";
import type { WhiteboardNode } from "@/types";

function wrapper({ children }: { children: ReactNode }) {
  return <WhiteboardProvider>{children}</WhiteboardProvider>;
}

function findByName(node: WhiteboardNode, name: string): WhiteboardNode | null {
  if (node.name === name) return node;
  for (const child of node.children) {
    const found = findByName(child, name);
    if (found) return found;
  }
  return null;
}

describe("WhiteboardContext", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("creates a whiteboard and supports CRUD operations", () => {
    const { result } = renderHook(() => useWhiteboard(), { wrapper });

    act(() => {
      result.current.createWhiteboard("Acme Org", "Testing structure");
    });

    expect(result.current.currentWhiteboard?.name).toBe("Acme Org");
    expect(result.current.breadcrumbs).toHaveLength(1);

    const rootId = result.current.currentWhiteboard!.rootNode.id;
    act(() => {
      result.current.createNode({
        parentId: rootId,
        type: "department",
        name: "Engineering",
      });
      result.current.createNode({
        parentId: rootId,
        type: "department",
        name: "Operations",
      });
    });

    const department = findByName(
      result.current.currentWhiteboard!.rootNode,
      "Engineering"
    );
    expect(department).not.toBeNull();

    act(() => {
      result.current.selectNode(department);
    });
    expect(result.current.selectedNode?.name).toBe("Engineering");

    act(() => {
      result.current.updateNode({
        id: department!.id,
        name: "Engineering & Platform",
      });
    });
    expect(
      findByName(result.current.currentWhiteboard!.rootNode, "Engineering & Platform")
    ).not.toBeNull();

    const operations = findByName(result.current.currentWhiteboard!.rootNode, "Operations");
    act(() => {
      result.current.createNode({
        parentId: department!.id,
        type: "team",
        name: "Frontend",
      });
    });

    const frontendTeam = findByName(result.current.currentWhiteboard!.rootNode, "Frontend");
    expect(frontendTeam?.parentId).toBe(department!.id);

    act(() => {
      result.current.moveNode(frontendTeam!.id, operations!.id);
    });

    const movedFrontend = findByName(result.current.currentWhiteboard!.rootNode, "Frontend");
    expect(movedFrontend?.parentId).toBe(operations!.id);

    act(() => {
      result.current.deleteNode(department!.id);
    });
    expect(
      findByName(result.current.currentWhiteboard!.rootNode, "Engineering & Platform")
    ).toBeNull();
  });

  it("supports dashboard history and board switching", () => {
    const { result } = renderHook(() => useWhiteboard(), { wrapper });

    act(() => {
      result.current.createWhiteboard("Board One");
    });
    const firstId = result.current.currentWhiteboard!.id;

    act(() => {
      result.current.createWhiteboard("Board Two");
    });
    const secondId = result.current.currentWhiteboard!.id;

    expect(result.current.whiteboards).toHaveLength(2);
    expect(result.current.currentWhiteboard?.id).toBe(secondId);

    act(() => {
      result.current.openWhiteboard(firstId);
    });
    expect(result.current.currentWhiteboard?.id).toBe(firstId);

    act(() => {
      result.current.deleteWhiteboard(secondId);
    });
    expect(result.current.whiteboards).toHaveLength(1);
    expect(result.current.whiteboards[0].id).toBe(firstId);
  });

  it("creates and opens a nested automation board", () => {
    const { result } = renderHook(() => useWhiteboard(), { wrapper });

    act(() => {
      result.current.createWhiteboard("Automation Test Org");
    });

    const rootId = result.current.currentWhiteboard!.rootNode.id;
    act(() => {
      result.current.createNode({ parentId: rootId, type: "department", name: "Ops" });
    });

    const department = findByName(result.current.currentWhiteboard!.rootNode, "Ops")!;
    act(() => {
      result.current.createNode({ parentId: department.id, type: "team", name: "Delivery" });
    });

    const team = findByName(result.current.currentWhiteboard!.rootNode, "Delivery")!;
    act(() => {
      result.current.createNode({ parentId: team.id, type: "agent", name: "Lead Router" });
    });

    const agent = findByName(result.current.currentWhiteboard!.rootNode, "Lead Router")!;
    act(() => {
      result.current.createNode({
        parentId: agent.id,
        type: "automation",
        name: "Lead Qualification",
      });
    });

    const automation = findByName(result.current.currentWhiteboard!.rootNode, "Lead Qualification")!;
    act(() => {
      result.current.openAutomationBoard(automation.id);
    });

    expect(result.current.currentWhiteboard?.kind).toBe("automation");
    expect(result.current.whiteboards).toHaveLength(2);

    act(() => {
      result.current.returnToParentBoard();
    });

    expect(result.current.currentWhiteboard?.kind).toBe("organisation");
  });

  it("deletes linked automation boards when an automation node is removed", () => {
    const { result } = renderHook(() => useWhiteboard(), { wrapper });

    act(() => {
      result.current.createWhiteboard("Automation Cleanup Org");
    });

    const rootId = result.current.currentWhiteboard!.rootNode.id;
    act(() => {
      result.current.createNode({ parentId: rootId, type: "department", name: "Ops" });
    });

    const department = findByName(result.current.currentWhiteboard!.rootNode, "Ops")!;
    act(() => {
      result.current.createNode({ parentId: department.id, type: "team", name: "Delivery" });
    });

    const team = findByName(result.current.currentWhiteboard!.rootNode, "Delivery")!;
    act(() => {
      result.current.createNode({ parentId: team.id, type: "agent", name: "Router Agent" });
    });

    const agent = findByName(result.current.currentWhiteboard!.rootNode, "Router Agent")!;
    act(() => {
      result.current.createNode({
        parentId: agent.id,
        type: "automation",
        name: "Qualification Automation",
      });
    });

    const automation = findByName(
      result.current.currentWhiteboard!.rootNode,
      "Qualification Automation"
    )!;

    act(() => {
      result.current.openAutomationBoard(automation.id);
      result.current.returnToParentBoard();
    });

    expect(result.current.whiteboards).toHaveLength(2);

    act(() => {
      result.current.deleteNode(automation.id);
    });

    expect(result.current.whiteboards).toHaveLength(1);
    expect(
      findByName(result.current.currentWhiteboard!.rootNode, "Qualification Automation")
    ).toBeNull();
  });

  it("cascades board deletion to nested automation boards", () => {
    const { result } = renderHook(() => useWhiteboard(), { wrapper });

    act(() => {
      result.current.createWhiteboard("Cascade Delete Org");
    });

    const parentId = result.current.currentWhiteboard!.id;
    const rootId = result.current.currentWhiteboard!.rootNode.id;
    act(() => {
      result.current.createNode({ parentId: rootId, type: "department", name: "Ops" });
    });

    const department = findByName(result.current.currentWhiteboard!.rootNode, "Ops")!;
    act(() => {
      result.current.createNode({ parentId: department.id, type: "team", name: "Delivery" });
    });

    const team = findByName(result.current.currentWhiteboard!.rootNode, "Delivery")!;
    act(() => {
      result.current.createNode({ parentId: team.id, type: "agent", name: "Router Agent" });
    });

    const agent = findByName(result.current.currentWhiteboard!.rootNode, "Router Agent")!;
    act(() => {
      result.current.createNode({
        parentId: agent.id,
        type: "automation",
        name: "Qualification Automation",
      });
    });

    const automation = findByName(
      result.current.currentWhiteboard!.rootNode,
      "Qualification Automation"
    )!;

    act(() => {
      result.current.openAutomationBoard(automation.id);
    });

    expect(result.current.whiteboards).toHaveLength(2);
    expect(result.current.currentWhiteboard?.kind).toBe("automation");

    act(() => {
      result.current.deleteWhiteboard(parentId);
    });

    expect(result.current.whiteboards).toHaveLength(0);
    expect(result.current.currentWhiteboard).toBeNull();
  });
});
