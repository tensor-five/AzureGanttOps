export type JsonPatchOp = "add" | "remove" | "replace" | "move" | "copy" | "test";

export type JsonPatchOperation = {
  op: JsonPatchOp;
  path: string;
  value?: unknown;
  from?: string;
};

export type WorkItemPatchCommand = {
  kind: "WORK_ITEM_PATCH";
  workItemId: number;
  operations: JsonPatchOperation[];
  expectedRevision?: number;
  validateOnly?: boolean;
};

export type DependencyLinkCommand = {
  kind: "DEPENDENCY_LINK";
  sourceId: number;
  targetId: number;
  relation: "System.LinkTypes.Dependency-Forward" | "System.LinkTypes.Dependency-Reverse";
  action: "add" | "remove";
};

export type HierarchyLinkCommand = {
  kind: "HIERARCHY_LINK";
  childWorkItemId: number;
  newParentWorkItemId: number | null;
  action: "reparent";
};

export type WorkItemDuplicateCommand = {
  kind: "WORK_ITEM_DUPLICATE";
  sourceWorkItemId: number;
};

export type WriteCommand = WorkItemPatchCommand | DependencyLinkCommand | HierarchyLinkCommand | WorkItemDuplicateCommand;

export type WriteCommandReasonCode = "WRITE_DISABLED" | "WRITE_ENABLED" | "WRITE_UNSUPPORTED";

export type WriteCommandResult = {
  accepted: boolean;
  mode: "NO_OP" | "EXECUTED";
  commandKind: WriteCommand["kind"];
  operationCount: number;
  reasonCode: WriteCommandReasonCode;
  createdWorkItemId?: number;
};
