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

export type WriteCommand = WorkItemPatchCommand | DependencyLinkCommand;

export type WriteCommandResult = {
  accepted: boolean;
  mode: "NO_OP" | "EXECUTED";
  commandKind: WriteCommand["kind"];
  operationCount: number;
  reasonCode: "WRITE_DISABLED" | "WRITE_ENABLED";
};
