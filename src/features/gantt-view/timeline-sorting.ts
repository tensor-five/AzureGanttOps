import type { TimelineReadModel, TimelineBar, TimelineUnschedulableItem, TimelineTreeNodeMeta } from "../../application/dto/timeline-read-model.js";
import type { TimelineSortDirection, TimelineSortField, TimelineSortPreference } from "./timeline-sort-preference.js";
import type { TreeLayout, TreeNodeMeta } from "../../domain/planning-model/tree-structure.js";
import { applyTreeLevelSorting } from "../../domain/planning-model/tree-level-sorting.js";

export type TimelineSortOption = {
  value: TimelineSortField;
  label: string;
  subtitle: string;
};

type TimelineSortableItem = TimelineBar | TimelineUnschedulableItem;
const DEFAULT_UNSCHEDULED_DURATION_DAYS = 14;
const MS_PER_DAY = 86_400_000;

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

  if (timeline.queryType === "flat" || !timeline.treeLayout) {
    const comparator = buildTimelineSortComparator(preference);
    const bars = [...timeline.bars].sort(comparator);
    const unschedulable = [...timeline.unschedulable].sort(comparator);

    return {
      ...timeline,
      bars,
      unschedulable
    };
  }

  return applyTreeLevelSortedTimeline(timeline, preference);
}

function applyTreeLevelSortedTimeline(
  timeline: TimelineReadModel,
  preference: TimelineSortPreference
): TimelineReadModel {
  const treeLayout = recordToTreeLayout(timeline.treeLayout!);
  const comparator = buildTimelineSortComparator(preference);

  const barResult = applyTreeLevelSorting(
    timeline.bars,
    treeLayout,
    comparator
  );

  const unschedulableResult = applyTreeLevelSorting(
    timeline.unschedulable,
    treeLayout,
    comparator
  );

  const mergedRecord: Record<string, TimelineTreeNodeMeta> = {};
  for (const [id, meta] of barResult.updatedLayout.metaByWorkItemId) {
    mergedRecord[String(id)] = toTimelineTreeNodeMeta(meta);
  }
  for (const [id, meta] of unschedulableResult.updatedLayout.metaByWorkItemId) {
    if (!(String(id) in mergedRecord)) {
      mergedRecord[String(id)] = toTimelineTreeNodeMeta(meta);
    }
  }

  return {
    ...timeline,
    bars: barResult.sortedItems,
    unschedulable: unschedulableResult.sortedItems,
    treeLayout: mergedRecord
  };
}

function recordToTreeLayout(record: Record<string, TimelineTreeNodeMeta>): TreeLayout {
  const orderedIds: number[] = [];

  const childrenByParent = new Map<number | null, number[]>();
  for (const idStr of Object.keys(record)) {
    const id = Number(idStr);
    const node = record[idStr];
    const parentId = node.parentWorkItemId;
    const siblings = childrenByParent.get(parentId);
    if (siblings) {
      siblings.push(id);
    } else {
      childrenByParent.set(parentId, [id]);
    }
  }

  const visited = new Set<number>();
  const roots = childrenByParent.get(null) ?? [];
  const stack: number[] = [...roots].reverse();

  while (stack.length > 0) {
    const id = stack.pop()!;
    if (visited.has(id)) {
      continue;
    }
    visited.add(id);
    orderedIds.push(id);
    const children = childrenByParent.get(id);
    if (children) {
      for (let i = children.length - 1; i >= 0; i--) {
        stack.push(children[i]);
      }
    }
  }

  const metaByWorkItemId = new Map<number, TreeNodeMeta>();
  for (const idStr of Object.keys(record)) {
    const id = Number(idStr);
    const node = record[idStr];
    metaByWorkItemId.set(id, {
      workItemId: id,
      depth: node.depth,
      parentWorkItemId: node.parentWorkItemId,
      hasChildren: node.hasChildren,
      isLastSibling: node.isLastSibling,
      ancestorIsLastSibling: [...node.ancestorIsLastSibling]
    });
  }

  return { orderedIds, metaByWorkItemId };
}

function toTimelineTreeNodeMeta(meta: TreeNodeMeta): TimelineTreeNodeMeta {
  return {
    depth: meta.depth,
    parentWorkItemId: meta.parentWorkItemId,
    hasChildren: meta.hasChildren,
    isLastSibling: meta.isLastSibling,
    ancestorIsLastSibling: [...meta.ancestorIsLastSibling]
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
    const primaryResult = compareTimelineSortableValues(left, right, preference.primary, preference.primaryDirection);
    if (primaryResult !== 0) {
      return primaryResult;
    }

    if (preference.secondary) {
      const secondaryResult = compareTimelineSortableValues(left, right, preference.secondary, preference.secondaryDirection);
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
  field: TimelineSortField,
  direction: TimelineSortDirection
): number {
  const leftValue = extractSortValue(left, field);
  const rightValue = extractSortValue(right, field);
  const ascendingResult = compareSortValuesAscending(leftValue, rightValue);

  return direction === "desc" ? ascendingResult * -1 : ascendingResult;
}

function compareSortValuesAscending(leftValue: string | number | null, rightValue: string | number | null): number {
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
    return resolveStartDateSortTimestamp(item);
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

function resolveStartDateSortTimestamp(item: TimelineSortableItem): number | null {
  const startTimestamp = toTimestamp(item.schedule?.startDate);
  if (startTimestamp !== null) {
    return startTimestamp;
  }

  const endTimestamp = toTimestamp(item.schedule?.endDate);
  if (endTimestamp === null) {
    return null;
  }

  // Keep sorting aligned with chart rendering for half-open ranges (missing start -> 14-day assumed span).
  return endTimestamp - (DEFAULT_UNSCHEDULED_DURATION_DAYS - 1) * MS_PER_DAY;
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
