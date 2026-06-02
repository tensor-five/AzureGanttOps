// @vitest-environment jsdom
import React from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import { TimelinePane } from "./timeline-pane.js";
import { makeFieldFilterTimeline, registerTimelinePaneSpecCleanup } from "./timeline-pane.test-helpers.js";
import { toTimelineDateTimeLocalInputValue } from "./timeline-field-filtering.js";
import {
  createTimelineDateRangeFieldFilter,
  createTimelineValueFieldFilter
} from "./timeline-filter-model.js";
import {
  LEGACY_TIMELINE_FILTERS_QUERY_PARAM,
  serializeTimelineFiltersForUrl,
  TIMELINE_DATE_FILTERS_QUERY_PARAM,
  TIMELINE_VALUE_FILTERS_QUERY_PARAM
} from "./timeline-filter-url.js";

registerTimelinePaneSpecCleanup();

const DATE_FILTER_FIELD_REF = "Custom.StartDate";
const FILTER_INTERACTION_TEST_TIMEOUT_MS = 10_000;

function makeDateFieldFilterTimeline() {
  const timeline = makeFieldFilterTimeline();
  const dateValues = ["2026-03-01T10:00:00.000Z", "2026-03-03T10:00:00.000Z", null];

  return {
    ...timeline,
    scheduleFieldRefs: {
      start: DATE_FILTER_FIELD_REF,
      endOrTarget: "Custom.EndDate"
    },
    bars: timeline.bars.map((bar, index) => ({
      ...bar,
      details: {
        ...bar.details,
        fieldValues: {
          ...bar.details.fieldValues,
          [DATE_FILTER_FIELD_REF]: dateValues[index] ?? null
        }
      }
    })),
    unschedulable: timeline.unschedulable.map((item) => ({
      ...item,
      details: {
        ...item.details,
        fieldValues: {
          ...item.details.fieldValues,
          [DATE_FILTER_FIELD_REF]: "not-a-date"
        }
      }
    }))
  };
}

