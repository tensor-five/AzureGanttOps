// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  createInitialTimelineFilterGroups,
  createTimelineFieldFilter,
  createTimelineFilterGroup,
  createTimelineValueFieldFilter
} from "./timeline-filter-model.js";
import { useTimelineFilters } from "./use-timeline-filters.js";

describe("useTimelineFilters", () => {
  it("initializes explicit groups and exposes flattened filters", () => {
    const initialGroups = [
      createTimelineFilterGroup(4, [
        createTimelineValueFieldFilter(2, "Custom.Team", ["Alpha"])
      ]),
      createTimelineFilterGroup(9, [
        createTimelineValueFieldFilter(7, "Custom.Stream", ["Platform"])
      ])
    ];

    const { result } = renderHook(() =>
      useTimelineFilters({
        groups: initialGroups,
        nextSlotId: 8,
        nextGroupId: 12
      })
    );

    expect(result.current.timelineFilterGroups).toEqual(initialGroups);
    expect(result.current.timelineFieldFilters).toEqual([
      createTimelineValueFieldFilter(2, "Custom.Team", ["Alpha"]),
      createTimelineValueFieldFilter(7, "Custom.Stream", ["Platform"])
    ]);
    expect(result.current.nextFilterSlotId).toBe(8);
    expect(result.current.nextFilterGroupId).toBe(12);
  });

  it("defaults the next group id from non-contiguous initial groups", () => {
    const { result } = renderHook(() =>
      useTimelineFilters({
        groups: [
          createTimelineFilterGroup(12, [
            createTimelineFieldFilter(2)
          ]),
          createTimelineFilterGroup(3, [
            createTimelineFieldFilter(9)
          ])
        ],
        nextSlotId: 10
      })
    );

    expect(result.current.nextFilterGroupId).toBe(13);
  });

  it("keeps setTimelineFieldFilters compatible with legacy flat filters", () => {
    const { result } = renderHook(() =>
      useTimelineFilters({
        groups: [
          createTimelineFilterGroup(4, [
            createTimelineValueFieldFilter(2, "Custom.Team", ["Alpha"])
          ]),
          createTimelineFilterGroup(9, [
            createTimelineValueFieldFilter(7, "Custom.Stream", ["Platform"])
          ])
        ],
        nextSlotId: 8
      })
    );

    act(() => {
      result.current.setTimelineFieldFilters((currentFilters) => [
        ...currentFilters,
        createTimelineValueFieldFilter(11, "System.State", ["Active"])
      ]);
    });

    expect(result.current.timelineFilterGroups).toEqual([
      createTimelineFilterGroup(0, [
        createTimelineValueFieldFilter(2, "Custom.Team", ["Alpha"]),
        createTimelineValueFieldFilter(7, "Custom.Stream", ["Platform"]),
        createTimelineValueFieldFilter(11, "System.State", ["Active"])
      ])
    ]);

    act(() => {
      result.current.setTimelineFieldFilters([]);
    });

    expect(result.current.timelineFilterGroups).toEqual(createInitialTimelineFilterGroups());
  });

  it("tracks panel open state, dropdown state, and search drafts independently", () => {
    const { result } = renderHook(() =>
      useTimelineFilters({
        filters: [createTimelineValueFieldFilter(3, "Custom.Team", ["Alpha"])],
        nextSlotId: 4
      })
    );

    expect(result.current.timelineFiltersOpen).toBe(false);
    expect(result.current.openFilterDropdown).toBeNull();
    expect(result.current.filterFieldSearchDraft).toBe("");
    expect(result.current.filterValueSearchDraft).toBe("");

    act(() => {
      result.current.setTimelineFiltersOpen(true);
      result.current.setOpenFilterDropdown({ slotId: 3, kind: "value" });
      result.current.setFilterFieldSearchDraft("team");
      result.current.setFilterValueSearchDraft("alpha");
    });

    expect(result.current.timelineFiltersOpen).toBe(true);
    expect(result.current.openFilterDropdown).toEqual({ slotId: 3, kind: "value" });
    expect(result.current.filterFieldSearchDraft).toBe("team");
    expect(result.current.filterValueSearchDraft).toBe("alpha");
    expect(result.current.timelineFieldFilters).toEqual([
      createTimelineValueFieldFilter(3, "Custom.Team", ["Alpha"])
    ]);
  });
});
