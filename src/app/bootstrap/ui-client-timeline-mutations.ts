import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";
import type {
  TimelineBar,
  TimelineTreeNodeMeta,
  TimelineUnschedulableItem
} from "../../application/dto/timeline-read-model.js";
import type { CreatedWorkItemSnapshot } from "../../application/dto/write-boundary/write-command.dto.js";
import { applyAdoptedSchedules } from "../../features/gantt-view/timeline-pane.js";
import { buildTreeLayoutFromParentMap } from "../../domain/planning-model/tree-structure.js";

export function applyScheduleUpdate(
  timeline: QueryIntakeResponse["timeline"],
  targetWorkItemId: number,
  startDate: string,
  endDate: string
): QueryIntakeResponse["timeline"] {
  const adopted = applyAdoptedSchedules(timeline, {
    [targetWorkItemId]: { startDate, endDate }
  });
  if (!adopted) {
    return adopted;
  }

  return {
    ...adopted,
    bars: adopted.bars.map((bar) =>
      bar.workItemId === targetWorkItemId
        ? {
            ...bar,
            schedule: {
              startDate,
              endDate,
              missingBoundary: null
            }
          }
        : bar
    )
  };
}

export function applyWorkItemMetadataUpdate(
  timeline: QueryIntakeResponse["timeline"],
  targetWorkItemId: number,
  title: string,
  descriptionHtml: string,
  stateCode: string,
  stateColor: string | null
): QueryIntakeResponse["timeline"] {
  if (!timeline) {
    return timeline;
  }

  const nextState = toTimelineStateBadge(stateCode, stateColor);

  return {
    ...timeline,
    bars: timeline.bars.map((bar) =>
      bar.workItemId === targetWorkItemId
        ? {
            ...bar,
            title,
            state: nextState,
            details: {
              ...bar.details,
              descriptionHtml
            }
          }
        : bar
    ),
    unschedulable: timeline.unschedulable.map((item) =>
      item.workItemId === targetWorkItemId
        ? {
            ...item,
            title,
            state: nextState,
            details: {
              ...item.details,
              descriptionHtml
            }
          }
        : item
    )
  };
}

export function applyWorkItemStateUpdate(
  timeline: QueryIntakeResponse["timeline"],
  targetWorkItemId: number,
  stateCode: string,
  stateColor: string | null
): QueryIntakeResponse["timeline"] {
  if (!timeline) {
    return timeline;
  }

  const nextState = toTimelineStateBadge(stateCode, stateColor);

  return {
    ...timeline,
    bars: timeline.bars.map((bar) =>
      bar.workItemId === targetWorkItemId
        ? {
            ...bar,
            state: nextState
          }
        : bar
    ),
    unschedulable: timeline.unschedulable.map((item) =>
      item.workItemId === targetWorkItemId
        ? {
            ...item,
            state: nextState
          }
        : item
    )
  };
}

export function applyDependencyLinkUpdate(
  timeline: QueryIntakeResponse["timeline"],
  predecessorWorkItemId: number,
  successorWorkItemId: number,
  action: "add" | "remove"
): QueryIntakeResponse["timeline"] {
  if (!timeline) {
    return timeline;
  }

  if (action === "remove") {
    return {
      ...timeline,
      dependencies: timeline.dependencies.filter(
        (dependency) =>
          !(
            dependency.predecessorWorkItemId === predecessorWorkItemId &&
            dependency.successorWorkItemId === successorWorkItemId &&
            dependency.dependencyType === "FS"
          )
      )
    };
  }

  const alreadyExists = timeline.dependencies.some(
    (dependency) =>
      dependency.predecessorWorkItemId === predecessorWorkItemId &&
      dependency.successorWorkItemId === successorWorkItemId &&
      dependency.dependencyType === "FS"
  );
  if (alreadyExists) {
    return timeline;
  }

  return {
    ...timeline,
    dependencies: [
      ...timeline.dependencies,
      {
        predecessorWorkItemId,
        successorWorkItemId,
        dependencyType: "FS",
        label: `#${predecessorWorkItemId} [end] -> #${successorWorkItemId} [start]`
      }
    ],
    suppressedDependencies: timeline.suppressedDependencies.filter(
      (dependency) =>
        !(
          dependency.predecessorWorkItemId === predecessorWorkItemId &&
          dependency.successorWorkItemId === successorWorkItemId &&
          dependency.dependencyType === "FS"
        )
    )
  };
}

