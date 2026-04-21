import type {
  SuppressedTimelineDependency,
  TimelineBar,
  TimelineDependencyArrow,
  TimelineUnschedulableItem
} from "../../application/dto/timeline-read-model.js";
import type { CanonicalModel } from "./canonical-model-builder.js";
import type { TreeLayout } from "./tree-structure.js";
import { extractIterationPath } from "../../shared/utils/iteration-scheduling.js";

const DEFAULT_UNSCHEDULED_DURATION_DAYS = 14;
const MS_PER_DAY = 86_400_000;

export type TimelineProjection = {
  bars: TimelineBar[];
  unschedulable: TimelineUnschedulableItem[];
  dependencies: TimelineDependencyArrow[];
  suppressedDependencies: SuppressedTimelineDependency[];
};

/**
 * Optional iteration dates map: iteration path -> {startDate, endDate}
 * Used to visually schedule items that lack explicit dates but have iterations
 */
export type IterationDatesMap = Record<string, { startDate: string; endDate: string }>;

export function projectTimeline(
  canonical: CanonicalModel,
  treeLayout?: TreeLayout | null,
  iterationDates?: IterationDatesMap | null
): TimelineProjection {
  const bars: TimelineBar[] = [];
  const unschedulable: TimelineUnschedulableItem[] = [];
  const schedulableIds = new Set<number>();

  canonical.tasks.forEach((task) => {
    const missingStart = task.startDate === null;
    const missingEnd = task.endDate === null;

    if (missingStart && missingEnd) {
      if (iterationDates) {
        const iterationPathInfo = extractIterationPath(task.fieldValues);
        if (iterationPathInfo) {
          let iterationDatesForPath = iterationDates[iterationPathInfo.iterationPath];

          if (!iterationDatesForPath && iterationPathInfo.iterationPath.includes("\\")) {
            const sprintPart = iterationPathInfo.iterationPath.split("\\").slice(1).join("\\");
            iterationDatesForPath = iterationDates[sprintPart];
          }

          if (!iterationDatesForPath) {
            const mapKeys = Object.keys(iterationDates);
            for (const k of mapKeys) {
              if (k.endsWith(iterationPathInfo.iterationPath) || iterationPathInfo.iterationPath.endsWith(k)) {
                iterationDatesForPath = iterationDates[k];
                break;
              }
            }
          }

          if (iterationDatesForPath) {
            bars.push({
              workItemId: task.workItemId,
              title: task.title,
              state: task.state,
              schedule: {
                startDate: iterationDatesForPath.startDate,
                endDate: iterationDatesForPath.endDate,
                missingBoundary: null
              },
              details: {
                mappedId: task.mappedId,
                descriptionHtml: task.descriptionHtml,
                workItemType: task.workItemType,
                fieldValues: task.fieldValues,
                assignedTo: task.assignedTo,
                parentWorkItemId: task.parentWorkItemId
              }
            });
            schedulableIds.add(task.workItemId);
            return;
          }
        }
      }

      unschedulable.push({
        workItemId: task.workItemId,
        title: task.title,
        state: task.state,
        details: {
          mappedId: task.mappedId,
          descriptionHtml: task.descriptionHtml,
          workItemType: task.workItemType,
          fieldValues: task.fieldValues,
          assignedTo: task.assignedTo,
          parentWorkItemId: task.parentWorkItemId
        },
        reason: "missing-both-dates"
      });
      return;
    }

    let missingBoundary: "start" | "end" | null = null;
    if (missingStart) {
      missingBoundary = "start";
    } else if (missingEnd) {
      missingBoundary = "end";
    }

    bars.push({
      workItemId: task.workItemId,
      title: task.title,
      state: task.state,
      schedule: {
        startDate: task.startDate,
        endDate: task.endDate,
        missingBoundary
      },
      details: {
        mappedId: task.mappedId,
        descriptionHtml: task.descriptionHtml,
        workItemType: task.workItemType,
        fieldValues: task.fieldValues,
        assignedTo: task.assignedTo,
        parentWorkItemId: task.parentWorkItemId
      }
    });

    schedulableIds.add(task.workItemId);
  });

  if (treeLayout) {
    reorderByTreeLayout(bars, treeLayout);
    reorderByTreeLayout(unschedulable, treeLayout);
  } else {
    bars.sort((left, right) => compareBars(left, right));
  }

  const dependencies: TimelineDependencyArrow[] = [];
  const suppressedDependencies: SuppressedTimelineDependency[] = [];

  canonical.dependencies.forEach((dependency) => {
    const predecessorSchedulable = schedulableIds.has(dependency.predecessorWorkItemId);
    const successorSchedulable = schedulableIds.has(dependency.successorWorkItemId);

    if (predecessorSchedulable && successorSchedulable) {
      dependencies.push({
        predecessorWorkItemId: dependency.predecessorWorkItemId,
        successorWorkItemId: dependency.successorWorkItemId,
        dependencyType: dependency.dependencyType,
        label: `#${dependency.predecessorWorkItemId} [end] -> #${dependency.successorWorkItemId} [start]`
      });
      return;
    }

    suppressedDependencies.push({
      predecessorWorkItemId: dependency.predecessorWorkItemId,
      successorWorkItemId: dependency.successorWorkItemId,
      dependencyType: dependency.dependencyType,
      reason: "unschedulable-endpoint"
    });
  });

  return {
    bars,
    unschedulable,
    dependencies,
    suppressedDependencies
  };
}

function compareBars(left: TimelineBar, right: TimelineBar): number {
  const leftDate = resolveBarSortStartTimestamp(left);
  const rightDate = resolveBarSortStartTimestamp(right);

  if (leftDate !== null && rightDate !== null) {
    const byDate = leftDate - rightDate;
    if (byDate !== 0) {
      return byDate;
    }
  }

  if (leftDate !== null && rightDate === null) {
    return -1;
  }

  if (leftDate === null && rightDate !== null) {
    return 1;
  }

  return left.workItemId - right.workItemId;
}

function resolveBarSortStartTimestamp(bar: TimelineBar): number | null {
  const startTimestamp = toTimestamp(bar.schedule.startDate);
  if (startTimestamp !== null) {
    return startTimestamp;
  }

  const endTimestamp = toTimestamp(bar.schedule.endDate);
  if (endTimestamp === null) {
    return null;
  }

  return endTimestamp - (DEFAULT_UNSCHEDULED_DURATION_DAYS - 1) * MS_PER_DAY;
}

function reorderByTreeLayout<T extends { workItemId: number }>(items: T[], layout: TreeLayout): void {
  const positionById = new Map<number, number>();
  layout.orderedIds.forEach((id, index) => {
    positionById.set(id, index);
  });

  items.sort((left, right) => {
    const leftPos = positionById.get(left.workItemId) ?? Number.MAX_SAFE_INTEGER;
    const rightPos = positionById.get(right.workItemId) ?? Number.MAX_SAFE_INTEGER;
    return leftPos - rightPos;
  });
}

function toTimestamp(value: string | null): number | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}
