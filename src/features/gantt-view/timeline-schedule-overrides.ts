import {
  toTimelineStartDateWriteIso,
  toTimelineTargetDateDisplayValue,
  toTimelineTargetDateWriteIso
} from "./timeline-schedule-dates.js";

export const DEFAULT_UNSCHEDULED_DURATION_DAYS = 14;

type ScheduleValue = {
  startDate: string;
  endDate: string;
};

export type ScheduleOverride = {
  display: ScheduleValue;
  write: ScheduleValue;
};

type DraggedScheduleInput = {
  mode: "move" | "resize-start" | "resize-end";
  sourceStartDateIso?: string | null;
  sourceEndDateIso?: string | null;
};

type TimelineScheduleRange = {
  startDate: Date;
  endDate: Date;
};

export function resolveDraggedScheduleOverride(
  drag: DraggedScheduleInput,
  next: TimelineScheduleRange
): ScheduleOverride {
  return {
    display: resolveDraggedScheduleDisplay(drag, next),
    write: resolveDraggedScheduleWrite(drag, next)
  };
}

export function createExactScheduleOverride(schedule: ScheduleValue): ScheduleOverride {
  return {
    display: schedule,
    write: schedule
  };
}

export function resolveUnscheduledDropRange(
  startDate: Date,
  fixedEndDate: Date | null
): TimelineScheduleRange {
  let normalizedStart = normalizeUtcDate(startDate);
  const normalizedEnd = fixedEndDate
    ? normalizeUtcDate(fixedEndDate)
    : addUtcDays(normalizedStart, DEFAULT_UNSCHEDULED_DURATION_DAYS - 1);

  if (normalizedStart.getTime() > normalizedEnd.getTime()) {
    normalizedStart = normalizedEnd;
  }

  return {
    startDate: normalizedStart,
    endDate: normalizedEnd
  };
}

export function resolveUnscheduledDropSchedule(input: {
  startDate: Date;
  fixedEndDateIso: string | null;
  fixedEndTimelineDate: Date | null;
}): ScheduleOverride & { range: TimelineScheduleRange } {
  const hasFixedEndDate = input.fixedEndDateIso !== null && input.fixedEndTimelineDate !== null;
  const range = resolveUnscheduledDropRange(input.startDate, hasFixedEndDate ? input.fixedEndTimelineDate : null);
  const startDate = toTimelineStartDateWriteIso(range.startDate);
  const endDate = hasFixedEndDate ? input.fixedEndDateIso! : toTimelineTargetDateWriteIso(range.endDate);
  const displayEndDate = hasFixedEndDate ? input.fixedEndDateIso! : toTimelineTargetDateDisplayValue(range.endDate);

  return {
    range,
    display: {
      startDate,
      endDate: displayEndDate
    },
    write: {
      startDate,
      endDate
    }
  };
}

function resolveDraggedScheduleDisplay(
  drag: DraggedScheduleInput,
  next: TimelineScheduleRange
): ScheduleValue {
  if (drag.mode === "move") {
    return {
      startDate: toTimelineStartDateWriteIso(next.startDate),
      endDate: toTimelineTargetDateDisplayValue(next.endDate)
    };
  }

  if (drag.mode === "resize-end") {
    return {
      startDate: drag.sourceStartDateIso ?? toTimelineStartDateWriteIso(next.startDate),
      endDate: toTimelineTargetDateDisplayValue(next.endDate)
    };
  }

  return {
    startDate: toTimelineStartDateWriteIso(next.startDate),
    endDate: drag.sourceEndDateIso ?? toTimelineTargetDateDisplayValue(next.endDate)
  };
}

function resolveDraggedScheduleWrite(
  drag: DraggedScheduleInput,
  next: TimelineScheduleRange
): ScheduleValue {
  if (drag.mode === "move") {
    return {
      startDate: toTimelineStartDateWriteIso(next.startDate),
      endDate: toTimelineTargetDateWriteIso(next.endDate)
    };
  }

  if (drag.mode === "resize-end") {
    return {
      startDate: drag.sourceStartDateIso ?? toTimelineStartDateWriteIso(next.startDate),
      endDate: toTimelineTargetDateWriteIso(next.endDate)
    };
  }

  return {
    startDate: toTimelineStartDateWriteIso(next.startDate),
    endDate: drag.sourceEndDateIso ?? toTimelineTargetDateWriteIso(next.endDate)
  };
}

function normalizeUtcDate(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addUtcDays(value: Date, days: number): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate() + days));
}
