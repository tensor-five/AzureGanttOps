import type { TimelineReadModel, TimelineBar, TimelineUnschedulableItem } from "../../application/dto/timeline-read-model.js";
import type { TimelineSortField, TimelineSortPreference } from "./timeline-sort-preference.js";

export type TimelineSortOption = {
  value: TimelineSortField;
  label: string;
  subtitle: string;
};

type TimelineSortableItem = TimelineBar | TimelineUnschedulableItem;

const BUILT_IN_SORT_OPTIONS: TimelineSortOption[] = [
  { value: "startDate", label: "Start date", subtitle: "Built-in" },
  { value: "endDate", label: "End date", subtitle: "Built-in" },
  { value: "title", label: "Title", subtitle: "Built-in" },
  { value: "mappedId", label: "ID", subtitle: "Built-in" },
  { value: "state", label: "State", subtitle: "Built-in" },
  { value: "assignedTo", label: "Assigned to", subtitle: "Built-in" },
  { value: "parentWorkItemId", label: "Parent ID", subtitle: "Built-in" }
];

const stringCollator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

export function applyTimelineSorting(
  timeline: TimelineReadModel | null,
  preference: TimelineSortPreference
): TimelineReadModel | null {
  if (!timeline) {
    return null;
  }

  const comparator = buildTimelineSortComparator(preference);
  const bars = [...timeline.bars].sort(comparator);
  const unschedulable = [...timeline.unschedulable].sort(comparator);

  return {
    ...timeline,
    bars,
    unschedulable
  };
}

export function buildTimelineSortOptions(availableFieldRefs: string[]): TimelineSortOption[] {
  const fieldOptions = availableFieldRefs.map((fieldRef) => ({
    value: `field:${fieldRef}` as const,
    label: getFieldDisplayName(fieldRef),
    subtitle: fieldRef
  }));

  return [...BUILT_IN_SORT_OPTIONS, ...fieldOptions];
}

export function resolveTimelineSortFieldLabel(field: TimelineSortField): string {
  const builtIn = BUILT_IN_SORT_OPTIONS.find((option) => option.value === field);
  if (builtIn) {
    return builtIn.label;
  }

  const fieldRef = field.slice("field:".length);
  return getFieldDisplayName(fieldRef);
}

function buildTimelineSortComparator(preference: TimelineSortPreference): (left: TimelineSortableItem, right: TimelineSortableItem) => number {
  return (left, right) => {
    const primaryResult = compareTimelineSortableValues(left, right, preference.primary);
    if (primaryResult !== 0) {
      return primaryResult;
    }

    if (preference.secondary) {
      const secondaryResult = compareTimelineSortableValues(left, right, preference.secondary);
      if (secondaryResult !== 0) {
        return secondaryResult;
      }
    }

    return left.workItemId - right.workItemId;
  };
}

function compareTimelineSortableValues(
  left: TimelineSortableItem,
  right: TimelineSortableItem,
  field: TimelineSortField
): number {
  const leftValue = extractSortValue(left, field);
  const rightValue = extractSortValue(right, field);

  if (leftValue === null && rightValue === null) {
    return 0;
  }

  if (leftValue === null) {
    return 1;
  }

  if (rightValue === null) {
    return -1;
  }

  if (typeof leftValue === "number" && typeof rightValue === "number") {
    return leftValue - rightValue;
  }

  return stringCollator.compare(String(leftValue), String(rightValue));
}

function extractSortValue(item: TimelineSortableItem, field: TimelineSortField): string | number | null {
  if (field === "startDate") {
    return toTimestamp(item.schedule?.startDate);
  }

  if (field === "endDate") {
    return toTimestamp(item.schedule?.endDate);
  }

  if (field === "title") {
    return normalizeString(item.title);
  }

  if (field === "mappedId") {
    return normalizeString(item.details.mappedId);
  }

  if (field === "state") {
    return normalizeString(item.state.code);
  }

  if (field === "assignedTo") {
    return normalizeString(item.details.assignedTo ?? null);
  }

  if (field === "parentWorkItemId") {
    const parentWorkItemId = item.details.parentWorkItemId;
    return typeof parentWorkItemId === "number" && Number.isFinite(parentWorkItemId) ? parentWorkItemId : null;
  }

  const fieldRef = field.slice("field:".length);
  const fieldValue = item.details.fieldValues?.[fieldRef];
  if (typeof fieldValue === "number" && Number.isFinite(fieldValue)) {
    return fieldValue;
  }
  return normalizeString(fieldValue ?? null);
}

function normalizeString(value: unknown): string | null {
  if (value === null || typeof value === "undefined") {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function toTimestamp(value: string | null | undefined): number | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getFieldDisplayName(fieldRef: string): string {
  const trimmed = fieldRef.trim();
  if (trimmed.length === 0) {
    return fieldRef;
  }

  const parts = trimmed.split(".");
  const lastPart = parts[parts.length - 1]?.trim();
  return lastPart && lastPart.length > 0 ? lastPart : trimmed;
}
