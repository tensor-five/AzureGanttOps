import { describe, expect, it } from "vitest";

import {
  DEFAULT_UNSCHEDULED_DURATION_DAYS,
  createExactScheduleOverride,
  resolveDraggedScheduleOverride,
  resolveUnscheduledDropRange,
  resolveUnscheduledDropSchedule
} from "./timeline-schedule-overrides.js";

describe("timeline schedule overrides", () => {
  it("separates dragged move display dates from target write instants", () => {
    const override = resolveDraggedScheduleOverride(
      { mode: "move" },
      {
        startDate: utcDay(2026, 2, 9),
        endDate: utcDay(2026, 2, 10)
      }
    );

    expect(override.display).toEqual({
      startDate: "2026-03-09T00:00:00.000Z",
      endDate: "2026-03-10"
    });
    expect(override.write).toEqual({
      startDate: "2026-03-09T00:00:00.000Z",
      endDate: localTargetWriteIso(2026, 2, 10)
    });
  });

  it("keeps the original start date exact when resizing the end handle", () => {
    const override = resolveDraggedScheduleOverride(
      {
        mode: "resize-end",
        sourceStartDateIso: "2026-03-01T12:34:00.000Z"
      },
      {
        startDate: utcDay(2026, 2, 1),
        endDate: utcDay(2026, 2, 5)
      }
    );

    expect(override.display).toEqual({
      startDate: "2026-03-01T12:34:00.000Z",
      endDate: "2026-03-05"
    });
    expect(override.write).toEqual({
      startDate: "2026-03-01T12:34:00.000Z",
      endDate: localTargetWriteIso(2026, 2, 5)
    });
  });

  it("keeps the original end date exact when resizing the start handle", () => {
    const override = resolveDraggedScheduleOverride(
      {
        mode: "resize-start",
        sourceEndDateIso: "2026-03-03T16:30:00.000Z"
      },
      {
        startDate: utcDay(2026, 2, 2),
        endDate: utcDay(2026, 2, 3)
      }
    );

    expect(override.display).toEqual({
      startDate: "2026-03-02T00:00:00.000Z",
      endDate: "2026-03-03T16:30:00.000Z"
    });
    expect(override.write).toEqual({
      startDate: "2026-03-02T00:00:00.000Z",
      endDate: "2026-03-03T16:30:00.000Z"
    });
  });

  it("creates exact display and write schedules for rollback", () => {
    const schedule = {
      startDate: "2026-03-01T00:00:00.000Z",
      endDate: "2026-03-03T00:00:00.000Z"
    };

    expect(createExactScheduleOverride(schedule)).toEqual({
      display: schedule,
      write: schedule
    });
  });

  it("resolves default unscheduled drops with local target writes and date-only display", () => {
    const schedule = resolveUnscheduledDropSchedule({
      startDate: utcDay(2026, 2, 9),
      fixedEndDateIso: null,
      fixedEndTimelineDate: null
    });

    expect(schedule.range).toEqual({
      startDate: utcDay(2026, 2, 9),
      endDate: utcDay(2026, 2, 22)
    });
    expect(dayDelta(schedule.range.startDate, schedule.range.endDate)).toBe(DEFAULT_UNSCHEDULED_DURATION_DAYS - 1);
    expect(schedule.display).toEqual({
      startDate: "2026-03-09T00:00:00.000Z",
      endDate: "2026-03-22"
    });
    expect(schedule.write).toEqual({
      startDate: "2026-03-09T00:00:00.000Z",
      endDate: localTargetWriteIso(2026, 2, 22)
    });
  });

  it("passes fixed unscheduled end dates through exactly", () => {
    const schedule = resolveUnscheduledDropSchedule({
      startDate: utcDay(2026, 2, 9),
      fixedEndDateIso: "2026-03-10T16:30:00.000Z",
      fixedEndTimelineDate: utcDay(2026, 2, 10)
    });

    expect(schedule.range).toEqual({
      startDate: utcDay(2026, 2, 9),
      endDate: utcDay(2026, 2, 10)
    });
    expect(schedule.display).toEqual({
      startDate: "2026-03-09T00:00:00.000Z",
      endDate: "2026-03-10T16:30:00.000Z"
    });
    expect(schedule.write).toEqual(schedule.display);
  });

  it("clamps drops after a fixed end date back to that end date", () => {
    const range = resolveUnscheduledDropRange(utcDay(2026, 2, 12), utcDay(2026, 2, 10));

    expect(range).toEqual({
      startDate: utcDay(2026, 2, 10),
      endDate: utcDay(2026, 2, 10)
    });
  });
});

function utcDay(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day));
}

function localTargetWriteIso(year: number, monthIndex: number, day: number): string {
  return new Date(year, monthIndex, day, 17, 0, 0, 0).toISOString();
}

function dayDelta(startDate: Date, endDate: Date): number {
  return Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000);
}
