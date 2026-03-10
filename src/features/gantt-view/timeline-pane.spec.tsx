import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import { TimelinePane, applyAdoptedSchedules } from "./timeline-pane.js";
import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";
import {
  clearTimelineColorCodingPreferenceForTests,
  saveLastTimelineColorCoding
} from "./timeline-color-coding-preference.js";

afterEach(() => {
  cleanup();
  clearTimelineColorCodingPreferenceForTests();
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
    unschedulable: [
      {
        workItemId: 22,
        title: "Target Item",
        state: { code: "New", badge: "N", color: "#2b6cb0" },
        details: { mappedId: "22" },
        reason: "missing-both-dates"
      }
    ],
    dependencies: [],
    suppressedDependencies: [],
    mappingValidation: {
      status: "valid",
      issues: []
    }
  };
}

function makeDependencyTimeline(): TimelineReadModel {
  const base = makeTimeline();
  return {
    ...base,
    bars: [
      base.bars[0],
      {
        ...base.bars[0],
        workItemId: 12,
        title: "Dependent Item",
        details: { mappedId: "12" },
        schedule: {
          startDate: "2026-03-05T00:00:00.000Z",
          endDate: "2026-03-07T00:00:00.000Z",
          missingBoundary: null
        }
      }
    ],
    unschedulable: [],
    dependencies: [
      {
        predecessorWorkItemId: 11,
        successorWorkItemId: 12,
        dependencyType: "FS",
        label: "#11 [end] -> #12 [start]"
      }
    ]
  };
}

function makeViolatingDependencyTimeline(): TimelineReadModel {
  const base = makeDependencyTimeline();
  return {
    ...base,
    bars: [
      {
        ...base.bars[0],
        workItemId: 11,
        details: { mappedId: "11" },
        schedule: {
          startDate: "2026-03-06T00:00:00.000Z",
          endDate: "2026-03-10T00:00:00.000Z",
          missingBoundary: null
        }
      },
      {
        ...base.bars[1],
        workItemId: 12,
        details: { mappedId: "12" },
        schedule: {
          startDate: "2026-03-07T00:00:00.000Z",
          endDate: "2026-03-08T00:00:00.000Z",
          missingBoundary: null
        }
      }
    ]
  };
}

function extractPathPoints(pathValue: string | null): Array<{ x: number; y: number }> {
  if (!pathValue) {
    return [];
  }

  const segments = pathValue
    .replace(/^M\s*/, "")
    .split(" L ")
    .map((segment) => segment.trim());
  return segments
    .map((segment) => {
      const [xRaw, yRaw] = segment.split(/\s+/);
      const x = Number(xRaw);
      const y = Number(yRaw);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null;
      }
      return { x, y };
    })
    .filter((point): point is { x: number; y: number } => point !== null);
}

function createDataTransferMock(): DataTransfer {
  const store = new Map<string, string>();
  return {
    dropEffect: "none",
    effectAllowed: "all",
    files: [] as unknown as FileList,
    items: [] as unknown as DataTransferItemList,
    types: [],
    clearData: (format?: string) => {
      if (typeof format === "string") {
        store.delete(format);
      } else {
        store.clear();
      }
    },
    getData: (format: string) => store.get(format) ?? "",
    setData: (format: string, data: string) => {
      store.set(format, data);
    },
    setDragImage: () => undefined
  } as DataTransfer;
}

