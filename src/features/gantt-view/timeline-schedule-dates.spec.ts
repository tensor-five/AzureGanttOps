import { describe, expect, it } from "vitest";

import {
  parseTimelineStartDate,
  parseTimelineTargetDate,
  toTimelineStartDateWriteIso,
  toTimelineTargetDateDisplayValue,
  toTimelineTargetDateWriteIso
} from "./timeline-schedule-dates.js";

describe("timeline schedule dates", () => {
  it("writes start dates as UTC timeline days", () => {
    const result = toTimelineStartDateWriteIso(new Date(Date.UTC(2026, 2, 9, 14, 30, 0, 0)));

    expect(result).toBe("2026-03-09T00:00:00.000Z");
  });

  it("writes target dates at 17:00 in the local time zone", () => {
    const firstWrite = toTimelineTargetDateWriteIso(new Date(Date.UTC(2026, 2, 8)));
    const secondWrite = toTimelineTargetDateWriteIso(new Date(Date.UTC(2026, 10, 1)));

    expect(firstWrite).toBe(localTargetWriteIso(2026, 2, 8));
    expect(secondWrite).toBe(localTargetWriteIso(2026, 10, 1));
    expectLocalTargetWrite(firstWrite, {
      year: 2026,
      month: 2,
      day: 8
    });
    expectLocalTargetWrite(secondWrite, {
      year: 2026,
      month: 10,
      day: 1
    });
  });

  it("writes target display values as date-only timeline days", () => {
    expect(toTimelineTargetDateDisplayValue(new Date(Date.UTC(2026, 2, 9, 14, 30, 0, 0)))).toBe("2026-03-09");
  });

  it("parses start dates as UTC timeline days", () => {
    expectTimelineDay(parseTimelineStartDate("2026-03-09T23:30:00.000Z"), "2026-03-09T00:00:00.000Z");
    expectTimelineDay(parseTimelineStartDate("2026-03-09"), "2026-03-09T00:00:00.000Z");
  });

  it("keeps date-only and UTC-midnight target values on their UTC calendar day", () => {
    expectTimelineDay(parseTimelineTargetDate("2026-03-09T00:00:00.000Z"), "2026-03-09T00:00:00.000Z");
    expectTimelineDay(parseTimelineTargetDate("2026-03-09T00:00:00Z"), "2026-03-09T00:00:00.000Z");
    expectTimelineDay(parseTimelineTargetDate("2026-03-09T00:00:00.000+00:00"), "2026-03-09T00:00:00.000Z");
    expectTimelineDay(parseTimelineTargetDate("2026-03-09"), "2026-03-09T00:00:00.000Z");
  });

  it("parses local target instants as the local calendar timeline day", () => {
    const written = toTimelineTargetDateWriteIso(new Date(Date.UTC(2026, 2, 9)));
    const localInstant = localNonMidnightInstantIso(2026, 2, 9);

    expect(written).toBe(localTargetWriteIso(2026, 2, 9));
    expectLocalTargetWrite(written, { year: 2026, month: 2, day: 9 });
    expectTimelineDay(parseTimelineTargetDate(localInstant), "2026-03-09T00:00:00.000Z");
  });

  it("keeps UTC-midnight target values stable in the current process time zone", () => {
    expectTimelineDay(parseTimelineTargetDate("2026-03-10T00:00:00.000Z"), "2026-03-10T00:00:00.000Z");
  });

  it("parses explicit non-midnight target values as the local day in the current process time zone", () => {
    const localInstant = localNonMidnightInstantIso(2026, 2, 9);

    expectTimelineDay(parseTimelineTargetDate(localInstant), "2026-03-09T00:00:00.000Z");
  });

  it("keeps target write and display values aligned in the current process time zone", () => {
    const written = toTimelineTargetDateWriteIso(new Date(Date.UTC(2026, 2, 9)));
    const displayValue = toTimelineTargetDateDisplayValue(new Date(Date.UTC(2026, 2, 9)));

    expectLocalTargetWrite(written, { year: 2026, month: 2, day: 9 });
    expect(displayValue).toBe("2026-03-09");
    expectTimelineDay(parseTimelineTargetDate(displayValue), "2026-03-09T00:00:00.000Z");
  });

  it("returns null for empty or invalid schedule values", () => {
    expect(parseTimelineStartDate(null)).toBeNull();
    expect(parseTimelineStartDate("")).toBeNull();
    expect(parseTimelineStartDate("not-a-date")).toBeNull();
    expect(parseTimelineTargetDate(null)).toBeNull();
    expect(parseTimelineTargetDate("")).toBeNull();
    expect(parseTimelineTargetDate("not-a-date")).toBeNull();
  });
});

function expectLocalTargetWrite(value: string, expected: { year: number; month: number; day: number }): void {
  const parsed = new Date(value);
  expect(parsed.getFullYear()).toBe(expected.year);
  expect(parsed.getMonth()).toBe(expected.month);
  expect(parsed.getDate()).toBe(expected.day);
  expect(parsed.getHours()).toBe(17);
  expect(parsed.getMinutes()).toBe(0);
  expect(parsed.getSeconds()).toBe(0);
  expect(parsed.getMilliseconds()).toBe(0);
}

function expectTimelineDay(value: Date | null, expectedIso: string): void {
  expect(value?.toISOString()).toBe(expectedIso);
}

function localTargetWriteIso(year: number, month: number, day: number): string {
  return new Date(year, month, day, 17, 0, 0, 0).toISOString();
}

function localNonMidnightInstantIso(year: number, month: number, day: number): string {
  for (const hour of [1, 6, 13, 17, 22]) {
    const value = new Date(year, month, day, hour, 0, 0, 0).toISOString();
    if (!value.endsWith("T00:00:00.000Z")) {
      return value;
    }
  }

  return new Date(year, month, day, 12, 30, 0, 0).toISOString();
}
