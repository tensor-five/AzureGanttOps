import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";
import type { TimelineTreeNodeMeta } from "../../application/dto/timeline-read-model.js";
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

  const allItems = [
    ...updatedBars.map((b) => ({ id: b.workItemId, parentId: b.details.parentWorkItemId ?? null })),
    ...updatedUnschedulable.map((u) => ({ id: u.workItemId, parentId: u.details.parentWorkItemId ?? null }))
  ];

  const layout = buildTreeLayoutFromParentMap(allItems);

  const barPosition = new Map<number, number>();
  layout.orderedIds.forEach((id, index) => barPosition.set(id, index));

  const reorderedBars = [...updatedBars].sort((a, b) => {
    const posA = barPosition.get(a.workItemId) ?? Number.MAX_SAFE_INTEGER;
    const posB = barPosition.get(b.workItemId) ?? Number.MAX_SAFE_INTEGER;
    return posA - posB;
  });

  const reorderedUnschedulable = [...updatedUnschedulable].sort((a, b) => {
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
