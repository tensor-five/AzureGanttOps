// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";

import { TimelinePane } from "./timeline-pane.js";
import {
  extractPathPoints,
  makeDependencyTimeline,
  makeMixedDependencyTimeline,
  makeViolatingDependencyTimeline,
  registerTimelinePaneSpecCleanup
} from "./timeline-pane.test-helpers.js";

registerTimelinePaneSpecCleanup();

describe("timeline-pane dependencies", () => {
  it("renders visible predecessor/successor connectors with arrowheads", () => {
    render(
      React.createElement(TimelinePane, {
        timeline: makeDependencyTimeline(),
        showDependencies: true
      })
    );

    const connectorGroup = screen.getByLabelText("dependency-11-12");
    const visiblePath = connectorGroup.querySelector("path.timeline-dependency-line")!;
    expect(visiblePath.getAttribute("marker-end")).toMatch(/^url\(#timeline-dependency-arrowhead-/);
    expect(visiblePath.getAttribute("d")).toContain("L");
  });

  it("hides predecessor/successor connectors when dependency toggle is off", () => {
    render(
      React.createElement(TimelinePane, {
        timeline: makeDependencyTimeline(),
        showDependencies: false
      })
    );

    expect(screen.queryByLabelText("dependency-11-12")).toBeNull();
  });

  it("creates predecessor/successor link via drag in dependency mode", () => {
    const onCreateDependency = vi.fn(async () => undefined);
    const timeline = makeDependencyTimeline();
    timeline.dependencies = [];

    render(
      React.createElement(TimelinePane, {
        timeline,
        showDependencies: true,
        onCreateDependency
      })
    );

    fireEvent.change(screen.getByLabelText("Dependency mode"), { target: { value: "edit" } });

    const sourceBar = screen.getByLabelText("timeline-bar-11");
    const targetBar = screen.getByLabelText("timeline-bar-12");
    const chart = screen.getByLabelText("gantt-chart");
    const sourceX = Number(sourceBar.getAttribute("x"));
    const sourceY = Number(sourceBar.getAttribute("y"));
    const targetX = Number(targetBar.getAttribute("x"));
    const targetY = Number(targetBar.getAttribute("y"));
    const targetWidth = Number(targetBar.getAttribute("width"));

    fireEvent.pointerDown(sourceBar, {
      pointerId: 9,
      button: 0,
      clientX: sourceX + 12,
      clientY: sourceY + 12
    });
    fireEvent.pointerMove(chart, {
      pointerId: 9,
      clientX: targetX + targetWidth / 2,
      clientY: targetY + 12
    });
    fireEvent.pointerUp(chart, {
      pointerId: 9,
      clientX: targetX + targetWidth / 2,
      clientY: targetY + 12
    });

    expect(onCreateDependency).toHaveBeenCalledWith({
      predecessorWorkItemId: 11,
      successorWorkItemId: 12
    });
  });

  it("disables schedule dragging while dependency mode is active", async () => {
    const onUpdateWorkItemSchedule = vi.fn(async () => undefined);

    render(
      React.createElement(TimelinePane, {
        timeline: makeDependencyTimeline(),
        showDependencies: true,
        onUpdateWorkItemSchedule
      })
    );

    fireEvent.change(screen.getByLabelText("Dependency mode"), { target: { value: "edit" } });

    const sourceBar = screen.getByLabelText("timeline-bar-11");
    const chart = screen.getByLabelText("gantt-chart");
    const sourceX = Number(sourceBar.getAttribute("x"));
    const sourceY = Number(sourceBar.getAttribute("y"));

    fireEvent.pointerDown(sourceBar, { pointerId: 10, button: 0, clientX: sourceX + 8, clientY: sourceY + 12 });
    fireEvent.pointerMove(chart, { pointerId: 10, clientX: sourceX + 80, clientY: sourceY + 12 });
    fireEvent.pointerUp(chart, { pointerId: 10, clientX: sourceX + 80, clientY: sourceY + 12 });

    await waitFor(() => {
      expect(onUpdateWorkItemSchedule).not.toHaveBeenCalled();
    });
  });

  it("switches dependency dropdown across all modes", () => {
    render(
      React.createElement(TimelinePane, {
        timeline: makeViolatingDependencyTimeline(),
        showDependencies: true
      })
    );

    const dependencyModeSelect = screen.getByLabelText("Dependency mode");
    expect((dependencyModeSelect as HTMLSelectElement).value).toBe("show");
    expect(screen.queryByLabelText("dependency-11-12")).not.toBeNull();

    fireEvent.change(dependencyModeSelect, { target: { value: "edit" } });
    expect((dependencyModeSelect as HTMLSelectElement).value).toBe("edit");
    expect(screen.queryByLabelText("dependency-11-12")).not.toBeNull();

    fireEvent.change(dependencyModeSelect, { target: { value: "violations" } });
    expect((dependencyModeSelect as HTMLSelectElement).value).toBe("violations");
    expect(screen.queryByLabelText("dependency-11-12")).not.toBeNull();

    fireEvent.change(dependencyModeSelect, { target: { value: "none" } });
    expect((dependencyModeSelect as HTMLSelectElement).value).toBe("none");
    expect(screen.queryByLabelText("dependency-11-12")).toBeNull();

    fireEvent.change(dependencyModeSelect, { target: { value: "show" } });
    expect((dependencyModeSelect as HTMLSelectElement).value).toBe("show");
    expect(screen.queryByLabelText("dependency-11-12")).not.toBeNull();
  });

  it("shows only violated dependencies in conflicts mode", () => {
    render(
      React.createElement(TimelinePane, {
        timeline: makeMixedDependencyTimeline(),
        showDependencies: true
      })
    );

    expect(screen.queryByLabelText("dependency-11-12")).not.toBeNull();
    expect(screen.queryByLabelText("dependency-12-13")).not.toBeNull();

    fireEvent.change(screen.getByLabelText("Dependency mode"), { target: { value: "violations" } });

    expect(screen.queryByLabelText("dependency-11-12")).not.toBeNull();
    expect(screen.queryByLabelText("dependency-12-13")).toBeNull();
  });

  it("removes selected dependency via Delete key", async () => {
    const onRemoveDependency = vi.fn(async () => undefined);
    render(
      React.createElement(TimelinePane, {
        timeline: makeDependencyTimeline(),
        showDependencies: true,
        onRemoveDependency
      })
    );

    const connector = screen.getByLabelText("dependency-11-12");
    fireEvent.click(connector);
    fireEvent.keyDown(window, { key: "Delete" });

    await waitFor(() => {
      expect(onRemoveDependency).toHaveBeenCalledWith({
        predecessorWorkItemId: 11,
        successorWorkItemId: 12
      });
    });
  });

  it("colors violated FS dependencies red when predecessor end is after successor start", () => {
    render(
      React.createElement(TimelinePane, {
        timeline: makeViolatingDependencyTimeline(),
        showDependencies: true
      })
    );

    const connectorGroup = screen.getByLabelText("dependency-11-12");
    const visiblePath = connectorGroup.querySelector("path.timeline-dependency-line")!;
    expect(visiblePath.getAttribute("class")).toContain("timeline-dependency-line-violated");
    expect(visiblePath.getAttribute("marker-end")).toMatch(/^url\(#timeline-dependency-arrowhead-alert-/);
  });

  it("routes backward dependencies with a clean L-bend path", () => {
    render(
      React.createElement(TimelinePane, {
        timeline: makeViolatingDependencyTimeline(),
        showDependencies: true
      })
    );

    const connectorGroup = screen.getByLabelText("dependency-11-12");
    const visiblePath = connectorGroup.querySelector("path.timeline-dependency-line")!;
    const points = extractPathPoints(visiblePath.getAttribute("d"));
    expect(points.length).toBeGreaterThanOrEqual(3);

    const start = points[0];
    const endpoint = points[points.length - 1];
    expect(start.y).not.toBe(endpoint.y);
  });

  it("renders duplicate dependencies only once", () => {
    const timeline = makeDependencyTimeline();
    timeline.dependencies = [
      ...timeline.dependencies,
      {
        predecessorWorkItemId: 11,
        successorWorkItemId: 12,
        dependencyType: "FS",
        label: "#11 [end] -> #12 [start] (duplicate)"
      }
    ];

    render(
      React.createElement(TimelinePane, {
        timeline,
        showDependencies: true
      })
    );

    expect(screen.getAllByLabelText("dependency-11-12")).toHaveLength(1);
  });

  it("reroutes dependency paths when work item geometry changes", () => {
    const base = makeDependencyTimeline();

    const { rerender } = render(
      React.createElement(TimelinePane, {
        timeline: base,
        showDependencies: true
      })
    );

    const pathBeforeMove = screen.getByLabelText("dependency-11-12").querySelector("path.timeline-dependency-line")!.getAttribute("d");
    expect(pathBeforeMove).toBeTruthy();

    const timelineAfterMove: TimelineReadModel = {
      ...base,
      bars: base.bars.map((bar) =>
        bar.workItemId === 12
          ? {
              ...bar,
              schedule: {
                startDate: "2026-03-09T00:00:00.000Z",
                endDate: "2026-03-11T00:00:00.000Z",
                missingBoundary: null
              }
            }
          : bar
      )
    };

    rerender(
      React.createElement(TimelinePane, {
        timeline: timelineAfterMove,
        showDependencies: true
      })
    );

    const pathAfterMove = screen.getByLabelText("dependency-11-12").querySelector("path.timeline-dependency-line")!.getAttribute("d");
    expect(pathAfterMove).toBeTruthy();
    expect(pathAfterMove).not.toBe(pathBeforeMove);
  });

});
