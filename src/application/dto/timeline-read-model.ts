import type { MappingValidationIssue } from "../../domain/mapping/mapping-errors.js";

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
  bars: TimelineBar[];
  unschedulable: TimelineUnschedulableItem[];
  dependencies: TimelineDependencyArrow[];
  suppressedDependencies: SuppressedTimelineDependency[];
  mappingValidation: MappingValidationResult;
};
