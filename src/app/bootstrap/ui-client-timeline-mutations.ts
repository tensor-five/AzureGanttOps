import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";
import { applyAdoptedSchedules } from "../../features/gantt-view/timeline-pane.js";

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
