import { describe, expect, it } from "vitest";

import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";
import {
  applyTimelineFieldFilterGroups,
  applyTimelineFieldFilters,
  countActiveTimelineFieldFilters,
  EMPTY_FIELD_FILTER_KEY,
  extractFilterMatchKeys,
  extractFilterValueTokens,
  fromTimelineDateTimeLocalInputValue,
  isActiveTimelineDateRange,
  isTimelineDateFieldRef,
  isTagFieldRef,
  matchesTimelineDateRangeValue,
  toTimelineDateTimeLocalInputValue
} from "./timeline-field-filtering.js";
import {
  createTimelineDateRangeFieldFilter,
  createTimelineFilterGroup,
  createTimelineValueFieldFilter
} from "./timeline-filter-model.js";

describe("timeline-field-filtering", () => {
  it("detects tag fields by leaf name", () => {
    expect(isTagFieldRef("System.Tags")).toBe(true);
    expect(isTagFieldRef("Custom.Tag")).toBe(true);
    expect(isTagFieldRef("Custom.Team")).toBe(false);
  });

  it("splits semicolon tag values into individual filter tokens", () => {
    expect(extractFilterValueTokens("System.Tags", "alpha; platform ;alpha")).toEqual([
      { key: "alpha", label: "alpha" },
      { key: "platform", label: "platform" }
    ]);
  });

  it("returns Empty token when tag value is blank", () => {
    expect(extractFilterValueTokens("System.Tags", " ; ")).toEqual([
      { key: EMPTY_FIELD_FILTER_KEY, label: "Empty" }
    ]);
  });

  it("keeps non-tag fields as a single exact key", () => {
    expect(extractFilterValueTokens("Custom.Team", "Alpha")).toEqual([{ key: "Alpha", label: "Alpha" }]);
    expect(extractFilterMatchKeys("Custom.Team", "Alpha")).toEqual(["Alpha"]);
  });

  it("adds legacy raw tag value key to preserve old URL filters", () => {
    expect(extractFilterMatchKeys("System.Tags", "alpha;platform")).toEqual([
      "alpha",
      "platform",
      "alpha;platform"
    ]);
  });

  it("detects date fields from known refs, schedule refs, leaf names, and strict sample values", () => {
    expect(isTimelineDateFieldRef("System.ChangedDate")).toBe(true);
    expect(isTimelineDateFieldRef("Microsoft.VSTS.Scheduling.StartDate")).toBe(true);
    expect(isTimelineDateFieldRef("Custom.StartDate2")).toBe(true);
    expect(isTimelineDateFieldRef("Custom.EndDateTime7")).toBe(true);
    expect(isTimelineDateFieldRef("Custom.Candidate")).toBe(false);
    expect(
      isTimelineDateFieldRef("Custom.Candidate", {
        scheduleFieldRefs: { start: "Custom.Candidate", endOrTarget: "Custom.Target" }
      })
    ).toBe(true);
    expect(
      isTimelineDateFieldRef("Custom.Planned", {
        sampleValuesByFieldRef: new Map([["Custom.Planned", ["2026-03-01T12:30:00.000Z", "2026-03-02"]]])
      })
    ).toBe(true);
    expect(
      isTimelineDateFieldRef("Custom.Mixed", {
        sampleValuesByFieldRef: new Map([["Custom.Mixed", ["2026-03-01", "not-a-date"]]])
      })
    ).toBe(false);
  });

  it("matches date ranges inclusively and rejects missing or invalid field values", () => {
    const range = {
      startIso: "2026-03-01T10:00:00.000Z",
      endIso: "2026-03-01T10:00:00.000Z"
    };

    expect(matchesTimelineDateRangeValue("2026-03-01T10:00:00.000Z", range)).toBe(true);
    expect(matchesTimelineDateRangeValue("2026-03-01T09:59:59.999Z", range)).toBe(false);
    expect(matchesTimelineDateRangeValue(null, range)).toBe(false);
    expect(matchesTimelineDateRangeValue("not-a-date", range)).toBe(false);
  });

  it("matches date-only field values by local calendar day for datetime-local ranges", () => {
    const sameLocalDay = fromTimelineDateTimeLocalInputValue("2026-03-01T00:00");
    const crossLocalDayStart = fromTimelineDateTimeLocalInputValue("2026-03-01T23:00");
    const crossLocalDayEnd = fromTimelineDateTimeLocalInputValue("2026-03-02T01:00");

    expect(
      matchesTimelineDateRangeValue("2026-03-01", {
        startIso: sameLocalDay,
        endIso: sameLocalDay
      })
    ).toBe(true);
    expect(
      matchesTimelineDateRangeValue("2026-03-02", {
        startIso: sameLocalDay,
        endIso: sameLocalDay
      })
    ).toBe(false);
    expect(
      matchesTimelineDateRangeValue("2026-03-01", {
        startIso: crossLocalDayStart,
        endIso: crossLocalDayEnd
      })
    ).toBe(true);
    expect(
      matchesTimelineDateRangeValue("2026-03-02", {
        startIso: crossLocalDayStart,
        endIso: crossLocalDayEnd
      })
    ).toBe(true);
    expect(
      matchesTimelineDateRangeValue("2026-02-28", {
        startIso: crossLocalDayStart,
        endIso: crossLocalDayEnd
      })
    ).toBe(false);
  });

  it("applies legacy value date filters with exact OR semantics", () => {
    const timeline: TimelineReadModel = {
      queryType: "flat" as const,
      bars: ["2026-03-01", "2026-03-02", "2026-03-03"].map((value, index) => ({
        workItemId: index + 1,
        title: `Item ${index + 1}`,
        state: { code: "Active", badge: "A", color: "#2f855a" },
        schedule: {
          startDate: "2026-03-01T00:00:00.000Z",
          endDate: "2026-03-02T00:00:00.000Z",
          missingBoundary: null
        },
        details: {
          mappedId: String(index + 1),
          fieldValues: {
            "Custom.StartDate": value
          }
        }
      })),
      unschedulable: [],
      dependencies: [],
      suppressedDependencies: [],
      treeLayout: null,
      mappingValidation: {
        status: "valid" as const,
        issues: []
      }
    };

    const filtered = applyTimelineFieldFilters(timeline, [
      createTimelineValueFieldFilter(0, "Custom.StartDate", ["2026-03-01", "2026-03-03"])
    ]);

    expect(filtered?.bars.map((bar) => bar.workItemId)).toEqual([1, 3]);
  });

  it("applies groups as (A AND B) OR C", () => {
    const timeline = makeGroupedFilterTimeline();

    const filtered = applyTimelineFieldFilterGroups(timeline, [
      createTimelineFilterGroup(0, [
        createTimelineValueFieldFilter(0, "Custom.Team", ["Alpha"]),
        createTimelineValueFieldFilter(1, "Custom.Stream", ["Platform"])
      ]),
      createTimelineFilterGroup(1, [
        createTimelineValueFieldFilter(2, "Custom.Team", ["Beta"])
      ])
    ]);

    expect(filtered?.bars.map((bar) => bar.workItemId)).toEqual([1, 3]);
  });

  it("ignores inactive groups", () => {
    const timeline = makeGroupedFilterTimeline();

    const filtered = applyTimelineFieldFilterGroups(timeline, [
      createTimelineFilterGroup(0, [
        createTimelineValueFieldFilter(0, "Custom.Team", [])
      ]),
      createTimelineFilterGroup(1, [
        createTimelineValueFieldFilter(1, "Custom.Stream", ["Business"])
      ])
    ]);

    expect(filtered?.bars.map((bar) => bar.workItemId)).toEqual([2]);
  });

  it("leaves the timeline unfiltered when no groups are active", () => {
    const timeline = makeGroupedFilterTimeline();

    const filtered = applyTimelineFieldFilterGroups(timeline, [
      createTimelineFilterGroup(0, [
        createTimelineValueFieldFilter(0, "Custom.Team", [])
      ]),
      createTimelineFilterGroup(1, [
        createTimelineDateRangeFieldFilter(1, "Custom.StartDate", {
          startIso: null,
          endIso: null
        })
      ])
    ]);

    expect(filtered).toBe(timeline);
  });

  it("reduces dependencies and suppressed dependencies to the OR group result", () => {
    const timeline = makeGroupedFilterTimeline();

    const filtered = applyTimelineFieldFilterGroups(timeline, [
      createTimelineFilterGroup(0, [
        createTimelineValueFieldFilter(0, "Custom.Team", ["Alpha"])
      ]),
      createTimelineFilterGroup(1, [
        createTimelineValueFieldFilter(1, "Custom.Team", ["Gamma"])
      ])
    ]);

    expect(filtered?.bars.map((bar) => bar.workItemId)).toEqual([1, 2, 4]);
    expect(filtered?.dependencies).toEqual([
      {
        predecessorWorkItemId: 1,
        successorWorkItemId: 2,
        dependencyType: "FS",
        label: "#1 -> #2"
      }
    ]);
    expect(filtered?.suppressedDependencies).toEqual([
      {
        predecessorWorkItemId: 2,
        successorWorkItemId: 4,
        dependencyType: "FS",
        reason: "unschedulable-endpoint"
      }
    ]);
  });

  it("treats one-sided ranges as active and start-after-end ranges as inactive", () => {
    expect(isActiveTimelineDateRange({ startIso: "2026-03-01T00:00:00.000Z", endIso: null })).toBe(true);
    expect(isActiveTimelineDateRange({ startIso: null, endIso: "2026-03-01T00:00:00.000Z" })).toBe(true);
    expect(isActiveTimelineDateRange({ startIso: null, endIso: null })).toBe(false);
    expect(
      isActiveTimelineDateRange({
        startIso: "2026-03-02T00:00:00.000Z",
        endIso: "2026-03-01T00:00:00.000Z"
      })
    ).toBe(false);
  });

  it("counts active value and date range filters", () => {
    expect(
      countActiveTimelineFieldFilters([
        createTimelineValueFieldFilter(0, "Custom.Team", ["Alpha"]),
        createTimelineValueFieldFilter(1, "Custom.Stream", []),
        createTimelineDateRangeFieldFilter(2, "Custom.StartDate", {
          startIso: "2026-03-01T00:00:00.000Z",
          endIso: null
        }),
        createTimelineDateRangeFieldFilter(3, "Custom.EndDate", {
          startIso: "2026-03-03T00:00:00.000Z",
          endIso: "2026-03-02T00:00:00.000Z"
        })
      ])
    ).toBe(2);
  });

  it("round-trips UTC ISO values through local datetime-local values", () => {
    const localValue = toTimelineDateTimeLocalInputValue("2026-03-01T12:34:00.000Z");

    expect(localValue).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(fromTimelineDateTimeLocalInputValue(localValue)).toBe("2026-03-01T12:34:00.000Z");
    expect(fromTimelineDateTimeLocalInputValue("2026-03-01T12:34")).toBe(
      new Date(2026, 2, 1, 12, 34, 0, 0).toISOString()
    );
  });
});