export function applyDuplicateWorkItemToResponse(
  response: QueryIntakeResponse | null,
  sourceWorkItemId: number,
  createdWorkItem: CreatedWorkItemSnapshot
): QueryIntakeResponse | null {
  if (!response) {
    return response;
  }

  const timeline = applyDuplicateWorkItemUpdate(response.timeline, sourceWorkItemId, createdWorkItem);
  if (timeline === response.timeline) {
    return response;
  }

  return {
    ...response,
    workItemIds: response.workItemIds.includes(createdWorkItem.id)
      ? response.workItemIds
      : [...response.workItemIds, createdWorkItem.id],
    timeline
  };
}

export function applyDuplicateWorkItemUpdate(
  timeline: QueryIntakeResponse["timeline"],
  sourceWorkItemId: number,
  createdWorkItem: CreatedWorkItemSnapshot
): QueryIntakeResponse["timeline"] {
  if (!timeline || !Number.isFinite(createdWorkItem.id) || createdWorkItem.id <= 0) {
    return timeline;
  }

  const alreadyVisible = timeline.bars.some((bar) => bar.workItemId === createdWorkItem.id) ||
    timeline.unschedulable.some((item) => item.workItemId === createdWorkItem.id);
  if (alreadyVisible) {
    return timeline;
  }

  const sourceBarIndex = timeline.bars.findIndex((bar) => bar.workItemId === sourceWorkItemId);
  if (sourceBarIndex !== -1) {
    const sourceBar = timeline.bars[sourceBarIndex];
    if (!sourceBar) {
      return timeline;
    }

    const nextTimeline = {
      ...timeline,
      bars: insertAfter(timeline.bars, sourceBarIndex, buildDuplicateBar(sourceBar, createdWorkItem))
    };
    return rebuildTreeLayoutWhenNeeded(nextTimeline);
  }

  const sourceUnschedulableIndex = timeline.unschedulable.findIndex((item) => item.workItemId === sourceWorkItemId);
  if (sourceUnschedulableIndex === -1) {
    return timeline;
  }

  const sourceUnschedulable = timeline.unschedulable[sourceUnschedulableIndex];
  if (!sourceUnschedulable) {
    return timeline;
  }

  const nextTimeline = {
    ...timeline,
    unschedulable: insertAfter(
      timeline.unschedulable,
      sourceUnschedulableIndex,
      buildDuplicateUnschedulableItem(sourceUnschedulable, createdWorkItem)
    )
  };
  return rebuildTreeLayoutWhenNeeded(nextTimeline);
}

export function applyCreatedChildWorkItemToResponse(
  response: QueryIntakeResponse | null,
  parentWorkItemId: number,
  createdWorkItem: CreatedWorkItemSnapshot
): QueryIntakeResponse | null {
  if (!response) {
    return response;
  }

  const timeline = applyCreatedChildWorkItemUpdate(response.timeline, parentWorkItemId, createdWorkItem);
  if (timeline === response.timeline) {
    return response;
  }

  return {
    ...response,
    workItemIds: response.workItemIds.includes(createdWorkItem.id)
      ? response.workItemIds
      : [...response.workItemIds, createdWorkItem.id],
    timeline
  };
}

export function applyCreatedChildWorkItemUpdate(
  timeline: QueryIntakeResponse["timeline"],
  parentWorkItemId: number,
  createdWorkItem: CreatedWorkItemSnapshot
): QueryIntakeResponse["timeline"] {
  if (!timeline || !Number.isFinite(createdWorkItem.id) || createdWorkItem.id <= 0) {
    return timeline;
  }

  const alreadyVisible = timeline.bars.some((bar) => bar.workItemId === createdWorkItem.id) ||
    timeline.unschedulable.some((item) => item.workItemId === createdWorkItem.id);
  if (alreadyVisible || !isWorkItemVisible(timeline, parentWorkItemId)) {
    return timeline;
  }

  const parentByWorkItemId = buildParentLookup(timeline);
  const title = resolveCreatedChildTitle(createdWorkItem);
  const state = toTimelineStateBadge(resolveCreatedString(createdWorkItem.state, "New"), null);
  const details = buildCreatedChildDetails(createdWorkItem, title, parentWorkItemId);
  const schedule = buildCreatedChildSchedule(createdWorkItem);

  if (schedule) {
    const childBar = buildCreatedChildBar(createdWorkItem, title, state, details, schedule);
    const insertionIndex = resolveChildInsertionIndex(timeline.bars, parentWorkItemId, parentByWorkItemId);
    const nextTimeline = {
      ...timeline,
      bars: insertAfter(timeline.bars, insertionIndex, childBar)
    };
    return rebuildTreeLayoutWhenNeeded(nextTimeline);
  }

  const childUnschedulable = buildCreatedChildUnschedulableItem(createdWorkItem, title, state, details);
  const insertionIndex = resolveChildInsertionIndex(timeline.unschedulable, parentWorkItemId, parentByWorkItemId);
  const nextTimeline = {
    ...timeline,
    unschedulable: insertAfter(timeline.unschedulable, insertionIndex, childUnschedulable)
  };
  return rebuildTreeLayoutWhenNeeded(nextTimeline);
}

