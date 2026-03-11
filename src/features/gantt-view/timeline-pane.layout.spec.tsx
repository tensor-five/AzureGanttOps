import React from "react";
import { afterEach, describe, expect, it } from "vitest";
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
});
