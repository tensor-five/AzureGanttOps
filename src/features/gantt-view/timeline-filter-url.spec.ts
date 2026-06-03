import { describe, expect, it } from "vitest";

import {
  createTimelineDateRangeFieldFilter,
  createTimelineFilterGroup,
  createTimelineValueFieldFilter
} from "./timeline-filter-model.js";
import { matchesTimelineDateRangeValue } from "./timeline-field-filtering.js";
import {
  LEGACY_TIMELINE_FILTERS_QUERY_PARAM,
  parseTimelineFilterGroupsFromSearch,
  parseTimelineFiltersFromSearch,
  serializeTimelineFilterGroupsForUrl,
  serializeTimelineFiltersForUrl,
  TIMELINE_FILTER_GROUPS_QUERY_PARAM,
  TIMELINE_DATE_FILTERS_QUERY_PARAM,
  TIMELINE_VALUE_FILTERS_QUERY_PARAM
} from "./timeline-filter-url.js";

describe("timeline-filter-url", () => {
  it("round-trips mixed value and date range filters in query order", () => {
    const params = new URLSearchParams();
    serializeTimelineFiltersForUrl([
      createTimelineValueFieldFilter(0, "Custom.Team", ["Alpha,Beta~Ops/QA + 50%"]),
      createTimelineDateRangeFieldFilter(1, "Custom.StartDate", {
        startIso: "2026-03-01T00:00:00.000Z",
        endIso: "2026-03-02T00:00:00.000Z"
      })
    ]).forEach((entry) => params.append(entry.name, entry.value));

    const parsed = parseTimelineFiltersFromSearch(`?${params.toString()}`);

    expect(parsed).toEqual([
      {
        slotId: 0,
        fieldRef: "Custom.Team",
        kind: "value",
        selectedValueKeys: ["Alpha,Beta~Ops/QA + 50%"]
      },
      {
        slotId: 1,
        fieldRef: "Custom.StartDate",
        kind: "dateRange",
        dateRange: {
          startIso: "2026-03-01T00:00:00.000Z",
          endIso: "2026-03-02T00:00:00.000Z"
        }
      }
    ]);
  });

  it("preserves mixed tf and tdf order from URLSearchParams", () => {
    const params = new URLSearchParams();
    params.append(
      TIMELINE_DATE_FILTERS_QUERY_PARAM,
      "Custom.StartDate~2026-03-02T00%3A00%3A00.000Z~"
    );
    params.append(TIMELINE_VALUE_FILTERS_QUERY_PARAM, "Custom.Team~Alpha");

    const parsed = parseTimelineFiltersFromSearch(`?${params.toString()}`);

    expect(parsed.map((filter) => filter.kind)).toEqual(["dateRange", "value"]);
    expect(parsed.map((filter) => filter.fieldRef)).toEqual(["Custom.StartDate", "Custom.Team"]);
  });

  it("keeps legacy date tf values with multiple distinct dates as an exact value filter", () => {
    const params = new URLSearchParams();
    params.append(
      TIMELINE_VALUE_FILTERS_QUERY_PARAM,
      "Custom.StartDate~2026-03-03T00%3A00%3A00.000Z,2026-03-01T00%3A00%3A00.000Z"
    );

    const parsed = parseTimelineFiltersFromSearch(`?${params.toString()}`);

    expect(parsed).toEqual([
      {
        slotId: 0,
        fieldRef: "Custom.StartDate",
        kind: "value",
        selectedValueKeys: ["2026-03-03T00:00:00.000Z", "2026-03-01T00:00:00.000Z"]
      }
    ]);
    expect(serializeTimelineFiltersForUrl(parsed)).toEqual([
      {
        name: TIMELINE_VALUE_FILTERS_QUERY_PARAM,
        value: "Custom.StartDate~2026-03-03T00%3A00%3A00.000Z,2026-03-01T00%3A00%3A00.000Z"
      }
    ]);
  });

  it("keeps legacy date tf values as exact values when any selected value is not parseable", () => {
    const params = new URLSearchParams();
    params.append(
      TIMELINE_VALUE_FILTERS_QUERY_PARAM,
      "Custom.StartDate~2026-03-03T00%3A00%3A00.000Z,not-a-date"
    );

    const parsed = parseTimelineFiltersFromSearch(`?${params.toString()}`);

    expect(parsed).toEqual([
      {
        slotId: 0,
        fieldRef: "Custom.StartDate",
        kind: "value",
        selectedValueKeys: ["2026-03-03T00:00:00.000Z", "not-a-date"]
      }
    ]);
  });

  it("migrates one date-only legacy date tf value to local start and end equality", () => {
    const params = new URLSearchParams();
    params.append(TIMELINE_VALUE_FILTERS_QUERY_PARAM, "Custom.StartDate~2026-03-03");
    const localMidnightIso = new Date(2026, 2, 3, 0, 0, 0, 0).toISOString();

    const parsed = parseTimelineFiltersFromSearch(`?${params.toString()}`);

    expect(parsed).toEqual([
      {
        slotId: 0,
        fieldRef: "Custom.StartDate",
        kind: "dateRange",
        dateRange: {
          startIso: localMidnightIso,
          endIso: localMidnightIso
        }
      }
    ]);
    expect(parsed[0]?.kind).toBe("dateRange");
    if (parsed[0]?.kind !== "dateRange") {
      throw new Error("Expected migrated legacy date filter to be a date range");
    }
    expect(matchesTimelineDateRangeValue("2026-03-03", parsed[0].dateRange)).toBe(true);
  });

  it("keeps mixed date-only and zoned legacy date tf values as exact values", () => {
    const params = new URLSearchParams();
    params.append(
      TIMELINE_VALUE_FILTERS_QUERY_PARAM,
      "Custom.StartDate~2026-03-03,2026-03-03T00%3A00%3A00.000Z"
    );

    const parsed = parseTimelineFiltersFromSearch(`?${params.toString()}`);

    expect(parsed).toEqual([
      {
        slotId: 0,
        fieldRef: "Custom.StartDate",
        kind: "value",
        selectedValueKeys: ["2026-03-03", "2026-03-03T00:00:00.000Z"]
      }
    ]);
  });

  it("migrates one legacy date value to start and end equality", () => {
    const params = new URLSearchParams();
    params.set(
      LEGACY_TIMELINE_FILTERS_QUERY_PARAM,
      JSON.stringify([{ fieldRef: "Custom.DueDate", selectedValueKeys: ["2026-03-04"] }])
    );
    const localMidnightIso = new Date(2026, 2, 4, 0, 0, 0, 0).toISOString();

    const parsed = parseTimelineFiltersFromSearch(`?${params.toString()}`);

    expect(parsed).toEqual([
      {
        slotId: 0,
        fieldRef: "Custom.DueDate",
        kind: "dateRange",
        dateRange: {
          startIso: localMidnightIso,
          endIso: localMidnightIso
        }
      }
    ]);
  });

  it("keeps legacy JSON date filters with multiple distinct dates as exact value filters", () => {
    const params = new URLSearchParams();
    params.set(
      LEGACY_TIMELINE_FILTERS_QUERY_PARAM,
      JSON.stringify([{ fieldRef: "Custom.DueDate", selectedValueKeys: ["2026-03-01", "2026-03-03"] }])
    );

    const parsed = parseTimelineFiltersFromSearch(`?${params.toString()}`);

    expect(parsed).toEqual([
      {
        slotId: 0,
        fieldRef: "Custom.DueDate",
        kind: "value",
        selectedValueKeys: ["2026-03-01", "2026-03-03"]
      }
    ]);
    expect(serializeTimelineFiltersForUrl(parsed)).toEqual([
      {
        name: TIMELINE_VALUE_FILTERS_QUERY_PARAM,
        value: "Custom.DueDate~2026-03-01,2026-03-03"
      }
    ]);
  });

  it("applies one shared max slot limit across tf and tdf params", () => {
    const params = new URLSearchParams();
    for (let index = 0; index < 6; index++) {
      params.append(
        index % 2 === 0 ? TIMELINE_VALUE_FILTERS_QUERY_PARAM : TIMELINE_DATE_FILTERS_QUERY_PARAM,
        index % 2 === 0
          ? `Custom.Team${index}~Alpha`
          : `Custom.StartDate${index}~2026-03-0${index}T00%3A00%3A00.000Z~`
      );
    }

    const parsed = parseTimelineFiltersFromSearch(`?${params.toString()}`);

    expect(parsed).toHaveLength(5);
    expect(parsed.map((filter) => filter.slotId)).toEqual([0, 1, 2, 3, 4]);
  });

  it("serializes only active filters and uses tdf for active date ranges", () => {
    const serialized = serializeTimelineFiltersForUrl([
      createTimelineValueFieldFilter(0, "Custom.Team", []),
      createTimelineDateRangeFieldFilter(1, "Custom.StartDate", {
        startIso: "2026-03-02T00:00:00.000Z",
        endIso: null
      }),
      createTimelineDateRangeFieldFilter(2, "Custom.EndDate", {
        startIso: "2026-03-04T00:00:00.000Z",
        endIso: "2026-03-03T00:00:00.000Z"
      })
    ]);

    expect(serialized).toEqual([
      {
        name: TIMELINE_DATE_FILTERS_QUERY_PARAM,
        value: "Custom.StartDate~2026-03-02T00%3A00%3A00.000Z~"
      }
    ]);
  });

  it("parses valid versioned tfg groups", () => {
    const params = new URLSearchParams();
    params.set(
      TIMELINE_FILTER_GROUPS_QUERY_PARAM,
      JSON.stringify({
        version: 1,
        groups: [
          {
            filters: [
              {
                kind: "value",
                fieldRef: "Custom.Team",
                selectedValueKeys: ["Alpha"]
              },
              {
                kind: "dateRange",
                fieldRef: "Custom.StartDate",
                dateRange: {
                  startIso: "2026-03-01T00:00:00.000Z",
                  endIso: null
                }
              }
            ]
          },
          {
            filters: [
              {
                kind: "value",
                fieldRef: "Custom.Stream",
                selectedValueKeys: ["Platform"]
              }
            ]
          }
        ]
      })
    );

    const parsed = parseTimelineFilterGroupsFromSearch(`?${params.toString()}`);

    expect(parsed).toEqual([
      createTimelineFilterGroup(0, [
        createTimelineValueFieldFilter(0, "Custom.Team", ["Alpha"]),
        createTimelineDateRangeFieldFilter(1, "Custom.StartDate", {
          startIso: "2026-03-01T00:00:00.000Z",
          endIso: null
        })
      ]),
      createTimelineFilterGroup(1, [
        createTimelineValueFieldFilter(2, "Custom.Stream", ["Platform"])
      ])
    ]);
  });

  it("falls back to legacy params when tfg is malformed", () => {
    const params = new URLSearchParams();
    params.set(TIMELINE_FILTER_GROUPS_QUERY_PARAM, "{not-json");
    params.append(TIMELINE_VALUE_FILTERS_QUERY_PARAM, "Custom.Team~Alpha");

    const parsed = parseTimelineFilterGroupsFromSearch(`?${params.toString()}`);

    expect(parsed).toEqual([
      createTimelineFilterGroup(0, [
        createTimelineValueFieldFilter(0, "Custom.Team", ["Alpha"])
      ])
    ]);
  });

  it("prefers valid tfg groups over old parallel timeline filter params", () => {
    const params = new URLSearchParams();
    params.append(TIMELINE_VALUE_FILTERS_QUERY_PARAM, "Custom.Team~LegacyTf");
    params.append(TIMELINE_DATE_FILTERS_QUERY_PARAM, "Custom.StartDate~2026-03-02T00%3A00%3A00.000Z~");
    params.set(
      LEGACY_TIMELINE_FILTERS_QUERY_PARAM,
      JSON.stringify([{ fieldRef: "Custom.Team", selectedValueKeys: ["LegacyJson"] }])
    );
    params.set(
      TIMELINE_FILTER_GROUPS_QUERY_PARAM,
      JSON.stringify({
        version: 1,
        groups: [
          {
            filters: [
              {
                kind: "value",
                fieldRef: "Custom.Team",
                selectedValueKeys: ["FromTfg"]
              }
            ]
          },
          {
            filters: [
              {
                kind: "value",
                fieldRef: "Custom.Stream",
                selectedValueKeys: ["Platform"]
              }
            ]
          }
        ]
      })
    );

    const parsed = parseTimelineFilterGroupsFromSearch(`?${params.toString()}`);

    expect(parsed).toEqual([
      createTimelineFilterGroup(0, [
        createTimelineValueFieldFilter(0, "Custom.Team", ["FromTfg"])
      ]),
      createTimelineFilterGroup(1, [
        createTimelineValueFieldFilter(1, "Custom.Stream", ["Platform"])
      ])
    ]);
  });

  it("imports old tf and tdf params as a single group", () => {
    const params = new URLSearchParams();
    params.append(TIMELINE_VALUE_FILTERS_QUERY_PARAM, "Custom.Team~Alpha");
    params.append(TIMELINE_DATE_FILTERS_QUERY_PARAM, "Custom.StartDate~2026-03-02T00%3A00%3A00.000Z~");

    const parsed = parseTimelineFilterGroupsFromSearch(`?${params.toString()}`);

    expect(parsed).toEqual([
      createTimelineFilterGroup(0, [
        createTimelineValueFieldFilter(0, "Custom.Team", ["Alpha"]),
        createTimelineDateRangeFieldFilter(1, "Custom.StartDate", {
          startIso: "2026-03-02T00:00:00.000Z",
          endIso: null
        })
      ])
    ]);
  });

  it("serializes exactly one active group with old tf and tdf params", () => {
    const serialized = serializeTimelineFilterGroupsForUrl([
      createTimelineFilterGroup(0, [
        createTimelineValueFieldFilter(0, "Custom.Team", ["Alpha"]),
        createTimelineDateRangeFieldFilter(1, "Custom.StartDate", {
          startIso: "2026-03-02T00:00:00.000Z",
          endIso: null
        })
      ]),
      createTimelineFilterGroup(1, [
        createTimelineValueFieldFilter(2, "Custom.Stream", [])
      ])
    ]);

    expect(serialized).toEqual([
      {
        name: TIMELINE_VALUE_FILTERS_QUERY_PARAM,
        value: "Custom.Team~Alpha"
      },
      {
        name: TIMELINE_DATE_FILTERS_QUERY_PARAM,
        value: "Custom.StartDate~2026-03-02T00%3A00%3A00.000Z~"
      }
    ]);
  });

  it("serializes two active groups with only tfg", () => {
    const serialized = serializeTimelineFilterGroupsForUrl([
      createTimelineFilterGroup(0, [
        createTimelineValueFieldFilter(0, "Custom.Team", ["Alpha"])
      ]),
      createTimelineFilterGroup(1, [
        createTimelineValueFieldFilter(1, "Custom.Stream", ["Platform"])
      ])
    ]);

    expect(serialized).toHaveLength(1);
    expect(serialized[0]?.name).toBe(TIMELINE_FILTER_GROUPS_QUERY_PARAM);
    expect(JSON.parse(serialized[0]?.value ?? "{}")).toEqual({
      version: 1,
      groups: [
        {
          filters: [
            {
              kind: "value",
              fieldRef: "Custom.Team",
              selectedValueKeys: ["Alpha"]
            }
          ]
        },
        {
          filters: [
            {
              kind: "value",
              fieldRef: "Custom.Stream",
              selectedValueKeys: ["Platform"]
            }
          ]
        }
      ]
    });
  });

  it("imports at most five active filters from tfg", () => {
    const params = new URLSearchParams();
    params.set(
      TIMELINE_FILTER_GROUPS_QUERY_PARAM,
      JSON.stringify({
        version: 1,
        groups: [
          {
            filters: [0, 1, 2].map((index) => ({
              kind: "value",
              fieldRef: `Custom.Team${index}`,
              selectedValueKeys: ["Alpha"]
            }))
          },
          {
            filters: [3, 4, 5].map((index) => ({
              kind: "value",
              fieldRef: `Custom.Team${index}`,
              selectedValueKeys: ["Beta"]
            }))
          }
        ]
      })
    );

    const parsed = parseTimelineFilterGroupsFromSearch(`?${params.toString()}`);
    const filters = parsed.flatMap((group) => group.filters);

    expect(filters).toHaveLength(5);
    expect(filters.map((filter) => filter.slotId)).toEqual([0, 1, 2, 3, 4]);
    expect(parsed.map((group) => group.filters.length)).toEqual([3, 2]);
  });

  it("round-trips special characters in tfg values", () => {
    const specialValue = "Alpha,Beta~Ops/QA + 50% \"quoted\" & =";
    const serialized = serializeTimelineFilterGroupsForUrl([
      createTimelineFilterGroup(0, [
        createTimelineValueFieldFilter(0, "Custom.Team", [specialValue])
      ]),
      createTimelineFilterGroup(1, [
        createTimelineValueFieldFilter(1, "Custom.Stream", ["Platform/Delivery"])
      ])
    ]);
    const params = new URLSearchParams();
    serialized.forEach((entry) => params.append(entry.name, entry.value));

    const parsed = parseTimelineFilterGroupsFromSearch(`?${params.toString()}`);

    expect(parsed[0]?.filters[0]).toEqual(createTimelineValueFieldFilter(0, "Custom.Team", [specialValue]));
    expect(parsed[1]?.filters[0]).toEqual(createTimelineValueFieldFilter(1, "Custom.Stream", ["Platform/Delivery"]));
  });
});