export function applyReparentUpdate(
  timeline: QueryIntakeResponse["timeline"],
  targetWorkItemId: number,
  newParentId: number | null
): QueryIntakeResponse["timeline"] {
  if (!timeline) {
    return timeline;
  }

  const updatedBars = timeline.bars.map((bar) =>
    bar.workItemId === targetWorkItemId
      ? { ...bar, details: { ...bar.details, parentWorkItemId: newParentId } }
      : bar
  );
  const updatedUnschedulable = timeline.unschedulable.map((item) =>
    item.workItemId === targetWorkItemId
      ? { ...item, details: { ...item.details, parentWorkItemId: newParentId } }
      : item
  );

  return rebuildTreeLayout({
    ...timeline,
    bars: updatedBars,
    unschedulable: updatedUnschedulable
  });
}

function buildCreatedChildBar(
  createdWorkItem: CreatedWorkItemSnapshot,
  title: string,
  state: TimelineBar["state"],
  details: TimelineBar["details"],
  schedule: TimelineBar["schedule"]
): TimelineBar {
  return {
    workItemId: createdWorkItem.id,
    title,
    state,
    schedule,
    details
  };
}

function buildCreatedChildSchedule(createdWorkItem: CreatedWorkItemSnapshot): TimelineBar["schedule"] | null {
  const startDate = resolveCreatedNullableString(createdWorkItem.schedule?.startDate, null);
  const endDate = resolveCreatedNullableString(createdWorkItem.schedule?.endDate, null);
  if (startDate === null && endDate === null) {
    return null;
  }

  return {
    startDate,
    endDate,
    missingBoundary: resolveMissingBoundary(startDate, endDate, null)
  };
}

function buildCreatedChildUnschedulableItem(
  createdWorkItem: CreatedWorkItemSnapshot,
  title: string,
  state: TimelineUnschedulableItem["state"],
  details: TimelineUnschedulableItem["details"]
): TimelineUnschedulableItem {
  return {
    workItemId: createdWorkItem.id,
    title,
    state,
    details,
    reason: "missing-both-dates"
  };
}

function buildCreatedChildDetails(
  createdWorkItem: CreatedWorkItemSnapshot,
  title: string,
  parentWorkItemId: number
): TimelineBar["details"] {
  return {
    mappedId: String(createdWorkItem.id),
    descriptionHtml: resolveCreatedNullableString(createdWorkItem.descriptionHtml, null),
    workItemType: resolveCreatedNullableString(createdWorkItem.workItemType, null),
    fieldValues: resolveCreatedChildFieldValues(createdWorkItem.fieldValues, title),
    assignedTo: resolveCreatedNullableString(createdWorkItem.assignedTo, null),
    parentWorkItemId
  };
}

function resolveCreatedChildFieldValues(
  createdFieldValues: CreatedWorkItemSnapshot["fieldValues"],
  title: string
): TimelineBar["details"]["fieldValues"] {
  if (!createdFieldValues) {
    return undefined;
  }

  return Object.prototype.hasOwnProperty.call(createdFieldValues, "System.Title")
    ? { ...createdFieldValues, "System.Title": title }
    : createdFieldValues;
}

function resolveCreatedChildTitle(createdWorkItem: CreatedWorkItemSnapshot): string {
  const typeFallback = resolveCreatedNullableString(createdWorkItem.workItemType, null);
  return resolveCreatedString(createdWorkItem.title, typeFallback ? `New ${typeFallback}` : `#${createdWorkItem.id}`);
}

function isWorkItemVisible(timeline: NonNullable<QueryIntakeResponse["timeline"]>, workItemId: number): boolean {
  return timeline.bars.some((bar) => bar.workItemId === workItemId) ||
    timeline.unschedulable.some((item) => item.workItemId === workItemId);
}

function buildParentLookup(timeline: NonNullable<QueryIntakeResponse["timeline"]>): Map<number, number | null> {
  return new Map([
    ...timeline.bars.map((bar) => [bar.workItemId, bar.details.parentWorkItemId ?? null] as const),
    ...timeline.unschedulable.map((item) => [item.workItemId, item.details.parentWorkItemId ?? null] as const)
  ]);
}

