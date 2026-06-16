const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TARGET_DATE_LOCAL_WRITE_HOUR = 17;

export function toTimelineStartDateWriteIso(day: Date): string {
  return toUtcTimelineDay(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()).toISOString();
}

export function toTimelineTargetDateWriteIso(day: Date): string {
  return new Date(
    day.getUTCFullYear(),
    day.getUTCMonth(),
    day.getUTCDate(),
    TARGET_DATE_LOCAL_WRITE_HOUR,
    0,
    0,
    0
  ).toISOString();
}

export function toTimelineTargetDateDisplayValue(day: Date): string {
  return toDateOnly(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
}

export function parseTimelineStartDate(value: string | null): Date | null {
  const parsed = parseScheduleDate(value);
  if (!parsed) {
    return null;
  }

  return toUtcTimelineDay(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
}

export function parseTimelineTargetDate(value: string | null): Date | null {
  const text = normalizeScheduleDateText(value);
  if (!text) {
    return null;
  }

  const parsed = parseScheduleDate(text);
  if (!parsed) {
    return null;
  }

  if (DATE_ONLY_PATTERN.test(text)) {
    return toUtcTimelineDay(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
  }

  if (isUtcMidnight(parsed)) {
    return toUtcTimelineDay(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
  }

  return toUtcTimelineDay(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function parseScheduleDate(value: string | null): Date | null {
  const text = normalizeScheduleDateText(value);
  if (!text) {
    return null;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeScheduleDateText(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const text = value.trim();
  return text.length > 0 ? text : null;
}

function toUtcTimelineDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

function isUtcMidnight(value: Date): boolean {
  return (
    value.getUTCHours() === 0 &&
    value.getUTCMinutes() === 0 &&
    value.getUTCSeconds() === 0 &&
    value.getUTCMilliseconds() === 0
  );
}

function toDateOnly(year: number, month: number, day: number): string {
  return `${year}-${padDatePart(month + 1)}-${padDatePart(day)}`;
}

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}