describe("timeline-pane unschedulable date adoption", () => {
  it("moves adopted unschedulable items into bars with copied schedule", () => {
    const next = applyAdoptedSchedules(makeTimeline(), {
      22: {
        startDate: "2026-03-01T00:00:00.000Z",
        endDate: "2026-03-03T00:00:00.000Z"
      }
    });

    expect(next?.bars.some((bar) => bar.workItemId === 22)).toBe(true);
    expect(next?.unschedulable.some((item) => item.workItemId === 22)).toBe(false);
    const adopted = next?.bars.find((bar) => bar.workItemId === 22);
    expect(adopted?.schedule.startDate).toBe("2026-03-01T00:00:00.000Z");
    expect(adopted?.schedule.endDate).toBe("2026-03-03T00:00:00.000Z");
  });

  it("copies start/end from selected schedulable item when unschedulable is clicked", async () => {
    const user = userEvent.setup();

    render(
      React.createElement(TimelinePane, {
        timeline: makeTimeline(),
        showDependencies: true
      })
    );

    await user.click(screen.getByLabelText("timeline-bar-11"));
    await user.click(screen.getByRole("button", { name: /#22 Target Item/ }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /#22 Target Item/ })).toBeNull();
    });
    const detailsText = screen.getByLabelText("timeline-details-panel").textContent ?? "";
    expect(detailsText).toContain("- selected work item: #22");
    expect(detailsText).toContain("- start: 2026-03-01T00:00:00.000Z");
    expect(detailsText).toContain("- end: 2026-03-03T00:00:00.000Z");
  });

  it("updates schedule when dragging a bar", async () => {
    const onUpdateWorkItemSchedule = vi.fn(async () => undefined);
    const user = userEvent.setup();

    render(
      React.createElement(TimelinePane, {
        timeline: makeTimeline(),
        showDependencies: true,
        onUpdateWorkItemSchedule
      })
    );

    await user.click(screen.getByLabelText("timeline-bar-11"));

    const chart = screen.getByLabelText("gantt-chart");
    const bar = screen.getByLabelText("timeline-bar-11");

    fireEvent.pointerDown(bar, { pointerId: 1, button: 0, clientX: 100 });
    fireEvent.pointerMove(chart, { pointerId: 1, clientX: 122 });
    fireEvent.pointerUp(chart, { pointerId: 1, clientX: 122 });

    await waitFor(() => {
      expect(onUpdateWorkItemSchedule).toHaveBeenCalledWith({
        targetWorkItemId: 11,
        startDate: "2026-03-02T00:00:00.000Z",
        endDate: "2026-03-04T00:00:00.000Z"
      });
    });
  });

  it("updates end date when dragging end handle", async () => {
    const onUpdateWorkItemSchedule = vi.fn(async () => undefined);

    render(
      React.createElement(TimelinePane, {
        timeline: makeTimeline(),
        showDependencies: true,
        onUpdateWorkItemSchedule
      })
    );

    const chart = screen.getByLabelText("gantt-chart");
    const endHandle = screen.getByLabelText("timeline-bar-end-handle-11");

    fireEvent.pointerDown(endHandle, { pointerId: 2, button: 0, clientX: 100 });
    fireEvent.pointerMove(chart, { pointerId: 2, clientX: 144 });
    fireEvent.pointerUp(chart, { pointerId: 2, clientX: 144 });

    await waitFor(() => {
      expect(onUpdateWorkItemSchedule).toHaveBeenCalledWith({
        targetWorkItemId: 11,
        startDate: "2026-03-01T00:00:00.000Z",
        endDate: "2026-03-05T00:00:00.000Z"
      });
    });
  });

  it("drops unscheduled items into chart with default 14-day duration", async () => {
    const onUpdateWorkItemSchedule = vi.fn(async () => undefined);
    const dataTransfer = createDataTransferMock();

    render(
      React.createElement(TimelinePane, {
        timeline: makeTimeline(),
        showDependencies: true,
        onUpdateWorkItemSchedule
      })
    );

    const unscheduledButton = screen.getByRole("button", { name: /#22 Target Item/ });
    const chart = screen.getByLabelText("gantt-chart");

    fireEvent.dragStart(unscheduledButton, { dataTransfer });
    fireEvent.dragOver(chart, { dataTransfer, clientX: 68 });
    fireEvent.drop(chart, { dataTransfer, clientX: 68 });

    await waitFor(() => {
      expect(onUpdateWorkItemSchedule).toHaveBeenCalledTimes(1);
    });
    const firstCall = (onUpdateWorkItemSchedule.mock.calls as unknown as Array<[unknown]>)[0];
    const call = firstCall[0] as {
      targetWorkItemId: number;
      startDate: string;
      endDate: string;
    };
    expect(call.targetWorkItemId).toBe(22);
    const start = new Date(call.startDate);
    const end = new Date(call.endDate);
    const dayDelta = Math.floor((end.getTime() - start.getTime()) / 86_400_000);
    expect(dayDelta).toBe(13);
  });

  it("renders end-only bars with a default two-week length", () => {
    const timeline = makeTimeline();
    timeline.bars = [
      {
        ...timeline.bars[0],
        schedule: {
          startDate: null,
          endDate: "2026-03-10T00:00:00.000Z",
          missingBoundary: "start"
        }
      }
    ];

    render(
      React.createElement(TimelinePane, {
        timeline,
        showDependencies: true
      })
    );

    const bar = screen.getByLabelText("timeline-bar-11");
    expect(bar.getAttribute("width")).toBe("308");
  });

  it("uses tighter vertical spacing between bars", () => {
    const timeline = makeTimeline();
    timeline.bars = [
      timeline.bars[0],
      {
        ...timeline.bars[0],
        workItemId: 12,
        details: { mappedId: "12" },
        title: "Second Item"
      }
    ];

    render(
      React.createElement(TimelinePane, {
        timeline,
        showDependencies: true
      })
    );

    const firstBarY = Number(screen.getByLabelText("timeline-bar-11").getAttribute("y"));
    const secondBarY = Number(screen.getByLabelText("timeline-bar-12").getAttribute("y"));
    expect(secondBarY - firstBarY).toBe(26);
  });

  it("renders visible predecessor/successor connectors with arrowheads", () => {
    render(
      React.createElement(TimelinePane, {
        timeline: makeDependencyTimeline(),
        showDependencies: true
      })
    );

    const connector = screen.getByLabelText("dependency-11-12");
    expect(connector.getAttribute("marker-end")).toMatch(/^url\(#timeline-dependency-arrowhead-/);
    expect(connector.getAttribute("d")).toContain("L");
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

    fireEvent.click(screen.getByRole("button", { name: "Cycle dependency mode" }));

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

    fireEvent.click(screen.getByRole("button", { name: "Cycle dependency mode" }));

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

  it("cycles dependency toggle through Show -> Edit -> No -> Show", () => {
    render(
      React.createElement(TimelinePane, {
        timeline: makeDependencyTimeline(),
        showDependencies: true
      })
    );

    const cycleButton = screen.getByRole("button", { name: "Cycle dependency mode" });
    expect(cycleButton.textContent).toContain("Show Dependency");
    expect(screen.queryByLabelText("dependency-11-12")).not.toBeNull();

    fireEvent.click(cycleButton);
    expect(cycleButton.textContent).toContain("Edit Dependency");
    expect(screen.queryByLabelText("dependency-11-12")).not.toBeNull();

    fireEvent.click(cycleButton);
    expect(cycleButton.textContent).toContain("No Dependency");
    expect(screen.queryByLabelText("dependency-11-12")).toBeNull();

    fireEvent.click(cycleButton);
    expect(cycleButton.textContent).toContain("Show Dependency");
    expect(screen.queryByLabelText("dependency-11-12")).not.toBeNull();
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

    const connector = screen.getByLabelText("dependency-11-12");
    expect(connector.getAttribute("class")).toContain("timeline-dependency-line-violated");
    expect(connector.getAttribute("marker-end")).toMatch(/^url\(#timeline-dependency-arrowhead-alert-/);
  });

  it("routes backward dependencies to enter successor from the left side", () => {
    render(
      React.createElement(TimelinePane, {
        timeline: makeViolatingDependencyTimeline(),
        showDependencies: true
      })
    );

    const connector = screen.getByLabelText("dependency-11-12");
    const points = extractPathPoints(connector.getAttribute("d"));
    expect(points.length).toBeGreaterThanOrEqual(5);

    const penultimate = points[points.length - 2];
    const endpoint = points[points.length - 1];
    expect(penultimate.x).toBeLessThan(endpoint.x);
  });

  it("extends chart width to match visible viewport beyond work item range", async () => {
    const clientWidthSpy = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1600);

    try {
      render(
        React.createElement(TimelinePane, {
          timeline: makeTimeline(),
          showDependencies: true
        })
      );

      await waitFor(() => {
        const chart = screen.getByLabelText("gantt-chart");
        const viewBox = chart.getAttribute("viewBox");
        expect(viewBox).not.toBeNull();
        const width = Number((viewBox as string).split(" ")[2]);
        expect(width).toBe(1600);
      });
    } finally {
      clientWidthSpy.mockRestore();
    }
  });

  it("draws the today line through the full chart height", () => {
    const todayUtc = new Date();
    const normalizedTodayUtc = new Date(
      Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate())
    );
    const endUtc = new Date(normalizedTodayUtc.getTime());
    endUtc.setUTCDate(endUtc.getUTCDate() + 1);

    const timeline = makeTimeline();
    timeline.bars = [
      {
        ...timeline.bars[0],
        schedule: {
          startDate: normalizedTodayUtc.toISOString(),
          endDate: endUtc.toISOString(),
          missingBoundary: null
        }
      }
    ];

    const { container } = render(
      React.createElement(TimelinePane, {
        timeline,
        showDependencies: true
      })
    );

    const todayLine = container.querySelector("line.timeline-today-line");
    expect(todayLine).not.toBeNull();

    const chart = screen.getByLabelText("gantt-chart");
    const viewBox = chart.getAttribute("viewBox");
    expect(viewBox).not.toBeNull();
    const viewBoxHeight = Number((viewBox as string).split(" ")[3]);
    const todayLineEndY = Number((todayLine as SVGLineElement).getAttribute("y2"));
    expect(todayLineEndY).toBe(viewBoxHeight - 18);
  });

  it("keeps existing end date when dropping unscheduled item into chart", async () => {
    const onUpdateWorkItemSchedule = vi.fn(async () => undefined);
    const dataTransfer = createDataTransferMock();
    const timeline = makeTimeline();
    timeline.unschedulable = [
      {
        ...timeline.unschedulable[0],
        schedule: {
          startDate: null,
          endDate: "2026-03-10T00:00:00.000Z",
          missingBoundary: "start"
        }
      }
    ];

    render(
      React.createElement(TimelinePane, {
        timeline,
        showDependencies: true,
        onUpdateWorkItemSchedule
      })
    );

    const unscheduledButton = screen.getByRole("button", { name: /#22 Target Item/ });
    const chart = screen.getByLabelText("gantt-chart");

    fireEvent.dragStart(unscheduledButton, { dataTransfer });
    fireEvent.dragOver(chart, { dataTransfer, clientX: 68 });
    fireEvent.drop(chart, { dataTransfer, clientX: 68 });

    await waitFor(() => {
      expect(onUpdateWorkItemSchedule).toHaveBeenCalledTimes(1);
    });
    const firstCall = (onUpdateWorkItemSchedule.mock.calls as unknown as Array<[unknown]>)[0];
    const call = firstCall[0] as {
      targetWorkItemId: number;
      startDate: string;
      endDate: string;
    };
    expect(call.targetWorkItemId).toBe(22);
    expect(call.endDate).toBe("2026-03-10T00:00:00.000Z");
    expect(new Date(call.startDate).getTime()).toBeLessThanOrEqual(new Date(call.endDate).getTime());
  });

  it("uses dark neutral bars when no color coding is selected", () => {
    const { container } = render(
      React.createElement(TimelinePane, {
        timeline: makeTimeline(),
        showDependencies: true
      })
    );

    const colorCodingButton = screen.getByLabelText("Color coding") as HTMLButtonElement;
    expect(colorCodingButton.textContent).toContain("None");

    const bar = container.querySelector("rect.timeline-bar");
    expect(bar).not.toBeNull();
    expect((bar as SVGRectElement).style.fill).toBe("rgb(55, 65, 81)");

    const stateDot = container.querySelector("circle.timeline-bar-state-dot");
    expect(stateDot).not.toBeNull();
    expect((stateDot as SVGCircleElement).style.fill).toBe("rgb(47, 133, 90)");
  });

  it("switches to status color coding from dropdown", async () => {
    const user = userEvent.setup();
    const { container } = render(
      React.createElement(TimelinePane, {
        timeline: {
          ...makeTimeline(),
          bars: [
            makeTimeline().bars[0],
            {
              ...makeTimeline().bars[0],
              workItemId: 12,
              title: "Second",
              state: { code: "New", badge: "N", color: "#2b6cb0" },
              details: { mappedId: "12" }
            }
          ]
        },
        showDependencies: true
      })
    );

    const colorCodingButton = screen.getByLabelText("Color coding");
    await user.click(colorCodingButton);
    await user.type(screen.getByLabelText("Search color coding"), "status");
    await user.click(screen.getByRole("button", { name: /Status/ }));

    const bars = container.querySelectorAll("rect.timeline-bar");
    expect(bars).toHaveLength(2);
    expect((bars[0] as SVGRectElement).style.fill).not.toBe((bars[1] as SVGRectElement).style.fill);
  });

  it("loads persisted timeline color coding", () => {
    saveLastTimelineColorCoding("overdue");

    render(
      React.createElement(TimelinePane, {
        timeline: makeTimeline(),
        showDependencies: true
      })
    );

    const colorCodingButton = screen.getByLabelText("Color coding") as HTMLButtonElement;
    expect(colorCodingButton.textContent).toContain("Overdue");
  });

  it("supports field-based color coding via searchable field selector", async () => {
    const user = userEvent.setup();
    const timeline = makeTimeline();
    timeline.bars = [
      {
        ...timeline.bars[0],
        workItemId: 11,
        details: { mappedId: "11", fieldValues: { "System.AreaPath": "Team/A" } }
      },
      {
        ...timeline.bars[0],
        workItemId: 12,
        title: "Second Item",
        details: { mappedId: "12", fieldValues: { "System.AreaPath": "Team/B" } }
      }
    ];

    const { container } = render(
      React.createElement(TimelinePane, {
        timeline,
        showDependencies: true
      })
    );

    const colorCodingButton = screen.getByLabelText("Color coding");
    await user.click(colorCodingButton);
    await user.type(screen.getByLabelText("Search color coding"), "areapath");
    await user.click(screen.getByRole("button", { name: /AreaPath/ }));

    const bars = container.querySelectorAll("rect.timeline-bar");
    expect(bars).toHaveLength(2);
    expect((bars[0] as SVGRectElement).style.fill).not.toBe((bars[1] as SVGRectElement).style.fill);
  });

  it("updates settings value list when switching selected field from color coding dropdown", async () => {
    const user = userEvent.setup();
    const timeline = makeTimeline();
    timeline.bars = [
      {
        ...timeline.bars[0],
        workItemId: 11,
        details: {
          mappedId: "11",
          fieldValues: {
            "Custom.Team": "Alpha",
            "Custom.Stream": "Platform"
          }
        }
      },
      {
        ...timeline.bars[0],
        workItemId: 12,
        title: "Second Item",
        details: {
          mappedId: "12",
          fieldValues: {
            "Custom.Team": "Beta",
            "Custom.Stream": "Business"
          }
        }
      }
    ];

    render(
      React.createElement(TimelinePane, {
        timeline,
        showDependencies: true
      })
    );

    await user.click(screen.getByLabelText("Color coding"));
    await user.type(screen.getByLabelText("Search color coding"), "team");
    await user.click(screen.getByRole("button", { name: /Team/ }));

    await user.click(screen.getByLabelText("Open color coding settings"));
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.getByText("Beta")).toBeTruthy();
    expect(screen.queryByText("Platform")).toBeNull();

    await user.click(screen.getByLabelText("Color coding"));
    await user.clear(screen.getByLabelText("Search color coding"));
    await user.type(screen.getByLabelText("Search color coding"), "stream");
    await user.click(screen.getByRole("button", { name: /Stream/ }));

    expect(screen.getByText("Platform")).toBeTruthy();
    expect(screen.getByText("Business")).toBeTruthy();
    expect(screen.queryByText("Alpha")).toBeNull();
  });

  it("does not show stale field value list in settings when switching to status mode", async () => {
    const user = userEvent.setup();
    const timeline = makeTimeline();
    timeline.bars = [
      {
        ...timeline.bars[0],
        details: { mappedId: "11", fieldValues: { "Custom.Team": "Alpha" } }
      }
    ];

    render(
      React.createElement(TimelinePane, {
        timeline,
        showDependencies: true
      })
    );

    await user.click(screen.getByLabelText("Color coding"));
    await user.type(screen.getByLabelText("Search color coding"), "team");
    await user.click(screen.getByRole("button", { name: /Team/ }));

    await user.click(screen.getByLabelText("Open color coding settings"));
    expect(screen.getByText("Alpha")).toBeTruthy();

    await user.click(screen.getByLabelText("Color coding"));
    await user.clear(screen.getByLabelText("Search color coding"));
    await user.type(screen.getByLabelText("Search color coding"), "status");
    await user.click(screen.getByRole("button", { name: /Status/ }));

    expect(screen.queryByText("Alpha")).toBeNull();
    expect(screen.getByText("Mode: Status")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText("New")).toBeTruthy();
  });

  it("selects filtered field option on Enter so settings use that field", async () => {
    const user = userEvent.setup();
    const timeline = makeTimeline();
    timeline.bars = [
      {
        ...timeline.bars[0],
        details: { mappedId: "11", fieldValues: { "Custom.Team": "Alpha" } }
      }
    ];

    render(
      React.createElement(TimelinePane, {
        timeline,
        showDependencies: true
      })
    );

    await user.click(screen.getByLabelText("Color coding"));
    const search = screen.getByLabelText("Search color coding");
    await user.type(search, "team");
    await user.keyboard("{Enter}");

    await user.click(screen.getByLabelText("Open color coding settings"));
    expect(screen.getAllByText(/Field: Custom\.Team/).length).toBeGreaterThan(0);
    expect(screen.getByText("Alpha")).toBeTruthy();
  });

  it("uses full field ref for settings when selecting field from dropdown", async () => {
    const user = userEvent.setup();
    const timeline = makeTimeline();
    timeline.bars = [
      {
        ...timeline.bars[0],
        state: { code: "Active", badge: "A", color: "#1d4ed8" },
        details: {
          mappedId: "11",
          fieldValues: {
            "System.State": "Active"
          }
        }
      }
    ];

    render(
      React.createElement(TimelinePane, {
        timeline,
        showDependencies: true
      })
    );

    await user.click(screen.getByLabelText("Color coding"));
    await user.type(screen.getByLabelText("Search color coding"), "state");
    await user.keyboard("{Enter}");

    await user.click(screen.getByLabelText("Open color coding settings"));
    expect(screen.getByText("Active selection: Field: State")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
  });

  it("shows person values in settings and allows person color mapping", async () => {
    const user = userEvent.setup();
    const timeline = makeTimeline();
    timeline.bars = [
      {
        ...timeline.bars[0],
        workItemId: 11,
        details: { mappedId: "11", assignedTo: "Alice" }
      },
      {
        ...timeline.bars[0],
        workItemId: 12,
        title: "Second Item",
        details: { mappedId: "12", assignedTo: "Bob" }
      }
    ];

    render(
      React.createElement(TimelinePane, {
        timeline,
        showDependencies: true
      })
    );

    await user.click(screen.getByLabelText("Color coding"));
    await user.type(screen.getByLabelText("Search color coding"), "person");
    await user.click(screen.getByRole("button", { name: /Person/ }));

    await user.click(screen.getByLabelText("Open color coding settings"));
    expect(screen.getByText("Mode: Person")).toBeTruthy();
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("Bob")).toBeTruthy();
  });

  it("shows status values in settings and allows status color mapping", async () => {
    const user = userEvent.setup();
    const timeline = makeTimeline();
    timeline.bars = [
      {
        ...timeline.bars[0],
        workItemId: 11,
        state: { code: "Doing", badge: "D", color: "#007acc" },
        details: { mappedId: "11", assignedTo: "Alice" }
      },
      {
        ...timeline.bars[0],
        workItemId: 12,
        title: "Second Item",
        state: { code: "Done", badge: "X", color: "#339933" },
        details: { mappedId: "12", assignedTo: "Bob" }
      }
    ];

    const { container } = render(
      React.createElement(TimelinePane, {
        timeline,
        showDependencies: true
      })
    );

    await user.click(screen.getByLabelText("Color coding"));
    await user.type(screen.getByLabelText("Search color coding"), "status");
    await user.click(screen.getByRole("button", { name: /Status/ }));

    await user.click(screen.getByLabelText("Open color coding settings"));
    expect(screen.getByText("Mode: Status")).toBeTruthy();
    expect(screen.getByText("Doing")).toBeTruthy();
    expect(screen.getByText("Done")).toBeTruthy();

    const doingColorInput = screen.getByLabelText("Color for Doing") as HTMLInputElement;
    fireEvent.change(doingColorInput, { target: { value: "#ff0000" } });

    const bars = container.querySelectorAll("rect.timeline-bar");
    expect((bars[0] as SVGRectElement).style.fill).toBe("rgb(255, 0, 0)");
  });

  it("shows loading state in refresh button while refresh is in progress", () => {
    render(
      React.createElement(TimelinePane, {
        timeline: makeTimeline(),
        showDependencies: true,
        isRefreshing: true
      })
    );

    const button = screen.getByRole("button", { name: "Updating..." });
    expect(button.getAttribute("disabled")).not.toBeNull();
    expect(button.querySelector(".timeline-action-button-spinner")).not.toBeNull();
  });

  it("triggers refresh when pressing r outside editable fields", () => {
    const onRetryRefresh = vi.fn();

    render(
      React.createElement(TimelinePane, {
        timeline: makeTimeline(),
        showDependencies: true,
        onRetryRefresh
      })
    );

    fireEvent.keyDown(window, { key: "r" });
    expect(onRetryRefresh).toHaveBeenCalledTimes(1);
  });

  it("does not trigger refresh when pressing r inside an input field", async () => {
    const onRetryRefresh = vi.fn();
    const user = userEvent.setup();

    render(
      React.createElement(TimelinePane, {
        timeline: makeTimeline(),
        showDependencies: true,
        onRetryRefresh
      })
    );

    await user.click(screen.getByLabelText("timeline-bar-11"));
    const titleInput = screen.getByLabelText("Title");
    titleInput.focus();
    fireEvent.keyDown(titleInput, { key: "r" });

    expect(onRetryRefresh).not.toHaveBeenCalled();
  });
});