function resolveChildInsertionIndex<T extends { workItemId: number }>(
  items: readonly T[],
  parentWorkItemId: number,
  parentByWorkItemId: ReadonlyMap<number, number | null>
): number {
  let insertionIndex = items.findIndex((item) => item.workItemId === parentWorkItemId);

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item && isDescendantOfWorkItem(item.workItemId, parentWorkItemId, parentByWorkItemId)) {
      insertionIndex = Math.max(insertionIndex, index);
    }
  }

  return insertionIndex === -1 ? items.length - 1 : insertionIndex;
}

function isDescendantOfWorkItem(
  candidateWorkItemId: number,
  ancestorWorkItemId: number,
  parentByWorkItemId: ReadonlyMap<number, number | null>
): boolean {
  let currentParentId = parentByWorkItemId.get(candidateWorkItemId) ?? null;
  const visited = new Set<number>();

  while (currentParentId !== null) {
    if (currentParentId === ancestorWorkItemId) {
      return true;
    }

    if (visited.has(currentParentId)) {
      return false;
    }

    visited.add(currentParentId);
    currentParentId = parentByWorkItemId.get(currentParentId) ?? null;
  }

  return false;
}

function buildDuplicateBar(source: TimelineBar, createdWorkItem: CreatedWorkItemSnapshot): TimelineBar {
  const startDate = resolveCreatedScheduleDate(createdWorkItem.schedule, "startDate", source.schedule.startDate);
  const endDate = resolveCreatedScheduleDate(createdWorkItem.schedule, "endDate", source.schedule.endDate);
  const title = resolveDuplicateTitle(createdWorkItem.title, source.title);

  return {
    ...source,
    workItemId: createdWorkItem.id,
    title,
    state: resolveCreatedState(createdWorkItem, source.state),
    schedule: {
      ...source.schedule,
      startDate,
      endDate,
      missingBoundary: resolveMissingBoundary(startDate, endDate, source.schedule.missingBoundary)
    },
    details: buildDuplicateDetails(source.details, createdWorkItem, title)
  };
}

function buildDuplicateUnschedulableItem(
  source: TimelineUnschedulableItem,
  createdWorkItem: CreatedWorkItemSnapshot
): TimelineUnschedulableItem {
  const title = resolveDuplicateTitle(createdWorkItem.title, source.title);

  return {
    ...source,
    workItemId: createdWorkItem.id,
    title,
    state: resolveCreatedState(createdWorkItem, source.state),
    details: buildDuplicateDetails(source.details, createdWorkItem, title),
    ...(source.schedule
      ? {
          schedule: {
            ...source.schedule,
            startDate: resolveCreatedScheduleDate(createdWorkItem.schedule, "startDate", source.schedule.startDate),
            endDate: resolveCreatedScheduleDate(createdWorkItem.schedule, "endDate", source.schedule.endDate)
          }
        }
      : {})
  };
}

function buildDuplicateDetails(
  source: TimelineBar["details"],
  createdWorkItem: CreatedWorkItemSnapshot,
  title: string
): TimelineBar["details"] {
  return {
    ...source,
    mappedId: String(createdWorkItem.id),
    descriptionHtml: resolveCreatedNullableString(createdWorkItem.descriptionHtml, source.descriptionHtml ?? null),
    workItemType: resolveCreatedNullableString(createdWorkItem.workItemType, source.workItemType ?? null),
    fieldValues: resolveDuplicateFieldValues(source.fieldValues, createdWorkItem.fieldValues, title),
    assignedTo: resolveCreatedNullableString(createdWorkItem.assignedTo, source.assignedTo ?? null),
    parentWorkItemId: createdWorkItem.parentWorkItemId !== undefined
      ? createdWorkItem.parentWorkItemId
      : (source.parentWorkItemId ?? null)
  };
}

function resolveDuplicateTitle(createdTitle: string | null | undefined, sourceTitle: string): string {
  return resolveCreatedString(createdTitle, `${sourceTitle} (copy)`);
}

function resolveDuplicateFieldValues(
  sourceFieldValues: TimelineBar["details"]["fieldValues"],
  createdFieldValues: CreatedWorkItemSnapshot["fieldValues"],
  title: string
): TimelineBar["details"]["fieldValues"] {
  const fieldValues = createdFieldValues ?? sourceFieldValues;
  if (!fieldValues) {
    return fieldValues;
  }

  return Object.prototype.hasOwnProperty.call(fieldValues, "System.Title")
    ? { ...fieldValues, "System.Title": title }
    : fieldValues;
}

