import { describe, expect, it } from "vitest";

import {
  addTimelineFilterConditionToGroup,
  addTimelineFilterGroup,
  countTimelineFilterSlots,
  findTimelineFilterBySlotId,
  findTimelineFilterGroupIdBySlotId,
  flattenTimelineFilterGroups,
  removeTimelineFilterCondition,
  removeTimelineFilterGroup,
  resolveNextTimelineFilterGroupId,
  resolveNextTimelineFilterSlotId,
  toggleTimelineFilterValueSelection,
  toggleVisibleTimelineFilterValueSelections,
  updateTimelineFilterDateRange,
  updateTimelineFilterFieldSelection
} from "./timeline-filter-groups.js";
import {
  createInitialTimelineFilterGroups,
  createTimelineDateRangeFieldFilter,
  createTimelineFieldFilter,
  createTimelineFilterGroup,
  createTimelineValueFieldFilter
} from "./timeline-filter-model.js";

describe("timeline-filter-groups", () => {
  it("adds groups and conditions with caller-provided ids", () => {
    const initialGroups = createInitialTimelineFilterGroups();

    const withCondition = addTimelineFilterConditionToGroup(initialGroups, 0, 4);
    const withGroup = addTimelineFilterGroup(withCondition, 7, 9);

    expect(withGroup).toEqual([
      createTimelineFilterGroup(0, [
        createTimelineFieldFilter(0),
        createTimelineFieldFilter(4)
      ]),
      createTimelineFilterGroup(7, [
        createTimelineFieldFilter(9)
      ])
    ]);
    expect(countTimelineFilterSlots(withGroup)).toBe(3);
    expect(flattenTimelineFilterGroups(withGroup).map((filter) => filter.slotId)).toEqual([0, 4, 9]);
  });

  it("does not add groups or conditions beyond the shared max slot limit", () => {
    const fullGroups = [
      createTimelineFilterGroup(0, [
        createTimelineFieldFilter(0),
        createTimelineFieldFilter(1),
        createTimelineFieldFilter(2)
      ]),
      createTimelineFilterGroup(1, [
        createTimelineFieldFilter(3),
        createTimelineFieldFilter(4)
      ])
    ];

    expect(addTimelineFilterConditionToGroup(fullGroups, 1, 5)).toBe(fullGroups);
    expect(addTimelineFilterGroup(fullGroups, 2, 5)).toBe(fullGroups);
  });

  it("removes conditions while preserving a clearable final slot", () => {
    const groups = [
      createTimelineFilterGroup(2, [
        createTimelineValueFieldFilter(5, "Custom.Team", ["Alpha"]),
        createTimelineValueFieldFilter(6, "Custom.Stream", ["Platform"])
      ]),
      createTimelineFilterGroup(3, [
        createTimelineValueFieldFilter(8, "Custom.Team", ["Beta"])
      ])
    ];

    expect(removeTimelineFilterCondition(groups, 6)).toEqual([
      createTimelineFilterGroup(2, [
        createTimelineValueFieldFilter(5, "Custom.Team", ["Alpha"])
      ]),
      createTimelineFilterGroup(3, [
        createTimelineValueFieldFilter(8, "Custom.Team", ["Beta"])
      ])
    ]);
    expect(removeTimelineFilterCondition(groups, 8)).toEqual([
      createTimelineFilterGroup(2, [
        createTimelineValueFieldFilter(5, "Custom.Team", ["Alpha"]),
        createTimelineValueFieldFilter(6, "Custom.Stream", ["Platform"])
      ])
    ]);
    expect(removeTimelineFilterCondition([groups[1]], 8)).toEqual([
      createTimelineFilterGroup(3, [
        createTimelineFieldFilter(8)
      ])
    ]);
  });

  it("removes groups directly and leaves unknown group ids unchanged", () => {
    const groups = [
      createTimelineFilterGroup(2, [
        createTimelineValueFieldFilter(5, "Custom.Team", ["Alpha"])
      ]),
      createTimelineFilterGroup(3, [
        createTimelineValueFieldFilter(8, "Custom.Team", ["Beta"])
      ])
    ];
    const onlyGroup = [
      createTimelineFilterGroup(7, [
        createTimelineValueFieldFilter(11, "Custom.Team", ["Alpha"])
      ])
    ];

    expect(removeTimelineFilterGroup(groups, 2)).toEqual([
      createTimelineFilterGroup(3, [
        createTimelineValueFieldFilter(8, "Custom.Team", ["Beta"])
      ])
    ]);
    expect(removeTimelineFilterGroup(onlyGroup, 99)).toBe(onlyGroup);
    expect(removeTimelineFilterGroup(onlyGroup, 7)).toEqual([
      createTimelineFilterGroup(7, [
        createTimelineFieldFilter(11)
      ])
    ]);
  });

  it("updates field selections, value selections, and date ranges by slot id", () => {
    const groups = [
      createTimelineFilterGroup(2, [
        createTimelineValueFieldFilter(5, "Custom.Team", ["Alpha"])
      ])
    ];

    const withSameField = updateTimelineFilterFieldSelection(groups, 5, " Custom.Team ", {});
    expect(withSameField).toEqual(groups);

    const withDifferentValueField = updateTimelineFilterFieldSelection(withSameField, 5, "Custom.Stream", {});
    expect(withDifferentValueField).toEqual([
      createTimelineFilterGroup(2, [
        createTimelineValueFieldFilter(5, "Custom.Stream", [])
      ])
    ]);

    const withDateField = updateTimelineFilterFieldSelection(withDifferentValueField, 5, "Custom.StartDate", {
      scheduleFieldRefs: {
        start: "Custom.StartDate",
        endOrTarget: "Custom.EndDate"
      }
    });
    expect(withDateField).toEqual([
      createTimelineFilterGroup(2, [
        createTimelineDateRangeFieldFilter(5, "Custom.StartDate", {
          startIso: null,
          endIso: null
        })
      ])
    ]);

    const withDateRange = updateTimelineFilterDateRange(withDateField, 5, {
      startIso: "2026-03-01T00:00:00.000Z",
      endIso: "2026-03-02T00:00:00.000Z"
    });
    expect(withDateRange).toEqual([
      createTimelineFilterGroup(2, [
        createTimelineDateRangeFieldFilter(5, "Custom.StartDate", {
          startIso: "2026-03-01T00:00:00.000Z",
          endIso: "2026-03-02T00:00:00.000Z"
        })
      ])
    ]);

    expect(updateTimelineFilterFieldSelection(withDateRange, 5, null, {})).toEqual([
      createTimelineFilterGroup(2, [
        createTimelineFieldFilter(5)
      ])
    ]);
  });

  it("toggles individual and visible value selections without duplicates", () => {
    const groups = [
      createTimelineFilterGroup(0, [
        createTimelineValueFieldFilter(1, "Custom.Team", ["Alpha"])
      ])
    ];

    const withBeta = toggleTimelineFilterValueSelection(groups, 1, "Beta");
    expect(withBeta).toEqual([
      createTimelineFilterGroup(0, [
        createTimelineValueFieldFilter(1, "Custom.Team", ["Alpha", "Beta"])
      ])
    ]);

    const withoutAlpha = toggleTimelineFilterValueSelection(withBeta, 1, "Alpha");
    expect(withoutAlpha).toEqual([
      createTimelineFilterGroup(0, [
        createTimelineValueFieldFilter(1, "Custom.Team", ["Beta"])
      ])
    ]);

    const withAllVisible = toggleVisibleTimelineFilterValueSelections(withoutAlpha, 1, ["Beta", "Gamma"]);
    expect(withAllVisible).toEqual([
      createTimelineFilterGroup(0, [
        createTimelineValueFieldFilter(1, "Custom.Team", ["Beta", "Gamma"])
      ])
    ]);

    expect(toggleVisibleTimelineFilterValueSelections(withAllVisible, 1, ["Beta", "Gamma"])).toEqual([
      createTimelineFilterGroup(0, [
        createTimelineValueFieldFilter(1, "Custom.Team", [])
      ])
    ]);
  });

  it("resolves non-contiguous ids and reports missing ids as null", () => {
    const groups = [
      createTimelineFilterGroup(12, [
        createTimelineFieldFilter(2)
      ]),
      createTimelineFilterGroup(3, [
        createTimelineFieldFilter(9)
      ])
    ];

    expect(resolveNextTimelineFilterGroupId(groups)).toBe(13);
    expect(resolveNextTimelineFilterSlotId(groups)).toBe(10);
    expect(findTimelineFilterBySlotId(groups, 9)).toEqual(createTimelineFieldFilter(9));
    expect(findTimelineFilterBySlotId(groups, 99)).toBeNull();
    expect(findTimelineFilterGroupIdBySlotId(groups, 2)).toBe(12);
    expect(findTimelineFilterGroupIdBySlotId(groups, 99)).toBeNull();
  });
});
