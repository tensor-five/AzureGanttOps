// @vitest-environment jsdom
import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import { TimelinePane } from "./timeline-pane.js";
import { makeFieldFilterTimeline, registerTimelinePaneSpecCleanup } from "./timeline-pane.test-helpers.js";

registerTimelinePaneSpecCleanup();

describe("timeline-pane filters", () => {
  it("starts with one filter slot and adds another on plus click", async () => {
    const user = userEvent.setup();

    render(
      React.createElement(TimelinePane, {
        timeline: makeFieldFilterTimeline(),
        showDependencies: true
      })
    );

    await user.click(screen.getByLabelText("Toggle timeline filters"));

    expect(screen.getByLabelText("Timeline filters")).toBeTruthy();
    expect(screen.getByLabelText("Select filter field 1")).toBeTruthy();
    expect(screen.queryByLabelText("Select filter field 2")).toBeNull();
    await user.click(screen.getByLabelText("Add timeline filter"));
    expect(screen.getByLabelText("Select filter field 2")).toBeTruthy();
  });

  it("filters by one field with multi-select values", async () => {
    const user = userEvent.setup();

    render(
      React.createElement(TimelinePane, {
        timeline: makeFieldFilterTimeline(),
        showDependencies: true
      })
    );

    await user.click(screen.getByLabelText("Toggle timeline filters"));
    await user.click(screen.getByLabelText("Select filter field 1"));
    await user.type(screen.getByLabelText("Search filter fields 1"), "team");
    await user.click(screen.getByRole("button", { name: /Team/ }));

    await user.click(screen.getByLabelText("Select filter values 1"));
    await user.click(screen.getByLabelText("Include Alpha in filter 1"));

    expect(screen.getByLabelText("timeline-bar-11")).toBeTruthy();
    expect(screen.getByLabelText("timeline-bar-13")).toBeTruthy();
    expect(screen.queryByLabelText("timeline-bar-12")).toBeNull();
    expect(screen.queryByRole("button", { name: /#22 Unsched Beta/ })).toBeNull();

    await user.click(screen.getByLabelText("Include Beta in filter 1"));
    expect(screen.getByLabelText("timeline-bar-12")).toBeTruthy();
    expect(screen.getByRole("button", { name: /#22 Unsched Beta/ })).toBeTruthy();
  });

  it("selects all currently visible values from the filtered value search without clearing hidden selections", async () => {
    const user = userEvent.setup();

    render(
      React.createElement(TimelinePane, {
        timeline: makeFieldFilterTimeline(),
        showDependencies: true
      })
    );

    await user.click(screen.getByLabelText("Toggle timeline filters"));
    await user.click(screen.getByLabelText("Select filter field 1"));
    await user.type(screen.getByLabelText("Search filter fields 1"), "team");
    await user.click(screen.getByRole("button", { name: /Team/ }));

    await user.click(screen.getByLabelText("Select filter values 1"));
    await user.click(screen.getByLabelText("Include Alpha in filter 1"));
    await user.type(screen.getByLabelText("Search filter values 1"), "bet");
    await user.click(screen.getByLabelText("Select all visible filter values 1"));
    await user.clear(screen.getByLabelText("Search filter values 1"));

    expect((screen.getByLabelText("Include Alpha in filter 1") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Include Beta in filter 1") as HTMLInputElement).checked).toBe(true);
    expect(screen.getByLabelText("timeline-bar-11")).toBeTruthy();
    expect(screen.getByLabelText("timeline-bar-12")).toBeTruthy();
    expect(screen.getByLabelText("timeline-bar-13")).toBeTruthy();
  });

  it("deselects only the currently visible values when all filtered matches are already selected", async () => {
    const user = userEvent.setup();

    render(
      React.createElement(TimelinePane, {
        timeline: makeFieldFilterTimeline(),
        showDependencies: true
      })
    );

    await user.click(screen.getByLabelText("Toggle timeline filters"));
    await user.click(screen.getByLabelText("Select filter field 1"));
    await user.type(screen.getByLabelText("Search filter fields 1"), "team");
    await user.click(screen.getByRole("button", { name: /Team/ }));

    await user.click(screen.getByLabelText("Select filter values 1"));
    await user.click(screen.getByLabelText("Include Alpha in filter 1"));
    await user.click(screen.getByLabelText("Include Beta in filter 1"));
    await user.type(screen.getByLabelText("Search filter values 1"), "bet");
    await user.click(screen.getByLabelText("Deselect all visible filter values 1"));
    await user.clear(screen.getByLabelText("Search filter values 1"));

    expect((screen.getByLabelText("Include Alpha in filter 1") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Include Beta in filter 1") as HTMLInputElement).checked).toBe(false);
    expect(screen.getByLabelText("timeline-bar-11")).toBeTruthy();
    expect(screen.getByLabelText("timeline-bar-13")).toBeTruthy();
    expect(screen.queryByLabelText("timeline-bar-12")).toBeNull();
  });

  it("applies multiple field filters in parallel", async () => {
    const user = userEvent.setup();

    render(
      React.createElement(TimelinePane, {
        timeline: makeFieldFilterTimeline(),
        showDependencies: true
      })
    );

    await user.click(screen.getByLabelText("Toggle timeline filters"));

    await user.click(screen.getByLabelText("Select filter field 1"));
    await user.type(screen.getByLabelText("Search filter fields 1"), "team");
    await user.click(screen.getByRole("button", { name: /Team/ }));
    await user.click(screen.getByLabelText("Select filter values 1"));
    await user.click(screen.getByLabelText("Include Alpha in filter 1"));

    await user.click(screen.getByLabelText("Add timeline filter"));
    await user.click(screen.getByLabelText("Select filter field 2"));
    await user.type(screen.getByLabelText("Search filter fields 2"), "stream");
    await user.click(screen.getByRole("button", { name: /Stream/ }));
    await user.click(screen.getByLabelText("Select filter values 2"));
    await user.click(screen.getByLabelText("Include Platform in filter 2"));

    expect(screen.getByLabelText("timeline-bar-11")).toBeTruthy();
    expect(screen.queryByLabelText("timeline-bar-12")).toBeNull();
    expect(screen.queryByLabelText("timeline-bar-13")).toBeNull();
  });

  it("hydrates timeline filters from URL query params", async () => {
    const params = new URLSearchParams();
    params.append("tf", "Custom.Team~Alpha");
    window.history.replaceState(window.history.state, "", `/?${params.toString()}`);

    render(
      React.createElement(TimelinePane, {
        timeline: makeFieldFilterTimeline(),
        showDependencies: true
      })
    );

    expect(screen.getByLabelText("timeline-bar-11")).toBeTruthy();
    expect(screen.getByLabelText("timeline-bar-13")).toBeTruthy();
    expect(screen.queryByLabelText("timeline-bar-12")).toBeNull();
  });

  it("writes selected filters to URL query params", async () => {
    const user = userEvent.setup();

    render(
      React.createElement(TimelinePane, {
        timeline: makeFieldFilterTimeline(),
        showDependencies: true
      })
    );

    await user.click(screen.getByLabelText("Toggle timeline filters"));
    await user.click(screen.getByLabelText("Select filter field 1"));
    await user.type(screen.getByLabelText("Search filter fields 1"), "team");
    await user.click(screen.getByRole("button", { name: /Team/ }));
    await user.click(screen.getByLabelText("Select filter values 1"));
    await user.click(screen.getByLabelText("Include Alpha in filter 1"));

    await waitFor(() => {
      const params = new URLSearchParams(window.location.search);
      const all = params.getAll("tf");
      expect(all.length).toBeGreaterThan(0);
      expect(all[0]).toContain("Custom.Team");
      expect(all[0]).toContain("Alpha");
    });
  });

  it("shows System.Tags as selectable field in filter search", async () => {
    const user = userEvent.setup();

    render(
      React.createElement(TimelinePane, {
        timeline: makeFieldFilterTimeline(),
        showDependencies: true
      })
    );

    await user.click(screen.getByLabelText("Toggle timeline filters"));
    await user.click(screen.getByLabelText("Select filter field 1"));
    await user.type(screen.getByLabelText("Search filter fields 1"), "tags");

    expect(screen.getByRole("button", { name: /Tags/ })).toBeTruthy();
  });

  it("splits semicolon tag values and applies OR within one tag filter", async () => {
    const user = userEvent.setup();
    const timeline = makeFieldFilterTimeline();
    timeline.bars[0] = {
      ...timeline.bars[0],
      details: {
        ...timeline.bars[0].details,
        fieldValues: {
          ...timeline.bars[0].details.fieldValues,
          "System.Tags": "alpha;platform"
        }
      }
    };
    timeline.bars[1] = {
      ...timeline.bars[1],
      details: {
        ...timeline.bars[1].details,
        fieldValues: {
          ...timeline.bars[1].details.fieldValues,
          "System.Tags": "beta;platform"
        }
      }
    };
    timeline.bars[2] = {
      ...timeline.bars[2],
      details: {
        ...timeline.bars[2].details,
        fieldValues: {
          ...timeline.bars[2].details.fieldValues,
          "System.Tags": "gamma"
        }
      }
    };
    timeline.unschedulable[0] = {
      ...timeline.unschedulable[0],
      details: {
        ...timeline.unschedulable[0].details,
        fieldValues: {
          ...timeline.unschedulable[0].details.fieldValues,
          "System.Tags": "beta;ops"
        }
      }
    };

    render(
      React.createElement(TimelinePane, {
        timeline,
        showDependencies: true
      })
    );

    await user.click(screen.getByLabelText("Toggle timeline filters"));
    await user.click(screen.getByLabelText("Select filter field 1"));
    await user.type(screen.getByLabelText("Search filter fields 1"), "tags");
    await user.click(screen.getByRole("button", { name: /Tags/ }));

    await user.click(screen.getByLabelText("Select filter values 1"));
    expect(screen.queryByLabelText("Include alpha;platform in filter 1")).toBeNull();
    await user.click(screen.getByLabelText("Include alpha in filter 1"));

    expect(screen.getByLabelText("timeline-bar-11")).toBeTruthy();
    expect(screen.queryByLabelText("timeline-bar-12")).toBeNull();
    expect(screen.queryByLabelText("timeline-bar-13")).toBeNull();
    expect(screen.queryByRole("button", { name: /#22 Unsched Beta/ })).toBeNull();

    await user.click(screen.getByLabelText("Include beta in filter 1"));
    expect(screen.getByLabelText("timeline-bar-11")).toBeTruthy();
    expect(screen.getByLabelText("timeline-bar-12")).toBeTruthy();
    expect(screen.getByRole("button", { name: /#22 Unsched Beta/ })).toBeTruthy();
    expect(screen.queryByLabelText("timeline-bar-13")).toBeNull();
  });

  it("keeps timeline filter selections stable across reloads when values contain special characters", async () => {
    const user = userEvent.setup();
    const timeline = makeFieldFilterTimeline();
    const specialValue = "Alpha,Beta~Ops/QA + 50%";
    timeline.bars[0] = {
      ...timeline.bars[0],
      details: {
        ...timeline.bars[0].details,
        fieldValues: {
          ...timeline.bars[0].details.fieldValues,
          "Custom.Team": specialValue
        }
      }
    };

    const firstMount = render(
      React.createElement(TimelinePane, {
        timeline,
        showDependencies: true
      })
    );

    await user.click(screen.getByLabelText("Toggle timeline filters"));
    await user.click(screen.getByLabelText("Select filter field 1"));
    await user.type(screen.getByLabelText("Search filter fields 1"), "team");
    await user.click(screen.getByRole("button", { name: /Team/ }));
    await user.click(screen.getByLabelText("Select filter values 1"));
    await user.click(screen.getByLabelText(`Include ${specialValue} in filter 1`));

    await waitFor(() => {
      const params = new URLSearchParams(window.location.search);
      const all = params.getAll("tf");
      expect(all).toHaveLength(1);
      expect(all[0]).toContain("%2C");
      expect(all[0]).toContain("%25");
    });

    firstMount.unmount();

    render(
      React.createElement(TimelinePane, {
        timeline,
        showDependencies: true
      })
    );

    expect(screen.getByLabelText("timeline-bar-11")).toBeTruthy();
    expect(screen.queryByLabelText("timeline-bar-12")).toBeNull();
    expect(screen.queryByLabelText("timeline-bar-13")).toBeNull();
  });

});