function resolveCreatedState(
  createdWorkItem: CreatedWorkItemSnapshot,
  sourceState: TimelineBar["state"]
): TimelineBar["state"] {
  const stateCode = resolveCreatedString(createdWorkItem.state, sourceState.code);
  const preferredColor = stateCode === sourceState.code ? sourceState.color : null;
  return toTimelineStateBadge(stateCode, preferredColor);
}

function resolveCreatedString(value: string | null | undefined, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function resolveCreatedNullableString(value: string | null | undefined, fallback: string | null): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function resolveCreatedScheduleDate(
  schedule: CreatedWorkItemSnapshot["schedule"] | undefined,
  field: "startDate" | "endDate",
  fallback: string | null
): string | null {
  if (schedule && Object.prototype.hasOwnProperty.call(schedule, field)) {
    return schedule[field] ?? null;
  }

  return fallback;
}

function resolveMissingBoundary(
  startDate: string | null,
  endDate: string | null,
  fallback: "start" | "end" | null
): "start" | "end" | null {
  if (startDate && endDate) {
    return null;
  }

  if (startDate) {
    return "end";
  }

  if (endDate) {
    return "start";
  }

  return fallback;
}

function insertAfter<T>(items: readonly T[], index: number, item: T): T[] {
  return [...items.slice(0, index + 1), item, ...items.slice(index + 1)];
}

function rebuildTreeLayoutWhenNeeded(timeline: NonNullable<QueryIntakeResponse["timeline"]>): QueryIntakeResponse["timeline"] {
  return timeline.treeLayout === null ? timeline : rebuildTreeLayout(timeline);
}

function rebuildTreeLayout(timeline: NonNullable<QueryIntakeResponse["timeline"]>): QueryIntakeResponse["timeline"] {
  const allItems = [
    ...timeline.bars.map((bar) => ({ id: bar.workItemId, parentId: bar.details.parentWorkItemId ?? null })),
    ...timeline.unschedulable.map((item) => ({ id: item.workItemId, parentId: item.details.parentWorkItemId ?? null }))
  ];

  const layout = buildTreeLayoutFromParentMap(allItems);

  const barPosition = new Map<number, number>();
  layout.orderedIds.forEach((id, index) => barPosition.set(id, index));

  const reorderedBars = [...timeline.bars].sort((a, b) => {
    const posA = barPosition.get(a.workItemId) ?? Number.MAX_SAFE_INTEGER;
    const posB = barPosition.get(b.workItemId) ?? Number.MAX_SAFE_INTEGER;
    return posA - posB;
  });

  const reorderedUnschedulable = [...timeline.unschedulable].sort((a, b) => {
    const posA = barPosition.get(a.workItemId) ?? Number.MAX_SAFE_INTEGER;
    const posB = barPosition.get(b.workItemId) ?? Number.MAX_SAFE_INTEGER;
    return posA - posB;
  });

  const treeLayoutRecord: Record<string, TimelineTreeNodeMeta> = {};
  for (const [id, meta] of layout.metaByWorkItemId) {
    treeLayoutRecord[String(id)] = {
      depth: meta.depth,
      parentWorkItemId: meta.parentWorkItemId,
      hasChildren: meta.hasChildren,
      isLastSibling: meta.isLastSibling,
      ancestorIsLastSibling: [...meta.ancestorIsLastSibling]
    };
  }

  return {
    ...timeline,
    bars: reorderedBars,
    unschedulable: reorderedUnschedulable,
    treeLayout: treeLayoutRecord
  };
}

function toTimelineStateBadge(code: string, preferredColor: string | null): { code: string; badge: string; color: string } {
  const normalizedCode = code.trim().length > 0 ? code.trim() : "Unknown";
  return {
    code: normalizedCode,
    badge: normalizedCode.charAt(0).toUpperCase() || "?",
    color: preferredColor && preferredColor.trim().length > 0 ? `#${preferredColor.replace(/^#/, "")}` : colorForStateCode(normalizedCode)
  };
}

function colorForStateCode(code: string): string {
  switch (code.toLowerCase()) {
    case "new":
    case "to do":
      return "#7c3aed";
    case "active":
    case "in progress":
      return "#1d4ed8";
    case "resolved":
      return "#15803d";
    case "closed":
    case "done":
      return "#6b7280";
    default:
      return "#334155";
  }
}
