import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import { TimelinePane, applyAdoptedSchedules } from "./timeline-pane.js";
import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";

afterEach(() => {
  cleanup();
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
    await user.click(screen.getByRole("button", { name: "#22 Target Item (missing-both-dates)" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "#22 Target Item (missing-both-dates)" })).toBeNull();
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

    const unscheduledButton = screen.getByRole("button", { name: "#22 Target Item (missing-both-dates)" });
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

    const unscheduledButton = screen.getByRole("button", { name: "#22 Target Item (missing-both-dates)" });
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
});
