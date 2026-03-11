// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useTimelineFilters } from "./use-timeline-filters.js";

describe("useTimelineFilters", () => {
  it("hydrates initial filter state and keeps UI drafts isolated", () => {
    const { result } = renderHook(() =>
      useTimelineFilters({
        filters: [{ slotId: 3, fieldRef: "Custom.Team", selectedValueKeys: ["Alpha"] }],
        nextSlotId: 4
      })
    );

    expect(result.current.timelineFiltersOpen).toBe(false);
    expect(result.current.timelineFieldFilters).toEqual([
      { slotId: 3, fieldRef: "Custom.Team", selectedValueKeys: ["Alpha"] }
    ]);
    expect(result.current.nextFilterSlotId).toBe(4);
    expect(result.current.openFilterDropdown).toBeNull();

    act(() => {
      result.current.setTimelineFiltersOpen(true);
      result.current.setFilterFieldSearchDraft("team");
      result.current.setFilterValueSearchDraft("alpha");
    });

    expect(result.current.timelineFiltersOpen).toBe(true);
    expect(result.current.filterFieldSearchDraft).toBe("team");
    expect(result.current.filterValueSearchDraft).toBe("alpha");
  });
});
