import React from "react";

import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";
import { loadLastDensity, saveLastDensity, type TimelineDensity } from "./timeline-density-preference.js";
import {
  buildTimelineDetailsLines,
  TimelineDetailsPanel,
  type TimelineDetailsPanelProps
} from "./timeline-details-panel.js";
import { createTimelineSelectionStore, type TimelineSelectionStore } from "./selection-store.js";

const MAX_PRIMARY_TITLE_LENGTH = 42;

export type TimelinePaneProps = {
  timeline: TimelineReadModel | null;
  showDependencies: boolean;
  density?: TimelineDensity;
  selectionStore?: TimelineSelectionStore;
  onDensityChange?: (density: TimelineDensity) => void;
  onRetryRefresh?: () => void;
};

export function TimelinePane(props: TimelinePaneProps): React.ReactElement {
  const selectionStore = props.selectionStore ?? createTimelineSelectionStore();
  const density = props.density ?? loadLastDensity() ?? "comfortable";

  saveLastDensity(density);

  const timelineLines = buildTimelinePaneLines({
    timeline: props.timeline,
    showDependencies: props.showDependencies,
    selectionStore
  });

  const selectedWorkItemId = selectionStore.getSelectedWorkItemId();
  const detailProps: TimelineDetailsPanelProps = {
    timeline: props.timeline,
    selectedWorkItemId
  };

  const selectedTitle = resolveSelectedTitle(props.timeline, selectedWorkItemId);

  return React.createElement(
    "section",
    {
      "aria-label": "timeline-pane"
    },
    React.createElement("h3", null, "Timeline"),
    React.createElement("div", null, `Density mode: ${density}`),
    React.createElement(
      "button",
      {
        type: "button",
        onClick: () => {
          props.onRetryRefresh?.();
        }
      },
      "Retry refresh"
    ),
    React.createElement(
      "div",
      {
        "aria-label": "selected-timeline-item"
      },
      `Selected timeline item: ${selectedTitle ?? "none"}`
    ),
    React.createElement(
      "button",
      {
        type: "button",
        onClick: () => {
          const nextSelection = firstSelectableWorkItemId(props.timeline);
          if (nextSelection !== null) {
            selectionStore.select(nextSelection);
          }
        }
      },
      "Select first item"
    ),
    React.createElement(
      "div",
      null,
      React.createElement(
        "button",
        {
          type: "button",
          onClick: () => {
            saveLastDensity("comfortable");
            props.onDensityChange?.("comfortable");
          }
        },
        "Comfortable"
      ),
      React.createElement(
        "button",
        {
          type: "button",
          onClick: () => {
            saveLastDensity("compact");
            props.onDensityChange?.("compact");
          }
        },
        "Compact"
      )
    ),
    React.createElement("pre", null, timelineLines.join("\n")),
    React.createElement(TimelineDetailsPanel, detailProps)
  );
}

