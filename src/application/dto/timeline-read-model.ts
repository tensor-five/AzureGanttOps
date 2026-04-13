import type { MappingValidationIssue } from "../../domain/mapping/mapping-errors.js";
import type { IngestionQueryType } from "./ingestion-snapshot.js";

export type TimelineTreeNodeMeta = {
  depth: number;
  parentWorkItemId: number | null;
  hasChildren: boolean;
  isLastSibling: boolean;
  ancestorIsLastSibling: boolean[];
};

export type TimelineStateBadge = {
  code: string;
  badge: string;
  color: string;
};

export type TimelineBar = {
  workItemId: number;
  title: string;
  state: TimelineStateBadge;
  schedule: {
    startDate: string | null;
    endDate: string | null;
    missingBoundary: "start" | "end" | null;
  };
  details: {
    mappedId: string;
    descriptionHtml?: string | null;
    workItemType?: string | null;
    fieldValues?: Record<string, string | number | null>;
    assignedTo?: string | null;
    parentWorkItemId?: number | null;
  };
};

export type TimelineUnschedulableItem = {
  workItemId: number;
  title: string;
  state: TimelineStateBadge;
  schedule?: {
    startDate: string | null;
    endDate: string | null;
    missingBoundary: "start" | "end" | null;
  };
  details: {
    mappedId: string;
    descriptionHtml?: string | null;
    workItemType?: string | null;
    fieldValues?: Record<string, string | number | null>;
    assignedTo?: string | null;
    parentWorkItemId?: number | null;
  };
  reason: "missing-both-dates";
};

export type TimelineDependencyArrow = {
  predecessorWorkItemId: number;
  successorWorkItemId: number;
  dependencyType: "FS";
  label: string;
};

export type SuppressedTimelineDependency = {
  predecessorWorkItemId: number;
  successorWorkItemId: number;
  dependencyType: "FS";
  reason: "unschedulable-endpoint";
};

export type MappingValidationResult =
  | {
      status: "valid";
      issues: [];
    }
  | {
      status: "invalid";
      issues: MappingValidationIssue[];
    };

export type TimelineReadModel = {
  queryType: IngestionQueryType;
  bars: TimelineBar[];
  unschedulable: TimelineUnschedulableItem[];
  dependencies: TimelineDependencyArrow[];
  suppressedDependencies: SuppressedTimelineDependency[];
  mappingValidation: MappingValidationResult;
  treeLayout: Record<string, TimelineTreeNodeMeta> | null;
};
