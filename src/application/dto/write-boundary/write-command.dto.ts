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
  scheduleFieldRefs?: {
    start: string;
    endOrTarget: string;
  };
};

export type WorkItemChildCreateCommand = {
  kind: "WORK_ITEM_CHILD_CREATE";
  parentWorkItemId: number;
  title?: string;
  scheduleFieldRefs?: {
    start: string;
    endOrTarget: string;
  };
};

export type WriteCommand =
  | WorkItemPatchCommand
  | DependencyLinkCommand
  | HierarchyLinkCommand
  | WorkItemDuplicateCommand
  | WorkItemChildCreateCommand;

export type WriteCommandReasonCode =
  | "WRITE_DISABLED"
  | "WRITE_ENABLED"
  | "WRITE_UNSUPPORTED"
  | "WORK_ITEM_CHILD_TYPE_UNSUPPORTED";

export type CreatedWorkItemSnapshot = {
  id: number;
  title?: string | null;
  state?: string | null;
  descriptionHtml?: string | null;
  workItemType?: string | null;
  assignedTo?: string | null;
  fieldValues?: Record<string, string | number | null>;
  parentWorkItemId?: number | null;
  schedule?: {
    startDate?: string | null;
    endDate?: string | null;
  };
};

export type WriteCommandResult = {
  accepted: boolean;
  mode: "NO_OP" | "EXECUTED";
  commandKind: WriteCommand["kind"];
  operationCount: number;
  reasonCode: WriteCommandReasonCode;
  createdWorkItemId?: number;
  createdWorkItem?: CreatedWorkItemSnapshot;
};