function makeGroupedFilterTimeline(): TimelineReadModel {
  return {
    queryType: "flat" as const,
    bars: [
      {
        workItemId: 1,
        title: "Alpha Platform",
        state: { code: "Active", badge: "A", color: "#2f855a" },
        schedule: {
          startDate: "2026-03-01T00:00:00.000Z",
          endDate: "2026-03-02T00:00:00.000Z",
          missingBoundary: null
        },
        details: {
          mappedId: "1",
          fieldValues: {
            "Custom.Team": "Alpha",
            "Custom.Stream": "Platform"
          }
        }
      },
      {
        workItemId: 2,
        title: "Alpha Business",
        state: { code: "Active", badge: "A", color: "#2f855a" },
        schedule: {
          startDate: "2026-03-02T00:00:00.000Z",
          endDate: "2026-03-03T00:00:00.000Z",
          missingBoundary: null
        },
        details: {
          mappedId: "2",
          fieldValues: {
            "Custom.Team": "Alpha",
            "Custom.Stream": "Business"
          }
        }
      },
      {
        workItemId: 3,
        title: "Beta Operations",
        state: { code: "Active", badge: "A", color: "#2f855a" },
        schedule: {
          startDate: "2026-03-03T00:00:00.000Z",
          endDate: "2026-03-04T00:00:00.000Z",
          missingBoundary: null
        },
        details: {
          mappedId: "3",
          fieldValues: {
            "Custom.Team": "Beta",
            "Custom.Stream": "Operations"
          }
        }
      },
      {
        workItemId: 4,
        title: "Gamma Operations",
        state: { code: "Active", badge: "A", color: "#2f855a" },
        schedule: {
          startDate: "2026-03-04T00:00:00.000Z",
          endDate: "2026-03-05T00:00:00.000Z",
          missingBoundary: null
        },
        details: {
          mappedId: "4",
          fieldValues: {
            "Custom.Team": "Gamma",
            "Custom.Stream": "Operations"
          }
        }
      }
    ],
    unschedulable: [],
    dependencies: [
      {
        predecessorWorkItemId: 1,
        successorWorkItemId: 2,
        dependencyType: "FS",
        label: "#1 -> #2"
      },
      {
        predecessorWorkItemId: 3,
        successorWorkItemId: 4,
        dependencyType: "FS",
        label: "#3 -> #4"
      }
    ],
    suppressedDependencies: [
      {
        predecessorWorkItemId: 2,
        successorWorkItemId: 4,
        dependencyType: "FS",
        reason: "unschedulable-endpoint"
      }
    ],
    treeLayout: null,
    mappingValidation: {
      status: "valid" as const,
      issues: []
    }
  };
}
