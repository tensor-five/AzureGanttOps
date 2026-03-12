// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import { TimelinePane } from "./timeline-pane.js";
import { saveTimelineSortPreference } from "./timeline-sort-preference.js";
import { makeFieldFilterTimeline, makeTimeline, registerTimelinePaneSpecCleanup } from "./timeline-pane.test-helpers.js";

registerTimelinePaneSpecCleanup();

describe("timeline-pane layout and labels", () => {
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

  it("renders week labels starting just after weekly grid lines", () => {
    const { container } = render(
      React.createElement(TimelinePane, {
        timeline: makeTimeline(),
        showDependencies: true
      })
    );

    const weekLabel = container.querySelector("text.timeline-axis-label");
    const weekLine = container.querySelector("line.timeline-grid-line");
    expect(weekLabel).not.toBeNull();
    expect(weekLine).not.toBeNull();

    const labelX = Number((weekLabel as SVGTextElement).getAttribute("x"));
    const lineX = Number((weekLine as SVGLineElement).getAttribute("x1"));
    expect(labelX).toBe(lineX);
    expect((weekLabel as SVGTextElement).textContent ?? "").toMatch(/^\d{2}\.\d{2}\. \(KW\d{2}\)$/);
  });

  it("keeps month labels horizontally aligned with month boundary lines", async () => {
    const user = userEvent.setup();
    const { container } = render(
      React.createElement(TimelinePane, {
        timeline: makeTimeline(),
        showDependencies: true
      })
    );

    await user.click(screen.getByLabelText("Zoom out to month view"));

    const monthLabel = container.querySelector("text.timeline-axis-month-label");
    const monthLine = container.querySelector("line.timeline-month-boundary-line");
    expect(monthLabel).not.toBeNull();
    expect(monthLine).not.toBeNull();

    const labelX = Number((monthLabel as SVGTextElement).getAttribute("x"));
    const lineX = Number((monthLine as SVGLineElement).getAttribute("x1"));
    expect(labelX).toBe(lineX);
  });

  it("shows sorting toggle between the filter and label toggles", () => {
    render(
      React.createElement(TimelinePane, {
        timeline: makeFieldFilterTimeline(),
        showDependencies: true
      })
    );

    const filterToggle = screen.getByLabelText("Toggle timeline filters");
    const sortToggle = screen.getByLabelText("Toggle timeline sorting");
    const labelToggle = screen.getByLabelText("Toggle timeline label fields");
    expect(Boolean(filterToggle.compareDocumentPosition(sortToggle) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(Boolean(sortToggle.compareDocumentPosition(labelToggle) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  it("toggles filter, sort, and label menus via keyboard shortcuts", () => {
    render(
      React.createElement(TimelinePane, {
        timeline: makeFieldFilterTimeline(),
        showDependencies: true
      })
    );

    fireEvent.keyDown(window, { key: "f" });
    expect(screen.getByLabelText("Timeline filters")).toBeTruthy();
    fireEvent.keyDown(window, { key: "f" });
    expect(screen.queryByLabelText("Timeline filters")).toBeNull();

    fireEvent.keyDown(window, { key: "s" });
    expect(screen.getByLabelText("Timeline sorting")).toBeTruthy();
    fireEvent.keyDown(window, { key: "s" });
    expect(screen.queryByLabelText("Timeline sorting")).toBeNull();

    fireEvent.keyDown(window, { key: "l" });
    expect(screen.getByLabelText("Timeline label fields")).toBeTruthy();
    fireEvent.keyDown(window, { key: "l" });
    expect(screen.queryByLabelText("Timeline label fields")).toBeNull();
  });

  it("rotates dependency mode via d shortcut", () => {
    render(
      React.createElement(TimelinePane, {
        timeline: makeFieldFilterTimeline(),
        showDependencies: true
      })
    );

    const dependencyModeSelect = screen.getByLabelText("Dependency mode");
    expect((dependencyModeSelect as HTMLSelectElement).value).toBe("show");

    fireEvent.keyDown(window, { key: "d" });
    expect((dependencyModeSelect as HTMLSelectElement).value).toBe("edit");

    fireEvent.keyDown(window, { key: "d" });
    expect((dependencyModeSelect as HTMLSelectElement).value).toBe("violations");

    fireEvent.keyDown(window, { key: "d" });
    expect((dependencyModeSelect as HTMLSelectElement).value).toBe("none");

    fireEvent.keyDown(window, { key: "d" });
    expect((dependencyModeSelect as HTMLSelectElement).value).toBe("show");
  });

  it("switches zoom mode via m and w shortcuts", () => {
    render(
      React.createElement(TimelinePane, {
        timeline: makeFieldFilterTimeline(),
        showDependencies: true
      })
    );

    const weekZoomButton = screen.getByLabelText("Zoom in to week view");
    const monthZoomButton = screen.getByLabelText("Zoom out to month view");

    fireEvent.keyDown(window, { key: "m" });
    expect(monthZoomButton.getAttribute("aria-pressed")).toBe("true");
    expect(weekZoomButton.getAttribute("aria-pressed")).toBe("false");

    fireEvent.keyDown(window, { key: "w" });
    expect(weekZoomButton.getAttribute("aria-pressed")).toBe("true");
    expect(monthZoomButton.getAttribute("aria-pressed")).toBe("false");
  });

  it("toggles sidebar row alignment and persists the choice", async () => {
    const user = userEvent.setup();

    render(
      React.createElement(TimelinePane, {
        timeline: makeFieldFilterTimeline(),
        showDependencies: true
      })
    );

    const firstSidebarRow = screen.getByLabelText("timeline-sidebar-row-11");
    expect((firstSidebarRow as HTMLElement).style.justifyContent).toBe("flex-start");

    await user.click(screen.getByLabelText("Toggle timeline sidebar row alignment"));

    expect((firstSidebarRow as HTMLElement).style.justifyContent).toBe("flex-end");
    expect(globalThis.localStorage.getItem("azure-ganttops.timeline-sidebar-row-justify.v1")).toBe("flex-end");
  });

  it("sorts bars by start date by default", () => {
    const timeline = makeFieldFilterTimeline();
    timeline.bars = [
      {
        ...timeline.bars[0],
        workItemId: 30,
        title: "Late",
        schedule: {
          startDate: "2026-03-15T00:00:00.000Z",
          endDate: "2026-03-17T00:00:00.000Z",
          missingBoundary: null
        }
      },
      {
        ...timeline.bars[0],
        workItemId: 10,
        title: "Early",
        schedule: {
          startDate: "2026-03-01T00:00:00.000Z",
          endDate: "2026-03-03T00:00:00.000Z",
          missingBoundary: null
        }
      }
    ];
    timeline.unschedulable = [];

    render(
      React.createElement(TimelinePane, {
        timeline,
        showDependencies: true
      })
    );

    const earlyBarY = Number(screen.getByLabelText("timeline-bar-10").getAttribute("y"));
    const lateBarY = Number(screen.getByLabelText("timeline-bar-30").getAttribute("y"));
    expect(earlyBarY).toBeLessThan(lateBarY);
  });

  it("sorts start-date with 14-day fallback for end-only items", () => {
    const timeline = makeFieldFilterTimeline();
    timeline.bars = [
      {
        ...timeline.bars[0],
        workItemId: 31,
        title: "End only",
        schedule: {
          startDate: null,
          endDate: "2026-03-20T00:00:00.000Z",
          missingBoundary: "start"
        }
      },
      {
        ...timeline.bars[0],
        workItemId: 32,
        title: "Has start",
        schedule: {
          startDate: "2026-03-10T00:00:00.000Z",
          endDate: "2026-03-13T00:00:00.000Z",
          missingBoundary: null
        }
      }
    ];
    timeline.unschedulable = [];

    render(
      React.createElement(TimelinePane, {
        timeline,
        showDependencies: true
      })
    );

    // End-only item gets derived start (end - 13d => 2026-03-07), so it should be before 2026-03-10.
    const endOnlyY = Number(screen.getByLabelText("timeline-bar-31").getAttribute("y"));
    const hasStartY = Number(screen.getByLabelText("timeline-bar-32").getAttribute("y"));
    expect(endOnlyY).toBeLessThan(hasStartY);
  });

  it("sets Start date as secondary when primary sorting changes away from Start date", async () => {
    const user = userEvent.setup();
    render(
      React.createElement(TimelinePane, {
        timeline: makeFieldFilterTimeline(),
        showDependencies: true
      })
    );

    await user.click(screen.getByLabelText("Toggle timeline sorting"));
    await user.click(screen.getByLabelText("Timeline sort primary"));
    await user.type(screen.getByLabelText("Search timeline sort primary"), "title");
    await user.click(screen.getByRole("button", { name: /Title/ }));

    const secondaryTrigger = screen.getByLabelText("Timeline sort secondary");
    expect(secondaryTrigger.textContent).toContain("Start date");
  });

  it("applies changed sorting immediately", async () => {
    const user = userEvent.setup();
    saveTimelineSortPreference({
      primary: "startDate",
      secondary: null
    });
    const timeline = makeFieldFilterTimeline();
    timeline.bars = [
      {
        ...timeline.bars[0],
        workItemId: 11,
        title: "Zulu",
        schedule: {
          startDate: "2026-03-01T00:00:00.000Z",
          endDate: "2026-03-03T00:00:00.000Z",
          missingBoundary: null
        }
      },
      {
        ...timeline.bars[0],
        workItemId: 12,
        title: "Alpha",
        schedule: {
          startDate: "2026-03-05T00:00:00.000Z",
          endDate: "2026-03-07T00:00:00.000Z",
          missingBoundary: null
        }
      }
    ];
    timeline.unschedulable = [];

    const firstMount = render(
      React.createElement(TimelinePane, {
        timeline,
        showDependencies: true
      })
    );

    const before11Y = Number(screen.getByLabelText("timeline-bar-11").getAttribute("y"));
    const before12Y = Number(screen.getByLabelText("timeline-bar-12").getAttribute("y"));

    await user.click(screen.getByLabelText("Toggle timeline sorting"));
    await user.click(screen.getByLabelText("Timeline sort primary"));
    await user.type(screen.getByLabelText("Search timeline sort primary"), "title");
    await user.click(screen.getByRole("button", { name: /Title/ }));

    const after11Y = Number(screen.getByLabelText("timeline-bar-11").getAttribute("y"));
    const after12Y = Number(screen.getByLabelText("timeline-bar-12").getAttribute("y"));
    expect(after11Y).not.toBe(before11Y);
    expect(after12Y).not.toBe(before12Y);
    expect(after12Y).toBeLessThan(after11Y);

    firstMount.unmount();
  });

  it("composes bar labels from multiple configured fields with dash separator", async () => {
    const user = userEvent.setup();
    const timeline = makeFieldFilterTimeline();
    timeline.bars = [
      {
        ...timeline.bars[0],
        schedule: {
          startDate: "2026-03-01T00:00:00.000Z",
          endDate: "2026-04-10T00:00:00.000Z",
          missingBoundary: null
        }
      }
    ];
    timeline.unschedulable = [];

    const { container } = render(
      React.createElement(TimelinePane, {
        timeline,
        showDependencies: true
      })
    );

    await user.click(screen.getByLabelText("Toggle timeline label fields"));
    await user.click(screen.getByLabelText("Show Team in timeline bars"));
    await user.click(screen.getByLabelText("Show Stream in timeline bars"));

    const label = container.querySelector("text.timeline-bar-label");
    expect(label).not.toBeNull();
    expect((label as SVGTextElement).textContent).toBe("Alpha Platform - Alpha - Platform");
  });

  it("can hide all bar labels via label settings", async () => {
    const user = userEvent.setup();
    const timeline = makeFieldFilterTimeline();
    timeline.bars = [
      {
        ...timeline.bars[0],
        schedule: {
          startDate: "2026-03-01T00:00:00.000Z",
          endDate: "2026-04-10T00:00:00.000Z",
          missingBoundary: null
        }
      }
    ];
    timeline.unschedulable = [];

    const { container } = render(
      React.createElement(TimelinePane, {
        timeline,
        showDependencies: true
      })
    );

    await user.click(screen.getByLabelText("Toggle timeline label fields"));
    await user.click(screen.getByRole("button", { name: "Nothing in bars" }));

    const label = container.querySelector("text.timeline-bar-label");
    expect(label).toBeNull();
  });

  it("shows configured values in left sidebar and can hide them", async () => {
    const user = userEvent.setup();
    const timeline = makeFieldFilterTimeline();
    timeline.unschedulable = [];

    render(
      React.createElement(TimelinePane, {
        timeline,
        showDependencies: true
      })
    );

    await user.click(screen.getByLabelText("Toggle timeline label fields"));
    await user.click(screen.getByLabelText("Show Team in timeline sidebar"));

    expect(screen.getByLabelText("timeline-sidebar-row-11").textContent).toContain("Alpha Platform");
    expect(screen.getByLabelText("timeline-sidebar-row-11").textContent).toContain("Alpha");

    await user.click(screen.getByRole("button", { name: "Nothing in sidebar" }));
    expect(screen.queryByLabelText("timeline-sidebar-row-11")).toBeNull();
    expect(screen.getByLabelText("Configure timeline sidebar fields")).toBeTruthy();
  });

  it("opens the existing label settings from collapsed sidebar gear", async () => {
    const user = userEvent.setup();
    const timeline = makeFieldFilterTimeline();
    timeline.unschedulable = [];

    render(
      React.createElement(TimelinePane, {
        timeline,
        showDependencies: true
      })
    );

    await user.click(screen.getByLabelText("Toggle timeline label fields"));
    await user.click(screen.getByRole("button", { name: "Nothing in sidebar" }));
    await user.click(screen.getByLabelText("Configure timeline sidebar fields"));

    expect(screen.getByLabelText("Timeline label fields")).toBeTruthy();
  });

});
