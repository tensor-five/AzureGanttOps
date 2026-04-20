// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { TimelinePane, resolveTimelineVerticalLayoutMetrics } from "./timeline-pane.js";
import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";
import { clearTimelineDetailsWidthPreferenceForTests } from "./timeline-details-width-preference.js";

afterEach(() => {
  cleanup();
  clearTimelineDetailsWidthPreferenceForTests();
});

function makeTimeline(): TimelineReadModel {
  return {
    queryType: "flat",
    bars: [
      {
        workItemId: 11,
        title: "Source Item",
        state: { code: "Active", badge: "A", color: "#2f855a" },
        schedule: {
          startDate: "2026-03-01T00:00:00.000Z",
          endDate: "2026-03-03T00:00:00.000Z",
          missingBoundary: null
        },
        details: { mappedId: "11" }
      }
    ],
    unschedulable: [],
    dependencies: [],
    suppressedDependencies: [],
    treeLayout: null,
    mappingValidation: {
      status: "valid",
      issues: []
    }
  };
}

describe("timeline-pane layout", () => {
  it("computes vertical layout without phantom row by default", () => {
    const metrics = resolveTimelineVerticalLayoutMetrics(5, false);
    expect(metrics).toEqual({
      contentRows: 5,
      tailHeightPx: 18
    });
  });

  it("adds one extra row only when unscheduled drop lane is active", () => {
    const metrics = resolveTimelineVerticalLayoutMetrics(5, true);
    expect(metrics).toEqual({
      contentRows: 6,
      tailHeightPx: 18
    });
  });

  it("resizes the details panel via splitter drag and persists width", () => {
    render(
      React.createElement(TimelinePane, {
        timeline: makeTimeline(),
        showDependencies: true
      })
    );

    const splitter = screen.getByRole("separator", { name: "Resize details panel" });
    fireEvent.pointerDown(splitter, { button: 0, pointerId: 7, clientX: 900 });
    fireEvent.pointerMove(window, { pointerId: 7, clientX: 860 });
    fireEvent.pointerUp(window, { pointerId: 7, clientX: 860 });

    expect(globalThis.localStorage.getItem("azure-ganttops.timeline-details-width-px.v1")).toBe("360");
  });

  it("expands details panel from fully collapsed splitter click", () => {
    globalThis.localStorage.setItem("azure-ganttops.timeline-details-width-px.v1", "0");

    render(
      React.createElement(TimelinePane, {
        timeline: makeTimeline(),
        showDependencies: true
      })
    );

    const splitter = screen.getByRole("separator", { name: "Expand details panel" });
    fireEvent.click(splitter);

    expect(globalThis.localStorage.getItem("azure-ganttops.timeline-details-width-px.v1")).toBe("260");
  });

  it("collapses details panel from splitter click when visible", () => {
    render(
      React.createElement(TimelinePane, {
        timeline: makeTimeline(),
        showDependencies: true
      })
    );

    const splitter = screen.getByRole("separator", { name: "Resize details panel" });
    fireEvent.click(splitter);

    expect(globalThis.localStorage.getItem("azure-ganttops.timeline-details-width-px.v1")).toBe("0");
    expect(screen.getByRole("separator", { name: "Expand details panel" })).toBeTruthy();
  });

  it("uses compact unscheduled section when there are no unscheduled items", () => {
    const { container, rerender } = render(
      React.createElement(TimelinePane, {
        timeline: makeTimeline(),
        showDependencies: true
      })
    );

    const emptyState = container.querySelector(".timeline-unschedulable-list");
    expect(emptyState?.classList.contains("timeline-unschedulable-list-empty")).toBe(true);
    const emptyChartScroll = container.querySelector(".timeline-chart-scroll");
    expect(emptyChartScroll?.classList.contains("timeline-chart-scroll-unscheduled-empty")).toBe(true);

    const populatedTimeline = makeTimeline();
    populatedTimeline.unschedulable = [
      {
        workItemId: 22,
        title: "Target Item",
        state: { code: "New", badge: "N", color: "#2563eb" },
        reason: "missing-both-dates",
        details: { mappedId: "22" }
      }
    ];

    rerender(
      React.createElement(TimelinePane, {
        timeline: populatedTimeline,
        showDependencies: true
      })
    );

    const nonEmptyState = container.querySelector(".timeline-unschedulable-list");
    expect(nonEmptyState?.classList.contains("timeline-unschedulable-list-empty")).toBe(false);
    const nonEmptyChartScroll = container.querySelector(".timeline-chart-scroll");
    expect(nonEmptyChartScroll?.classList.contains("timeline-chart-scroll-unscheduled-empty")).toBe(false);
  });

  it("renders subtle background bands for saturday and sunday", () => {
    const { container } = render(
      React.createElement(TimelinePane, {
        timeline: makeTimeline(),
        showDependencies: true
      })
    );

    const weekendBands = container.querySelectorAll("rect.timeline-weekend-band");

    expect(weekendBands).toHaveLength(2);
    expect(Array.from(weekendBands, (band) => band.getAttribute("data-date"))).toEqual([
      "2026-02-28",
      "2026-03-01"
    ]);
  });

  it("renders live sync controls next to the sync status", () => {
    const onSetLiveSyncEnabled = vi.fn();
    const onPushPendingWorkItemChanges = vi.fn();

    render(
      React.createElement(TimelinePane, {
        timeline: makeTimeline(),
        showDependencies: true,
        liveSyncEnabled: false,
        pendingWorkItemSyncCount: 2,
        workItemSyncState: "paused",
        onSetLiveSyncEnabled,
        onPushPendingWorkItemChanges
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Push changes (2)" }));
    fireEvent.click(screen.getByLabelText("Live sync"));

    expect(screen.getByText("Live sync paused, 2 changes queued")).toBeTruthy();
    expect(onPushPendingWorkItemChanges).toHaveBeenCalledTimes(1);
    expect(onSetLiveSyncEnabled).toHaveBeenCalledWith(true);
  });

  it("hides push changes while live sync is enabled", () => {
    render(
      React.createElement(TimelinePane, {
        timeline: makeTimeline(),
        showDependencies: true,
        liveSyncEnabled: true,
        pendingWorkItemSyncCount: 2,
        workItemSyncState: "up_to_date"
      })
    );

    expect(screen.queryByRole("button", { name: "Push changes (2)" })).toBeNull();
  });

  it("hides push changes when no pending changes exist", () => {
    render(
      React.createElement(TimelinePane, {
        timeline: makeTimeline(),
        showDependencies: true,
        liveSyncEnabled: false,
        pendingWorkItemSyncCount: 0,
        workItemSyncState: "paused"
      })
    );

    expect(screen.queryByRole("button", { name: "Push changes" })).toBeNull();
  });
});