function makeContextOnlyDateFieldFilterTimeline() {
  const timeline = makeFieldFilterTimeline();
  const plannedFieldRef = "Custom.Planned";
  const dateValues = ["2026-03-01T10:00:00.000Z", "2026-03-03T10:00:00.000Z", null];

  return {
    ...timeline,
    scheduleFieldRefs: {
      start: plannedFieldRef,
      endOrTarget: "Custom.Target"
    },
    bars: timeline.bars.map((bar, index) => ({
      ...bar,
      details: {
        ...bar.details,
        fieldValues: {
          ...bar.details.fieldValues,
          [plannedFieldRef]: dateValues[index] ?? null
        }
      }
    })),
    unschedulable: timeline.unschedulable.map((item) => ({
      ...item,
      details: {
        ...item.details,
        fieldValues: {
          ...item.details.fieldValues,
          [plannedFieldRef]: null
        }
      }
    }))
  };
}

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
  }, FILTER_INTERACTION_TEST_TIMEOUT_MS);

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
    expect(screen.queryByLabelText("Filter 1 date range start")).toBeNull();
    await user.click(screen.getByLabelText("Include Alpha in filter 1"));

    expect(screen.getByLabelText("timeline-bar-11")).toBeTruthy();
    expect(screen.getByLabelText("timeline-bar-13")).toBeTruthy();
    expect(screen.queryByLabelText("timeline-bar-12")).toBeNull();
    expect(screen.queryByRole("button", { name: /#22 Unsched Beta/ })).toBeNull();

    await user.click(screen.getByLabelText("Include Beta in filter 1"));
    expect(screen.getByLabelText("timeline-bar-12")).toBeTruthy();
    expect(screen.getByRole("button", { name: /#22 Unsched Beta/ })).toBeTruthy();
  }, FILTER_INTERACTION_TEST_TIMEOUT_MS);

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
  }, FILTER_INTERACTION_TEST_TIMEOUT_MS);

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
  }, FILTER_INTERACTION_TEST_TIMEOUT_MS);

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
  }, FILTER_INTERACTION_TEST_TIMEOUT_MS);

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

  it("shows datetime-local range inputs for date fields and filters bars", async () => {
    const user = userEvent.setup();

    render(
      React.createElement(TimelinePane, {
        timeline: makeDateFieldFilterTimeline(),
        showDependencies: true
      })
    );

    await user.click(screen.getByLabelText("Toggle timeline filters"));
    await user.click(screen.getByLabelText("Select filter field 1"));
    await user.type(screen.getByLabelText("Search filter fields 1"), "startdate");
    await user.click(screen.getByRole("button", { name: /StartDate/ }));

    await user.click(screen.getByLabelText("Select filter values 1"));
    const startInput = screen.getByLabelText("Filter 1 date range start") as HTMLInputElement;
    const endInput = screen.getByLabelText("Filter 1 date range end") as HTMLInputElement;

    expect(startInput.type).toBe("datetime-local");
    expect(startInput.className).toContain("timeline-details-input");
    expect(startInput.className).toContain("timeline-filter-date-input");
    expect(endInput.type).toBe("datetime-local");
    expect(screen.queryByLabelText("Include Empty in filter 1")).toBeNull();

    const betaDate = toTimelineDateTimeLocalInputValue("2026-03-03T10:00:00.000Z");
    fireEvent.change(startInput, { target: { value: betaDate } });
    fireEvent.change(endInput, { target: { value: betaDate } });

    await waitFor(() => {
      expect(screen.getByLabelText("timeline-bar-12")).toBeTruthy();
      expect(screen.queryByLabelText("timeline-bar-11")).toBeNull();
      expect(screen.queryByLabelText("timeline-bar-13")).toBeNull();
      expect(screen.queryByRole("button", { name: /#22 Unsched Beta/ })).toBeNull();
    });
  });

  it("hydrates date range filters from tdf URL query params", async () => {
    const params = new URLSearchParams();
    serializeTimelineFiltersForUrl([
      createTimelineDateRangeFieldFilter(0, DATE_FILTER_FIELD_REF, {
        startIso: "2026-03-03T10:00:00.000Z",
        endIso: "2026-03-03T10:00:00.000Z"
      })
    ]).forEach((entry) => params.append(entry.name, entry.value));
    window.history.replaceState(window.history.state, "", `/?${params.toString()}`);

    render(
      React.createElement(TimelinePane, {
        timeline: makeDateFieldFilterTimeline(),
        showDependencies: true
      })
    );

    expect(screen.getByLabelText("timeline-bar-12")).toBeTruthy();
    expect(screen.queryByLabelText("timeline-bar-11")).toBeNull();
    expect(screen.queryByLabelText("timeline-bar-13")).toBeNull();
  });

  it("hydrates multi-date legacy tf filters as exact values and keeps URL sync on tf", async () => {
    const user = userEvent.setup();
    const params = new URLSearchParams();
    const selectedValues = ["2026-03-01T10:00:00.000Z", "2026-03-03T10:00:00.000Z"];
    serializeTimelineFiltersForUrl([
      createTimelineValueFieldFilter(0, DATE_FILTER_FIELD_REF, selectedValues)
    ]).forEach((entry) => params.append(entry.name, entry.value));
    window.history.replaceState(window.history.state, "", `/?${params.toString()}`);

    const timeline = makeDateFieldFilterTimeline();
    timeline.bars[2] = {
      ...timeline.bars[2],
      details: {
        ...timeline.bars[2].details,
        fieldValues: {
          ...timeline.bars[2].details.fieldValues,
          [DATE_FILTER_FIELD_REF]: "2026-03-02T10:00:00.000Z"
        }
      }
    };

    render(
      React.createElement(TimelinePane, {
        timeline,
        showDependencies: true
      })
    );

    expect(screen.getByLabelText("timeline-bar-11")).toBeTruthy();
    expect(screen.getByLabelText("timeline-bar-12")).toBeTruthy();
    expect(screen.queryByLabelText("timeline-bar-13")).toBeNull();

    await waitFor(() => {
      const hydratedParams = new URLSearchParams(window.location.search);
      const valueFilters = hydratedParams.getAll(TIMELINE_VALUE_FILTERS_QUERY_PARAM);
      expect(valueFilters).toHaveLength(1);
      expect(hydratedParams.getAll(TIMELINE_DATE_FILTERS_QUERY_PARAM)).toHaveLength(0);
      expect(decodeURIComponent(valueFilters[0])).toContain(DATE_FILTER_FIELD_REF);
      expect(decodeURIComponent(valueFilters[0])).toContain(selectedValues[0]);
      expect(decodeURIComponent(valueFilters[0])).toContain(selectedValues[1]);
    });

    await user.click(screen.getByLabelText("Toggle timeline filters"));
    await user.click(screen.getByLabelText("Select filter values 1"));

    expect(screen.queryByLabelText("Filter 1 date range start")).toBeNull();
    expect(screen.getByLabelText(`Include ${selectedValues[0]} in filter 1`)).toBeTruthy();
  });

  it("keeps legacy date URL filters until timeline context is available and hydrates them as date ranges", async () => {
    const plannedFieldRef = "Custom.Planned";
    const params = new URLSearchParams();
    params.set(
      LEGACY_TIMELINE_FILTERS_QUERY_PARAM,
      JSON.stringify([{ fieldRef: plannedFieldRef, selectedValueKeys: ["2026-03-03T10:00:00.000Z"] }])
    );
    window.history.replaceState(window.history.state, "", `/?${params.toString()}`);

    const timeline = makeContextOnlyDateFieldFilterTimeline();
    const { rerender } = render(
      React.createElement(TimelinePane, {
        timeline: null,
        showDependencies: true
      })
    );

    expect(new URLSearchParams(window.location.search).has(LEGACY_TIMELINE_FILTERS_QUERY_PARAM)).toBe(true);
    expect(new URLSearchParams(window.location.search).getAll("tf")).toHaveLength(0);

    rerender(
      React.createElement(TimelinePane, {
        timeline,
        showDependencies: true
      })
    );

    await waitFor(() => {
      expect(screen.getByLabelText("timeline-bar-12")).toBeTruthy();
      expect(screen.queryByLabelText("timeline-bar-11")).toBeNull();
      expect(screen.queryByLabelText("timeline-bar-13")).toBeNull();
    });

    await waitFor(() => {
      const hydratedParams = new URLSearchParams(window.location.search);
      const dateFilters = hydratedParams.getAll(TIMELINE_DATE_FILTERS_QUERY_PARAM);
      expect(hydratedParams.has(LEGACY_TIMELINE_FILTERS_QUERY_PARAM)).toBe(false);
      expect(hydratedParams.getAll("tf")).toHaveLength(0);
      expect(dateFilters).toHaveLength(1);
      expect(decodeURIComponent(dateFilters[0])).toContain(plannedFieldRef);
      expect(decodeURIComponent(dateFilters[0])).toContain("2026-03-03T10:00:00.000Z");
    });
  });

  it("writes date range filters to tdf URL query params", async () => {
    const user = userEvent.setup();

    render(
      React.createElement(TimelinePane, {
        timeline: makeDateFieldFilterTimeline(),
        showDependencies: true
      })
    );

    await user.click(screen.getByLabelText("Toggle timeline filters"));
    await user.click(screen.getByLabelText("Select filter field 1"));
    await user.type(screen.getByLabelText("Search filter fields 1"), "startdate");
    await user.click(screen.getByRole("button", { name: /StartDate/ }));
    await user.click(screen.getByLabelText("Select filter values 1"));

    fireEvent.change(screen.getByLabelText("Filter 1 date range start"), {
      target: { value: toTimelineDateTimeLocalInputValue("2026-03-03T10:00:00.000Z") }
    });

    await waitFor(() => {
      const params = new URLSearchParams(window.location.search);
      const dateFilters = params.getAll(TIMELINE_DATE_FILTERS_QUERY_PARAM);
      expect(dateFilters).toHaveLength(1);
      expect(decodeURIComponent(dateFilters[0])).toContain(DATE_FILTER_FIELD_REF);
      expect(decodeURIComponent(dateFilters[0])).toContain("2026-03-03T10:00:00.000Z");
      expect(params.getAll("tf")).toHaveLength(0);
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
