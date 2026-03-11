// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import { TimelinePane, applyAdoptedSchedules } from "./timeline-pane.js";
import { createDataTransferMock, makeTimeline, registerTimelinePaneSpecCleanup } from "./timeline-pane.test-helpers.js";

registerTimelinePaneSpecCleanup();

describe("timeline-pane dragging", () => {
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

  it("zooms chart to fit visible timeline range via fit button", async () => {
    const clientWidthSpy = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1200);

    try {
      render(
        React.createElement(TimelinePane, {
          timeline: makeTimeline(),
          showDependencies: true
        })
      );

      const bar = screen.getByLabelText("timeline-bar-11");
      const beforeWidth = Number(bar.getAttribute("width"));
      expect(beforeWidth).toBe(66);

      fireEvent.click(screen.getByRole("button", { name: "Zoom to fit timeline" }));

      await waitFor(() => {
        const afterWidth = Number(screen.getByLabelText("timeline-bar-11").getAttribute("width"));
        expect(afterWidth).toBeGreaterThan(beforeWidth);
      });
    } finally {
      clientWidthSpy.mockRestore();
    }
  });

  it("pans timeline while holding space and dragging", async () => {
    const clientWidthSpy = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(280);

    try {
      const { container } = render(
        React.createElement(TimelinePane, {
          timeline: makeTimeline(),
          showDependencies: true
        })
      );

      const scrollContainer = container.querySelector(".timeline-chart-scroll") as HTMLDivElement | null;
      expect(scrollContainer).not.toBeNull();

      (scrollContainer as HTMLDivElement).scrollLeft = 100;
      (scrollContainer as HTMLDivElement).scrollTop = 40;

      fireEvent.keyDown(window, { key: " " });
      fireEvent.pointerDown(scrollContainer as HTMLDivElement, { pointerId: 7, button: 0, clientX: 220, clientY: 180 });
      fireEvent.pointerMove(scrollContainer as HTMLDivElement, { pointerId: 7, clientX: 180, clientY: 160 });
      fireEvent.pointerUp(scrollContainer as HTMLDivElement, { pointerId: 7, clientX: 180, clientY: 160 });
      fireEvent.keyUp(window, { key: " " });

      expect((scrollContainer as HTMLDivElement).scrollLeft).toBeGreaterThan(100);
      expect((scrollContainer as HTMLDivElement).scrollTop).toBeGreaterThan(40);
    } finally {
      clientWidthSpy.mockRestore();
    }
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
