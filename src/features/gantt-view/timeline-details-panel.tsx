import React from "react";

import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";

export type TimelineDetailsPanelProps = {
  timeline: TimelineReadModel | null;
  selectedWorkItemId: number | null;
};

export function TimelineDetailsPanel(props: TimelineDetailsPanelProps): React.ReactElement {
  const lines = buildTimelineDetailsLines(props);

  return React.createElement(
    "aside",
    {
      "aria-label": "timeline-details-panel"
    },
    React.createElement("h4", null, "Details"),
    React.createElement("pre", null, lines.join("\n"))
  );
}

export function buildTimelineDetailsLines(input: TimelineDetailsPanelProps): string[] {
  if (!input.timeline || input.selectedWorkItemId === null) {
    return ["- selected: none"];
  }

  const selectedBar = input.timeline.bars.find((bar) => bar.workItemId === input.selectedWorkItemId);
  if (selectedBar) {
    return [
      `- selected work item: #${selectedBar.workItemId}`,
      `- mapped id: ${selectedBar.details.mappedId}`,
      `- title: ${selectedBar.title}`,
      `- state: ${selectedBar.state.code}`,
      `- start: ${selectedBar.schedule.startDate ?? "none"}`,
      `- end: ${selectedBar.schedule.endDate ?? "none"}`,
      `- missing boundary: ${selectedBar.schedule.missingBoundary ?? "none"}`
    ];
  }

  const selectedUnschedulable = input.timeline.unschedulable.find(
    (item) => item.workItemId === input.selectedWorkItemId
  );
  if (selectedUnschedulable) {
    return [
      `- selected work item: #${selectedUnschedulable.workItemId}`,
      `- mapped id: ${selectedUnschedulable.details.mappedId}`,
      `- title: ${selectedUnschedulable.title}`,
      `- state: ${selectedUnschedulable.state.code}`,
      `- reason: ${selectedUnschedulable.reason}`
    ];
  }

  return ["- selected: none"];
}
