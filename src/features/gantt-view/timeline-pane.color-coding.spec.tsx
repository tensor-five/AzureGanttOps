// @vitest-environment jsdom
import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import { TimelinePane } from "./timeline-pane.js";
import { saveLastTimelineColorCoding } from "./timeline-color-coding-preference.js";
import { makeTimeline, registerTimelinePaneSpecCleanup } from "./timeline-pane.test-helpers.js";

registerTimelinePaneSpecCleanup();

describe("timeline-pane color coding", () => {
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

  it("treats resolved items as overdue in overdue mode", () => {
    saveLastTimelineColorCoding("overdue");
    const { container } = render(
      React.createElement(TimelinePane, {
        timeline: {
          ...makeTimeline(),
          bars: [
            {
              ...makeTimeline().bars[0],
              workItemId: 11,
              state: { code: "Resolved", badge: "R", color: "#2f855a" },
              schedule: {
                startDate: "2000-01-01T00:00:00.000Z",
                endDate: "2000-01-02T00:00:00.000Z",
                missingBoundary: null
              },
              details: { mappedId: "11" }
            },
            {
              ...makeTimeline().bars[0],
              workItemId: 12,
              state: { code: "Done", badge: "D", color: "#2f855a" },
              schedule: {
                startDate: "2000-01-03T00:00:00.000Z",
                endDate: "2000-01-04T00:00:00.000Z",
                missingBoundary: null
              },
              details: { mappedId: "12" }
            }
          ]
        },
        showDependencies: true
      })
    );

    const bars = container.querySelectorAll("rect.timeline-bar");
    expect(bars).toHaveLength(2);
    expect((bars[0] as SVGRectElement).style.fill).toBe("rgb(185, 28, 28)");
    expect((bars[1] as SVGRectElement).style.fill).toBe("rgb(71, 85, 105)");
  });

  it("lets users configure which statuses are excluded from overdue highlighting", async () => {
    const user = userEvent.setup();
    saveLastTimelineColorCoding("overdue");
    const { container } = render(
      React.createElement(TimelinePane, {
        timeline: {
          ...makeTimeline(),
          bars: [
            {
              ...makeTimeline().bars[0],
              workItemId: 11,
              state: { code: "Done", badge: "D", color: "#2f855a" },
              schedule: {
                startDate: "2000-01-01T00:00:00.000Z",
                endDate: "2000-01-02T00:00:00.000Z",
                missingBoundary: null
              },
              details: { mappedId: "11" }
            },
            {
              ...makeTimeline().bars[0],
              workItemId: 12,
              state: { code: "Resolved", badge: "R", color: "#2f855a" },
              schedule: {
                startDate: "2000-01-03T00:00:00.000Z",
                endDate: "2000-01-04T00:00:00.000Z",
                missingBoundary: null
              },
              details: { mappedId: "12" }
            }
          ]
        },
        showDependencies: true
      })
    );

    let bars = container.querySelectorAll("rect.timeline-bar");
    expect(bars).toHaveLength(2);
    expect((bars[0] as SVGRectElement).style.fill).toBe("rgb(71, 85, 105)");
    expect((bars[1] as SVGRectElement).style.fill).toBe("rgb(185, 28, 28)");

    await user.click(screen.getByLabelText("Open color coding settings"));
    await user.click(screen.getByLabelText("Treat Done as completed"));

    bars = container.querySelectorAll("rect.timeline-bar");
    expect((bars[0] as SVGRectElement).style.fill).toBe("rgb(185, 28, 28)");
    expect((bars[1] as SVGRectElement).style.fill).toBe("rgb(185, 28, 28)");
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

  it("applies status selection when searching state via Enter", async () => {
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
    expect(screen.getByText("Active selection: Status")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
  });

  it("shows parent values in settings and allows parent color mapping", async () => {
    const user = userEvent.setup();
    const timeline = makeTimeline();
    timeline.bars = [
      {
        ...timeline.bars[0],
        workItemId: 11,
        details: { mappedId: "11", parentWorkItemId: null }
      },
      {
        ...timeline.bars[0],
        workItemId: 12,
        title: "Second Item",
        details: { mappedId: "12", parentWorkItemId: 11 }
      }
    ];

    render(
      React.createElement(TimelinePane, {
        timeline,
        showDependencies: true
      })
    );

    await user.click(screen.getByLabelText("Color coding"));
    await user.type(screen.getByLabelText("Search color coding"), "parent");
    await user.click(screen.getByRole("button", { name: /Parent/ }));

    await user.click(screen.getByLabelText("Open color coding settings"));
    expect(screen.getByText("Mode: Parent")).toBeTruthy();
  });

  it("shows status values in settings as read-only with system hint", async () => {
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

    render(
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
    expect(screen.getByText("Status colors are read from the system and cannot be changed here.")).toBeTruthy();
    expect(screen.getByText("Doing")).toBeTruthy();
    expect(screen.getByText("Done")).toBeTruthy();
    expect(screen.queryByLabelText("Color for Doing")).toBeNull();
    expect(screen.queryByRole("button", { name: "Auto" })).toBeNull();
  });

});
