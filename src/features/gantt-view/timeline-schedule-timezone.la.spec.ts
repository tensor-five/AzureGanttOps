import { describe, expect, it } from "vitest";

import {
  parseTimelineTargetDate,
  toTimelineTargetDateDisplayValue,
  toTimelineTargetDateWriteIso
} from "./timeline-schedule-dates.js";
import { resolveDraggedScheduleOverride } from "./timeline-schedule-overrides.js";

const LA_TIMEZONE_CHILD_ENV = "TIMELINE_SCHEDULE_TIMEZONE_LA_CHILD";
const describeInLaChild = process.env[LA_TIMEZONE_CHILD_ENV] === "1" ? describe : describe.skip;

describeInLaChild("timeline schedule timezone in America/Los_Angeles", () => {
  it("runs inside the dedicated LA subprocess", () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("America/Los_Angeles");
    expect(new Date(2026, 2, 9, 12, 0, 0, 0).getTimezoneOffset()).toBe(420);
  });

  it("hard-checks UTC-7 target write and parse behavior", () => {
    const targetDay = utcDay(2026, 2, 9);
    const written = toTimelineTargetDateWriteIso(targetDay);
    const displayValue = toTimelineTargetDateDisplayValue(targetDay);
    const nonMidnightLocalInstant = new Date(2026, 2, 9, 16, 30, 0, 0).toISOString();

    expect(written).toBe("2026-03-10T00:00:00.000Z");
    expect(displayValue).toBe("2026-03-09");
    expect(nonMidnightLocalInstant).toBe("2026-03-09T23:30:00.000Z");
    expectTimelineDay(parseTimelineTargetDate(written), "2026-03-10T00:00:00.000Z");
    expectTimelineDay(parseTimelineTargetDate(nonMidnightLocalInstant), "2026-03-09T00:00:00.000Z");
  });

  it("keeps display and write values separated for the LA midnight collision", () => {
    const override = resolveDraggedScheduleOverride(
      {
        mode: "resize-end",
        sourceStartDateIso: "2026-03-09T00:00:00.000Z"
      },
      {
        startDate: utcDay(2026, 2, 9),
        endDate: utcDay(2026, 2, 9)
      }
    );

    expect(override.display).toEqual({
      startDate: "2026-03-09T00:00:00.000Z",
      endDate: "2026-03-09"
    });
    expect(override.write).toEqual({
      startDate: "2026-03-09T00:00:00.000Z",
      endDate: "2026-03-10T00:00:00.000Z"
    });
    expectTimelineDay(parseTimelineTargetDate(override.display.endDate), "2026-03-09T00:00:00.000Z");
    expectTimelineDay(parseTimelineTargetDate(override.write.endDate), "2026-03-10T00:00:00.000Z");
  });
});

function utcDay(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day));
}

function expectTimelineDay(value: Date | null, expectedIso: string): void {
  expect(value?.toISOString()).toBe(expectedIso);
}