export function buildTimelinePaneLines(input: {
  timeline: TimelineReadModel | null;
  showDependencies: boolean;
  selectionStore: TimelineSelectionStore;
}): string[] {
  if (!input.timeline) {
    const details = buildTimelineDetailsLines({
      timeline: null,
      selectedWorkItemId: null
    });

    return [
      "Timeline bars (title + state):",
      "- none",
      "Timeline details (mapped ID):",
      "- none",
      "Unschedulable items (title + state):",
      "- none",
      "Unschedulable details (mapped ID):",
      "- none",
      "Dependency arrows: hidden",
      "Dependencies (FS arrows: predecessor end -> successor start):",
      "- hidden by toggle",
      "Suppressed dependencies (details only):",
      "- none",
      "Persistent details panel:",
      ...details
    ];
  }

  const selectableItems = [
    ...input.timeline.bars.map((bar) => ({ workItemId: bar.workItemId })),
    ...input.timeline.unschedulable.map((item) => ({ workItemId: item.workItemId }))
  ];
  const reconciledSelection = input.selectionStore.reconcile(selectableItems);
  if (reconciledSelection === null && selectableItems.length > 0) {
    input.selectionStore.select(selectableItems[0].workItemId);
  }

  const selectedWorkItemId = input.selectionStore.getSelectedWorkItemId();

  const bars = input.timeline.bars.length
    ? input.timeline.bars.map((bar) => {
        const title = truncateTitle(bar.title);
        const halfOpenMarker = bar.schedule.missingBoundary ? ` [half-open:${bar.schedule.missingBoundary}]` : "";
        const selectedMarker = selectedWorkItemId === bar.workItemId ? " [selected]" : "";

        return `- #${bar.details.mappedId} ${title} [${bar.state.badge}|${bar.state.color}]${halfOpenMarker}${selectedMarker}`;
      })
    : ["- none"];

  const barDetails = input.timeline.bars.length
    ? input.timeline.bars.map((bar) => `- #${bar.workItemId} mappedId=${bar.details.mappedId}`)
    : ["- none"];

  const unschedulable = input.timeline.unschedulable.length
    ? input.timeline.unschedulable.map((item) => {
        const title = truncateTitle(item.title);
        const selectedMarker = selectedWorkItemId === item.workItemId ? " [selected]" : "";

        return `- ${title} [${item.state.badge}|${item.state.color}]${selectedMarker}`;
      })
    : ["- none"];

  const unschedulableDetails = input.timeline.unschedulable.length
    ? input.timeline.unschedulable.map((item) => `- #${item.workItemId} mappedId=${item.details.mappedId}`)
    : ["- none"];

  const dependencyToggle = `Dependency arrows: ${input.showDependencies ? "shown" : "hidden"}`;
  const dependencyLines = input.showDependencies
    ? input.timeline.dependencies.length
      ? input.timeline.dependencies.map((arrow) => `- ${arrow.label}`)
      : ["- none"]
    : ["- hidden by toggle"];

  const suppressedDependencies = input.timeline.suppressedDependencies.length
    ? input.timeline.suppressedDependencies.map(
        (dependency) =>
          `- #${dependency.predecessorWorkItemId} -> #${dependency.successorWorkItemId} (${dependency.reason})`
      )
    : ["- none"];

  const detailLines = buildTimelineDetailsLines({
    timeline: input.timeline,
    selectedWorkItemId
  });

  return [
    "Timeline bars (title + state):",
    ...bars,
    "Timeline details (mapped ID):",
    ...barDetails,
    "Unschedulable items (title + state):",
    ...unschedulable,
    "Unschedulable details (mapped ID):",
    ...unschedulableDetails,
    dependencyToggle,
    "Dependencies (FS arrows: predecessor end -> successor start):",
    ...dependencyLines,
    "Suppressed dependencies (details only):",
    ...suppressedDependencies,
    "Persistent details panel:",
    ...detailLines
  ];
}

function truncateTitle(title: string): string {
  if (title.length <= MAX_PRIMARY_TITLE_LENGTH) {
    return title;
  }

  return `${title.slice(0, MAX_PRIMARY_TITLE_LENGTH - 1)}…`;
}

function firstSelectableWorkItemId(timeline: TimelineReadModel | null): number | null {
  if (!timeline) {
    return null;
  }

  const firstBar = timeline.bars[0];
  if (firstBar) {
    return firstBar.workItemId;
  }

  const firstUnschedulable = timeline.unschedulable[0];
  return firstUnschedulable ? firstUnschedulable.workItemId : null;
}

function resolveSelectedTitle(timeline: TimelineReadModel | null, selectedWorkItemId: number | null): string | null {
  if (!timeline || selectedWorkItemId === null) {
    return null;
  }

  const bar = timeline.bars.find((entry) => entry.workItemId === selectedWorkItemId);
  if (bar) {
    return bar.title;
  }

  const unschedulable = timeline.unschedulable.find((entry) => entry.workItemId === selectedWorkItemId);
  return unschedulable ? unschedulable.title : null;
}
