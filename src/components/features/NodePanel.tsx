"use client";

import { useState, useMemo } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { useWhiteboard } from "@/contexts/WhiteboardContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/Card";
import type { NodeType, WorkflowType } from "@/types";
import { hierarchyRules, nodeTypeLabels } from "@/lib/hierarchy";

const workflowTypes: { type: WorkflowType; label: string }[] = [
  { type: "agentic", label: "Agentic" },
  { type: "linear", label: "Linear" },
];

export function NodePanel() {
  const { selectedNode, breadcrumbs, createNode, deleteNode } = useWhiteboard();
  const [isAddingNode, setIsAddingNode] = useState(false);
  const [newNodeName, setNewNodeName] = useState("");
  const [newNodeDescription, setNewNodeDescription] = useState("");
  const [newNodeType, setNewNodeType] = useState<NodeType>("department");
  const [newNodeWorkflowType, setNewNodeWorkflowType] = useState<WorkflowType | "">("");
  const [newNodeDepartmentHead, setNewNodeDepartmentHead] = useState("");

  // Use selected node if available, otherwise use current breadcrumb
  const currentNode = selectedNode || breadcrumbs[breadcrumbs.length - 1];

  // Get valid child types based on current node type
  const validChildTypes = useMemo(() => {
    if (!currentNode) return [];
    return hierarchyRules[currentNode.type] || [];
  }, [currentNode]);

  // Get the default child type
  const defaultChildType = validChildTypes[0] || "department";

  const handleOpenAddNode = () => {
    setNewNodeType(defaultChildType);
    setIsAddingNode(true);
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

  const handleDeleteNode = () => {
    if (selectedNode) {
      deleteNode(selectedNode.id);
    }
  };

  if (!currentNode) {
    return null;
  }

  return (
    <div className="w-80 bg-white border-l border-slate-200 flex flex-col">
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Details</h2>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleOpenAddNode}
            disabled={validChildTypes.length === 0}
            title={validChildTypes.length === 0 ? "No more items can be added here" : "Add new node"}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {/* Add New Node Form */}
        {isAddingNode && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Add New Item</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Type</label>
                <select
                  value={newNodeType}
                  onChange={(e) => setNewNodeType(e.target.value as NodeType)}
                  className="w-full mt-1 h-10 px-3 rounded-md border border-slate-300 bg-white text-sm"
                >
                  {validChildTypes.map((type) => (
                    <option key={type} value={type}>{nodeTypeLabels[type]}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Adding to: {nodeTypeLabels[currentNode?.type] || 'Root'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Name</label>
                <Input
                  value={newNodeName}
                  onChange={(e) => setNewNodeName(e.target.value)}
                  placeholder="Enter name"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Description</label>
                <Input
                  value={newNodeDescription}
                  onChange={(e) => setNewNodeDescription(e.target.value)}
                  placeholder="Optional description"
                  className="mt-1"
                />
              </div>
              {newNodeType === "department" && (
                <div>
                  <label className="text-sm font-medium text-slate-700">Department Head</label>
                  <Input
                    value={newNodeDepartmentHead}
                    onChange={(e) => setNewNodeDepartmentHead(e.target.value)}
                    placeholder="Enter department head name"
                    className="mt-1"
                  />
                </div>
              )}
              {(newNodeType === "workflow" || newNodeType === "process") && (
                <div>
                  <label className="text-sm font-medium text-slate-700">Workflow Type</label>
                  <select
                    value={newNodeWorkflowType}
                    onChange={(e) => setNewNodeWorkflowType(e.target.value as WorkflowType | "")}
                    className="w-full mt-1 h-10 px-3 rounded-md border border-slate-300 bg-white text-sm"
                  >
                    <option value="">Select type</option>
                    {workflowTypes.map(({ type, label }) => (
                      <option key={type} value={type}>{label}</option>
                    ))}
                  </select>
                </div>
              )}
            </CardContent>
            <CardFooter className="gap-2">
              <Button onClick={handleAddNode} className="flex-1">Add</Button>
              <Button variant="outline" onClick={() => setIsAddingNode(false)}>
                <X className="w-4 h-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Selected Node Details */}
        {selectedNode && !isAddingNode && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{selectedNode.name}</CardTitle>
                {validChildTypes.length > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handleOpenAddNode}
                    className="text-sm"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <span className="text-xs font-medium text-slate-500 uppercase">Type</span>
                <p className="text-sm text-slate-800 capitalize">{selectedNode.type}</p>
              </div>
              {selectedNode.description && (
                <div>
                  <span className="text-xs font-medium text-slate-500 uppercase">Description</span>
                  <p className="text-sm text-slate-800">{selectedNode.description}</p>
                </div>
              )}
              {selectedNode.departmentHead && (
                <div>
                  <span className="text-xs font-medium text-slate-500 uppercase">Department Head</span>
                  <p className="text-sm text-slate-800">{selectedNode.departmentHead}</p>
                </div>
              )}
              {selectedNode.workflowType && (
                <div>
                  <span className="text-xs font-medium text-slate-500 uppercase">Workflow Type</span>
                  <p className="text-sm text-slate-800 capitalize">{selectedNode.workflowType}</p>
                </div>
              )}
              {selectedNode.children.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-slate-500 uppercase">Contains</span>
                  <p className="text-sm text-slate-800">
                    {selectedNode.children.length} {selectedNode.children.length === 1 ? "item" : "items"}
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button variant="destructive" onClick={handleDeleteNode} className="w-full">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Current Level Info */}
        {!selectedNode && !isAddingNode && (
          <div className="text-center py-8">
            <p className="text-slate-500 text-sm">
              Select an item to view details, or click the + button to add a new item.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
