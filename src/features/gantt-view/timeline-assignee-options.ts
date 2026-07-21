import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";

export type TimelineAssigneeOption = {
  name: string;
  taskCount: number;
};

export function buildTimelineAssigneeOptions(timeline: TimelineReadModel | null): TimelineAssigneeOption[] {
  if (!timeline) {
    return [];
  }

  const countsByNormalizedName = new Map<string, TimelineAssigneeOption>();
  const items = [...timeline.bars, ...timeline.unschedulable];

  items.forEach((item) => {
    const name = item.details.assignedTo?.trim();
    if (!name) {
      return;
    }

    const normalizedName = name.toLocaleLowerCase("en");
    const current = countsByNormalizedName.get(normalizedName);
    if (current) {
      current.taskCount += 1;
      return;
    }

    countsByNormalizedName.set(normalizedName, {
      name,
      taskCount: 1
    });
  });

  return [...countsByNormalizedName.values()].sort(
    (left, right) =>
      right.taskCount - left.taskCount ||
      left.name.localeCompare(right.name, "en", { sensitivity: "base" })
  );
}
