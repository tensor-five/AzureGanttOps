// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useScheduleDragging } from "./use-schedule-dragging.js";

describe("useScheduleDragging", () => {
  it("initializes with empty schedule drag state and supports updates", () => {
    const { result } = renderHook(() => useScheduleDragging());

    expect(result.current.adoptedSchedulesByWorkItemId).toEqual({});
    expect(result.current.editedBarSchedulesByWorkItemId).toEqual({});
    expect(result.current.adoptScheduleError).toBeNull();
    expect(result.current.activeScheduleDrag).toBeNull();
    expect(result.current.activeUnschedulableDrag).toBeNull();
    expect(result.current.unscheduledDropPreview).toBeNull();

    act(() => {
      result.current.setActiveScheduleDrag({
        mode: "move",
        pointerId: 7,
        workItemId: 42,
        originClientX: 128,
        startDate: new Date("2026-03-01T00:00:00.000Z"),
        endDate: new Date("2026-03-03T00:00:00.000Z"),
        lastDayDelta: 1
      });
    });

    expect(result.current.activeScheduleDrag?.workItemId).toBe(42);
  });
});
