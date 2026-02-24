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

    act(() => {
      result.current.deleteNode(department!.id);
    });
    expect(
      findByName(result.current.currentWhiteboard!.rootNode, "Engineering & Platform")
    ).toBeNull();
  });
});
