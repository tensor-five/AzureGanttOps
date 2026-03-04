import type {
  SuppressedTimelineDependency,
  TimelineBar,
  TimelineDependencyArrow,
  TimelineUnschedulableItem
} from "../../application/dto/timeline-read-model.js";
import type { CanonicalModel } from "./canonical-model-builder.js";

export type TimelineProjection = {
  bars: TimelineBar[];
  unschedulable: TimelineUnschedulableItem[];
  dependencies: TimelineDependencyArrow[];
  suppressedDependencies: SuppressedTimelineDependency[];
};

export function projectTimeline(canonical: CanonicalModel): TimelineProjection {
  const bars: TimelineBar[] = [];
  const unschedulable: TimelineUnschedulableItem[] = [];
  const schedulableIds = new Set<number>();

  canonical.tasks.forEach((task) => {
    const missingStart = task.startDate === null;
    const missingEnd = task.endDate === null;

    if (missingStart && missingEnd) {
      unschedulable.push({
        workItemId: task.workItemId,
        title: task.title,
        state: task.state,
        details: {
          mappedId: task.mappedId
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
        mappedId: task.mappedId
      }
    });

    schedulableIds.add(task.workItemId);
  });

  bars.sort((left, right) => compareBars(left, right));

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
  const leftDate = left.schedule.startDate ?? left.schedule.endDate;
  const rightDate = right.schedule.startDate ?? right.schedule.endDate;

  if (leftDate && rightDate) {
    const byDate = leftDate.localeCompare(rightDate);
    if (byDate !== 0) {
      return byDate;
    }
  }

  if (leftDate && !rightDate) {
    return -1;
  }

  if (!leftDate && rightDate) {
    return 1;
  }

  return left.workItemId - right.workItemId;
}
