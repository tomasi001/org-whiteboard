"use client";

import { useMemo, useState } from "react";
import { X, Plus, Trash2, Pencil, Check, ChevronRight } from "lucide-react";
import { useWhiteboard } from "@/contexts/WhiteboardContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/Card";
import type { NodeType, WhiteboardNode, WorkflowType } from "@/types";
import { hierarchyRules, nodeTypeLabels } from "@/lib/hierarchy";

const workflowTypes: { type: WorkflowType; label: string }[] = [
  { type: "agentic", label: "Agentic" },
  { type: "linear", label: "Linear" },
];

function collectNodes(root: WhiteboardNode): WhiteboardNode[] {
  const result: WhiteboardNode[] = [];

  const visit = (node: WhiteboardNode) => {
    result.push(node);
    node.children.forEach(visit);
  };

  visit(root);
  return result;
}

function collectDescendantIds(node: WhiteboardNode, acc: Set<string>) {
  for (const child of node.children) {
    acc.add(child.id);
    collectDescendantIds(child, acc);
  }
}

export function NodePanel() {
  const {
    currentWhiteboard,
    selectedNode,
    breadcrumbs,
    createNode,
    updateNode,
    moveNode,
    deleteNode,
    selectNode,
  } = useWhiteboard();

  const [isAddingNode, setIsAddingNode] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

  const [newNodeName, setNewNodeName] = useState("");
  const [newNodeDescription, setNewNodeDescription] = useState("");
  const [newNodeType, setNewNodeType] = useState<NodeType>("department");
  const [newNodeWorkflowType, setNewNodeWorkflowType] = useState<WorkflowType | "">("");
  const [newNodeDepartmentHead, setNewNodeDepartmentHead] = useState("");

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDepartmentHead, setEditDepartmentHead] = useState("");
  const [editWorkflowType, setEditWorkflowType] = useState<WorkflowType | "">("");
  const [editDocumentationUrl, setEditDocumentationUrl] = useState("");
  const [editParentId, setEditParentId] = useState("");

  const currentNode = selectedNode || breadcrumbs[breadcrumbs.length - 1];

  const validChildTypes = useMemo(() => {
    if (!currentNode) return [];
    return hierarchyRules[currentNode.type] || [];
  }, [currentNode]);

  const defaultChildType = validChildTypes[0] || "department";
  const isEditingNode = selectedNode ? editingNodeId === selectedNode.id : false;

  const parentOptions = useMemo(() => {
    if (!selectedNode || !currentWhiteboard) return [];
    if (selectedNode.id === currentWhiteboard.rootNode.id) return [];

    const allNodes = collectNodes(currentWhiteboard.rootNode);
    const descendantIds = new Set<string>();
    collectDescendantIds(selectedNode, descendantIds);

    return allNodes
      .filter((node) => {
        if (node.id === selectedNode.id) return false;
        if (descendantIds.has(node.id)) return false;
        return hierarchyRules[node.type]?.includes(selectedNode.type);
      })
      .map((node) => ({
        id: node.id,
        name: node.name,
        typeLabel: nodeTypeLabels[node.type],
      }));
  }, [selectedNode, currentWhiteboard]);

  const handleOpenAddNode = () => {
    setNewNodeType(defaultChildType);
    setIsAddingNode(true);
    setEditingNodeId(null);
  };

  const handleAddNode = () => {
    if (!newNodeName.trim()) return;

    createNode({
      type: newNodeType,
      name: newNodeName.trim(),
      description: newNodeDescription.trim() || undefined,
      parentId: currentNode?.id,
      departmentHead: newNodeDepartmentHead.trim() || undefined,
      workflowType: newNodeWorkflowType || undefined,
    });

    setNewNodeName("");
    setNewNodeDescription("");
    setNewNodeWorkflowType("");
    setNewNodeDepartmentHead("");
    setIsAddingNode(false);
  };

  const handleSaveNode = () => {
    if (!selectedNode) return;
    if (!editName.trim()) return;

    updateNode({
      id: selectedNode.id,
      name: editName.trim(),
      description: editDescription.trim() || undefined,
      departmentHead:
        selectedNode.type === "department"
          ? editDepartmentHead.trim() || undefined
          : undefined,
      workflowType:
        selectedNode.type === "workflow" || selectedNode.type === "process"
          ? editWorkflowType || undefined
          : undefined,
      documentationUrl: editDocumentationUrl.trim() || undefined,
    });

    if (
      currentWhiteboard &&
      selectedNode.id !== currentWhiteboard.rootNode.id &&
      editParentId &&
      editParentId !== selectedNode.parentId
    ) {
      moveNode(selectedNode.id, editParentId);
    }

    setEditingNodeId(null);
  };

  const handleStartEditing = () => {
    if (!selectedNode) return;

    setEditName(selectedNode.name);
    setEditDescription(selectedNode.description ?? "");
    setEditDepartmentHead(selectedNode.departmentHead ?? "");
    setEditWorkflowType(selectedNode.workflowType ?? "");
    setEditDocumentationUrl(selectedNode.documentationUrl ?? "");
    setEditParentId(selectedNode.parentId ?? "");
    setEditingNodeId(selectedNode.id);
  };

  const handleDeleteNode = () => {
    if (!selectedNode) return;

    if (!confirm(`Delete \"${selectedNode.name}\" and all nested items?`)) {
      return;
    }

    deleteNode(selectedNode.id);
  };

  if (!currentNode) {
    return null;
  }

  return (
    <div className="w-80 bg-black/20 backdrop-blur-md border-l border-white/20 flex flex-col">
      <div className="p-4 border-b border-white/20">
        <div className="flex items-center justify-between">
          <h2 className="font-roundo lowercase tracking-wide text-cardzzz-cream">details</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleOpenAddNode}
              disabled={validChildTypes.length === 0}
              title={
                validChildTypes.length === 0 ? "No more items can be added here" : "Add new node"
              }
            >
              <Plus className="w-4 h-4" />
            </Button>
            {selectedNode && (
              <Button
                variant="ghost"
                size="icon"
                title="Clear selection"
                onClick={() => {
                  setEditingNodeId(null);
                  selectNode(null);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isAddingNode && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Add New Item</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-satoshi text-cardzzz-cream">Type</label>
                <select
                  value={newNodeType}
                  onChange={(event) => setNewNodeType(event.target.value as NodeType)}
                  className="w-full mt-1 h-[54px] px-3 rounded-[16.168px] border border-white/20 bg-black/20 backdrop-blur-md text-sm text-cardzzz-cream focus:outline-none focus:ring-2 focus:ring-cardzzz-cream/70"
                >
                  {validChildTypes.map((type) => (
                    <option key={type} value={type}>
                      {nodeTypeLabels[type]}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-cardzzz-cream/75 mt-1 font-satoshi">
                  Adding to: {nodeTypeLabels[currentNode?.type] || "Root"}
                </p>
              </div>
              <div>
                <label className="text-sm font-satoshi text-cardzzz-cream">Name</label>
                <Input
                  value={newNodeName}
                  onChange={(event) => setNewNodeName(event.target.value)}
                  placeholder="Enter name"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-satoshi text-cardzzz-cream">Description</label>
                <Input
                  value={newNodeDescription}
                  onChange={(event) => setNewNodeDescription(event.target.value)}
                  placeholder="Optional description"
                  className="mt-1"
                />
              </div>
              {newNodeType === "department" && (
                <div>
                  <label className="text-sm font-satoshi text-cardzzz-cream">Department Head</label>
                  <Input
                    value={newNodeDepartmentHead}
                    onChange={(event) => setNewNodeDepartmentHead(event.target.value)}
                    placeholder="Enter department head name"
                    className="mt-1"
                  />
                </div>
              )}
              {(newNodeType === "workflow" || newNodeType === "process") && (
                <div>
                  <label className="text-sm font-satoshi text-cardzzz-cream">Workflow Type</label>
                  <select
                    value={newNodeWorkflowType}
                    onChange={(event) =>
                      setNewNodeWorkflowType(event.target.value as WorkflowType | "")
                    }
                    className="w-full mt-1 h-[54px] px-3 rounded-[16.168px] border border-white/20 bg-black/20 backdrop-blur-md text-sm text-cardzzz-cream focus:outline-none focus:ring-2 focus:ring-cardzzz-cream/70"
                  >
                    <option value="">Select type</option>
                    {workflowTypes.map(({ type, label }) => (
                      <option key={type} value={type}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </CardContent>
            <CardFooter className="gap-2">
              <Button onClick={handleAddNode} className="flex-1">
                Add
              </Button>
              <Button variant="outline" onClick={() => setIsAddingNode(false)}>
                <X className="w-4 h-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {selectedNode && !isAddingNode && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base break-words">{selectedNode.name}</CardTitle>
                <div className="flex items-center gap-1">
                  {!isEditingNode ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={handleStartEditing}>
                        <Pencil className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      {validChildTypes.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={handleOpenAddNode}>
                          <Plus className="w-4 h-4 mr-1" />
                          Add
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={handleSaveNode}>
                      <Check className="w-4 h-4 mr-1" />
                      Save
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {isEditingNode ? (
                <>
                  <div>
                    <label className="text-sm font-satoshi text-cardzzz-cream">Name</label>
                    <Input
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-satoshi text-cardzzz-cream">Description</label>
                    <textarea
                      value={editDescription}
                      onChange={(event) => setEditDescription(event.target.value)}
                      rows={3}
                      className="w-full mt-1 px-3 py-2 rounded-[16.168px] border border-white/20 bg-black/20 backdrop-blur-md text-sm text-cardzzz-cream placeholder:text-cardzzz-cream/60 caret-cardzzz-cream focus:outline-none focus:ring-2 focus:ring-cardzzz-cream/70"
                    />
                  </div>

                  {selectedNode.type === "department" && (
                    <div>
                      <label className="text-sm font-satoshi text-cardzzz-cream">Department Head</label>
                      <Input
                        value={editDepartmentHead}
                        onChange={(event) => setEditDepartmentHead(event.target.value)}
                        className="mt-1"
                      />
                    </div>
                  )}

                  {(selectedNode.type === "workflow" || selectedNode.type === "process") && (
                    <div>
                      <label className="text-sm font-satoshi text-cardzzz-cream">Workflow Type</label>
                      <select
                        value={editWorkflowType}
                        onChange={(event) =>
                          setEditWorkflowType(event.target.value as WorkflowType | "")
                        }
                        className="w-full mt-1 h-[54px] px-3 rounded-[16.168px] border border-white/20 bg-black/20 backdrop-blur-md text-sm text-cardzzz-cream focus:outline-none focus:ring-2 focus:ring-cardzzz-cream/70"
                      >
                        <option value="">Select type</option>
                        {workflowTypes.map(({ type, label }) => (
                          <option key={type} value={type}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-satoshi text-cardzzz-cream">Documentation URL</label>
                    <Input
                      value={editDocumentationUrl}
                      onChange={(event) => setEditDocumentationUrl(event.target.value)}
                      placeholder="https://..."
                      className="mt-1"
                    />
                  </div>

                  {selectedNode.id !== currentWhiteboard?.rootNode.id && (
                    <div>
                      <label className="text-sm font-satoshi text-cardzzz-cream">Parent relationship</label>
                      <select
                        value={editParentId}
                        onChange={(event) => setEditParentId(event.target.value)}
                        className="w-full mt-1 h-[54px] px-3 rounded-[16.168px] border border-white/20 bg-black/20 backdrop-blur-md text-sm text-cardzzz-cream focus:outline-none focus:ring-2 focus:ring-cardzzz-cream/70"
                      >
                        <option value="">Select parent</option>
                        {parentOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name} ({option.typeLabel})
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-cardzzz-cream/70 mt-1 font-satoshi">
                        Move this item under another valid parent.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <span className="text-xs font-satoshi text-cardzzz-cream/70 uppercase">Type</span>
                    <p className="text-sm text-cardzzz-cream capitalize font-satoshi">
                      {selectedNode.type}
                    </p>
                  </div>
                  {selectedNode.description && (
                    <div>
                      <span className="text-xs font-satoshi text-cardzzz-cream/70 uppercase">
                        Description
                      </span>
                      <p className="text-sm text-cardzzz-cream font-satoshi">
                        {selectedNode.description}
                      </p>
                    </div>
                  )}
                  {selectedNode.departmentHead && (
                    <div>
                      <span className="text-xs font-satoshi text-cardzzz-cream/70 uppercase">
                        Department Head
                      </span>
                      <p className="text-sm text-cardzzz-cream font-satoshi">
                        {selectedNode.departmentHead}
                      </p>
                    </div>
                  )}
                  {selectedNode.workflowType && (
                    <div>
                      <span className="text-xs font-satoshi text-cardzzz-cream/70 uppercase">
                        Workflow Type
                      </span>
                      <p className="text-sm text-cardzzz-cream capitalize font-satoshi">
                        {selectedNode.workflowType}
                      </p>
                    </div>
                  )}
                  {selectedNode.documentationUrl && (
                    <div>
                      <span className="text-xs font-satoshi text-cardzzz-cream/70 uppercase">
                        Documentation
                      </span>
                      <a
                        href={selectedNode.documentationUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-cardzzz-cream underline break-all font-satoshi"
                      >
                        {selectedNode.documentationUrl}
                      </a>
                    </div>
                  )}
                  {selectedNode.children.length > 0 && (
                    <div>
                      <span className="text-xs font-satoshi text-cardzzz-cream/70 uppercase">
                        Contains
                      </span>
                      <div className="mt-1 space-y-1">
                        {selectedNode.children.map((child) => (
                          <button
                            key={child.id}
                            type="button"
                            onClick={() => selectNode(child)}
                            className="w-full rounded-md border border-white/20 bg-black/20 px-2 py-1 text-left text-sm text-cardzzz-cream font-satoshi hover:bg-black/30 flex items-center justify-between"
                          >
                            <span className="truncate">{child.name}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-cardzzz-cream/70" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
            <CardFooter className="gap-2">
              {isEditingNode ? (
                <>
                  <Button onClick={handleSaveNode} className="flex-1">
                    Save Changes
                  </Button>
                  <Button variant="outline" onClick={() => setEditingNodeId(null)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button variant="destructive" onClick={handleDeleteNode} className="w-full">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              )}
            </CardFooter>
          </Card>
        )}

        {!selectedNode && !isAddingNode && (
          <div className="text-center py-8">
            <p className="text-cardzzz-cream/80 text-sm font-satoshi">
              Select an item to view details, or click + to add a new item.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
