import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";
import {
  isTimelineDateRangeFilter,
  type TimelineDateRange,
  type TimelineFieldFilter
} from "./timeline-filter-model.js";

export const EMPTY_FIELD_FILTER_KEY = "__null__";
const TAG_FIELD_NAMES = new Set(["tag", "tags"]);
const TAG_SPLIT_DELIMITER = ";";
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})?$/;
const MS_PER_DAY = 86_400_000;
const DATE_FIELD_LEAF_PATTERN =
  /^(?:date|datetime|startdate|startdatetime|targetdate|targetdatetime|enddate|enddatetime|finishdate|finishdatetime|duedate|duedatetime|changeddate|changeddatetime|createddate|createddatetime|activateddate|activateddatetime|closeddate|closeddatetime|resolveddate|resolveddatetime|statechangedate|statechangedatetime)\d*$/i;
const KNOWN_AZURE_DATE_FIELD_REFS = new Set(
  [
    "System.CreatedDate",
    "System.ChangedDate",
    "Microsoft.VSTS.Common.ActivatedDate",
    "Microsoft.VSTS.Common.ClosedDate",
    "Microsoft.VSTS.Common.ResolvedDate",
    "Microsoft.VSTS.Common.StateChangeDate",
    "Microsoft.VSTS.Scheduling.StartDate",
    "Microsoft.VSTS.Scheduling.TargetDate",
    "Microsoft.VSTS.Scheduling.DueDate",
    "Microsoft.VSTS.Scheduling.FinishDate"
  ].map((fieldRef) => fieldRef.toLowerCase())
);

type TimelineFieldValue = string | number | null | undefined;

type TimelineDateOnlyParts = {
  year: number;
  month: number;
  day: number;
};

export type FilterValueToken = {
  key: string;
  label: string;
};

export type TimelineDateFilterContext = {
  scheduleFieldRefs?: TimelineReadModel["scheduleFieldRefs"] | null;
  sampleValuesByFieldRef?: ReadonlyMap<string, readonly TimelineFieldValue[]>;
};

export function isTagFieldRef(fieldRef: string | null | undefined): boolean {
  const normalized = normalizeFieldRef(fieldRef);
  if (!normalized) {
    return false;
  }

  const parts = normalized.split(".");
  const leaf = parts[parts.length - 1] ?? normalized;
  return TAG_FIELD_NAMES.has(leaf.toLowerCase());
}

export function extractFilterValueTokens(
  fieldRef: string | null | undefined,
  value: string | number | null | undefined
): FilterValueToken[] {
  if (value === null || typeof value === "undefined") {
    return [toEmptyToken()];
  }

  if (!isTagFieldRef(fieldRef)) {
    const text = String(value).trim();
    return text.length > 0 ? [{ key: String(value), label: text }] : [toEmptyToken()];
  }

  const raw = String(value);
  const tokens = [...new Set(raw.split(TAG_SPLIT_DELIMITER).map((entry) => entry.trim()).filter((entry) => entry.length > 0))];
  if (tokens.length === 0) {
    return [toEmptyToken()];
  }

  return tokens.map((token) => ({ key: token, label: token }));
}

export function extractFilterMatchKeys(
  fieldRef: string | null | undefined,
  value: string | number | null | undefined
): string[] {
  const keys = extractFilterValueTokens(fieldRef, value).map((token) => token.key);
  if (value !== null && typeof value !== "undefined" && isTagFieldRef(fieldRef)) {
    keys.push(String(value));
  }

  return [...new Set(keys)];
}

export function buildTimelineDateFilterContext(timeline: TimelineReadModel | null): TimelineDateFilterContext {
  if (!timeline) {
    return {};
  }

  const sampleValuesByFieldRef = new Map<string, TimelineFieldValue[]>();
  const register = (fieldValues: Record<string, string | number | null> | undefined): void => {
    if (!fieldValues) {
      return;
    }

    Object.entries(fieldValues).forEach(([fieldRef, value]) => {
      const normalizedFieldRef = normalizeFieldRef(fieldRef);
      if (!normalizedFieldRef) {
        return;
      }

      const samples = sampleValuesByFieldRef.get(normalizedFieldRef) ?? [];
      samples.push(value);
      sampleValuesByFieldRef.set(normalizedFieldRef, samples);
    });
  };

  timeline.bars.forEach((bar) => register(bar.details.fieldValues));
  timeline.unschedulable.forEach((item) => register(item.details.fieldValues));

  return {
    scheduleFieldRefs: timeline.scheduleFieldRefs ?? null,
    sampleValuesByFieldRef
  };
}

export function isTimelineDateFieldRef(
  fieldRef: string | null | undefined,
  context: TimelineDateFilterContext = {}
): boolean {
  const normalized = normalizeFieldRef(fieldRef);
  if (!normalized) {
    return false;
  }

  const normalizedLower = normalized.toLowerCase();
  if (KNOWN_AZURE_DATE_FIELD_REFS.has(normalizedLower)) {
    return true;
  }

  const scheduleFieldRefs = context.scheduleFieldRefs;
  if (
    scheduleFieldRefs &&
    (scheduleFieldRefs.start.trim().toLowerCase() === normalizedLower ||
      scheduleFieldRefs.endOrTarget.trim().toLowerCase() === normalizedLower)
  ) {
    return true;
  }

  const parts = normalized.split(".");
  const leaf = parts[parts.length - 1] ?? normalized;
  if (DATE_FIELD_LEAF_PATTERN.test(leaf)) {
    return true;
  }

  const sampleValues = context.sampleValuesByFieldRef?.get(normalized);
  return sampleValues ? doSamplesLookStrictlyDateLike(sampleValues) : false;
}

export function toTimelineDateTimeLocalInputValue(iso: string | null | undefined): string {
  const timestamp = parseTimelineDateToTimestamp(iso);
  if (timestamp === null) {
    return "";
  }

  const date = new Date(timestamp);
  return [
    `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`,
    `${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`
  ].join("T");
}

export function fromTimelineDateTimeLocalInputValue(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  const match = DATE_TIME_PATTERN.exec(normalized);
  if (!match) {
    return null;
  }

  const [, yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw, secondRaw, fractionRaw, zoneRaw] = match;
  if (typeof zoneRaw === "string") {
    return null;
  }

  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const second = typeof secondRaw === "string" ? Number(secondRaw) : 0;
  const millisecond = typeof fractionRaw === "string" ? Number(fractionRaw.slice(0, 3).padEnd(3, "0")) : 0;
  if (!areDateTimePartsValid(year, month, day, hour, minute, second, millisecond)) {
    return null;
  }

  const localDate = new Date(year, month - 1, day, hour, minute, second, millisecond);
  if (
    localDate.getFullYear() !== year ||
    localDate.getMonth() !== month - 1 ||
    localDate.getDate() !== day ||
    localDate.getHours() !== hour ||
    localDate.getMinutes() !== minute ||
    localDate.getSeconds() !== second ||
    localDate.getMilliseconds() !== millisecond
  ) {
    return null;
  }

  return localDate.toISOString();
}

export function normalizeTimelineDateIso(value: string | null | undefined): string | null {
  const timestamp = parseTimelineDateToTimestamp(value);
  return timestamp === null ? null : new Date(timestamp).toISOString();
}

export function normalizeLegacyTimelineDateFilterValueIso(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  const dateOnlyParts = parseTimelineDateOnlyParts(normalized);
  if (dateOnlyParts) {
    return fromTimelineDateTimeLocalInputValue(
      `${dateOnlyParts.year}-${padDatePart(dateOnlyParts.month)}-${padDatePart(dateOnlyParts.day)}T00:00`
    );
  }

  return normalizeTimelineDateIso(normalized);
}

export function parseTimelineDateToTimestamp(value: TimelineFieldValue): number | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  const dateOnlyParts = parseTimelineDateOnlyParts(normalized);
  if (dateOnlyParts) {
    return Date.UTC(dateOnlyParts.year, dateOnlyParts.month - 1, dateOnlyParts.day);
  }

  const dateTimeMatch = DATE_TIME_PATTERN.exec(normalized);
  if (!dateTimeMatch) {
    return null;
  }

  const [, yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw, secondRaw, fractionRaw, zoneRaw] = dateTimeMatch;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const second = typeof secondRaw === "string" ? Number(secondRaw) : 0;
  const millisecond = typeof fractionRaw === "string" ? Number(fractionRaw.slice(0, 3).padEnd(3, "0")) : 0;
  if (!areDateTimePartsValid(year, month, day, hour, minute, second, millisecond)) {
    return null;
  }

  if (typeof zoneRaw === "string") {
    const parsed = Date.parse(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
}

export function isTimelineDateRangeInvalid(dateRange: TimelineDateRange): boolean {
  const startTimestamp = parseTimelineDateToTimestamp(dateRange.startIso);
  const endTimestamp = parseTimelineDateToTimestamp(dateRange.endIso);
  return startTimestamp !== null && endTimestamp !== null && startTimestamp > endTimestamp;
}

export function isActiveTimelineDateRange(dateRange: TimelineDateRange): boolean {
  const startTimestamp = parseTimelineDateToTimestamp(dateRange.startIso);
  const endTimestamp = parseTimelineDateToTimestamp(dateRange.endIso);
  if (startTimestamp === null && endTimestamp === null) {
    return false;
  }

  return !(startTimestamp !== null && endTimestamp !== null && startTimestamp > endTimestamp);
}

export function isActiveTimelineFieldFilter(filter: TimelineFieldFilter): boolean {
  if (!filter.fieldRef) {
    return false;
  }

  if (isTimelineDateRangeFilter(filter)) {
    return isActiveTimelineDateRange(filter.dateRange);
  }

  return filter.selectedValueKeys.length > 0;
}

export function countActiveTimelineFieldFilters(filters: TimelineFieldFilter[]): number {
  return filters.filter((filter) => isActiveTimelineFieldFilter(filter)).length;
}

export function matchesTimelineDateRangeValue(value: TimelineFieldValue, dateRange: TimelineDateRange): boolean {
  if (!isActiveTimelineDateRange(dateRange)) {
    return true;
  }

  const startTimestamp = parseTimelineDateToTimestamp(dateRange.startIso);
  const endTimestamp = parseTimelineDateToTimestamp(dateRange.endIso);
  const dateOnlyParts = typeof value === "string" ? parseTimelineDateOnlyParts(value.trim()) : null;
  if (dateOnlyParts) {
    return matchesTimelineDateOnlyValueWithinRange(dateOnlyParts, startTimestamp, endTimestamp);
  }

  const valueTimestamp = parseTimelineDateToTimestamp(value);
  if (valueTimestamp === null) {
    return false;
  }

  if (startTimestamp !== null && valueTimestamp < startTimestamp) {
    return false;
  }
  if (endTimestamp !== null && valueTimestamp > endTimestamp) {
    return false;
  }

  return true;
}

export function applyTimelineFieldFilters(
  timeline: TimelineReadModel | null,
  filters: TimelineFieldFilter[]
): TimelineReadModel | null {
  if (!timeline) {
    return null;
  }

  const activeFilters = filters.filter((filter) => isActiveTimelineFieldFilter(filter));
  if (activeFilters.length === 0) {
    return timeline;
  }

  const matchesAll = (fieldValues: Record<string, string | number | null> | undefined): boolean => {
    return activeFilters.every((filter) => {
      const normalizedFieldRef = normalizeFieldRef(filter.fieldRef);
      if (!normalizedFieldRef) {
        return true;
      }

      if (isTimelineDateRangeFilter(filter)) {
        return matchesTimelineDateRangeValue(fieldValues?.[normalizedFieldRef], filter.dateRange);
      }

      const selectedValueKeys = new Set(filter.selectedValueKeys);
      const matchKeys = extractFilterMatchKeys(normalizedFieldRef, fieldValues?.[normalizedFieldRef]);
      return matchKeys.some((key) => selectedValueKeys.has(key));
    });
  };

  const bars = timeline.bars.filter((bar) => matchesAll(bar.details.fieldValues));
  const unschedulable = timeline.unschedulable.filter((item) => matchesAll(item.details.fieldValues));
  const visibleWorkItemIds = new Set<number>([
    ...bars.map((bar) => bar.workItemId),
    ...unschedulable.map((item) => item.workItemId)
  ]);
  const dependencies = timeline.dependencies.filter(
    (dependency) =>
      visibleWorkItemIds.has(dependency.predecessorWorkItemId) &&
      visibleWorkItemIds.has(dependency.successorWorkItemId)
  );
  const suppressedDependencies = timeline.suppressedDependencies.filter(
    (dependency) =>
      visibleWorkItemIds.has(dependency.predecessorWorkItemId) &&
      visibleWorkItemIds.has(dependency.successorWorkItemId)
  );

  return {
    ...timeline,
    bars,
    unschedulable,
    dependencies,
    suppressedDependencies
  };
}

export function formatTimelineDateRangeFilterLabel(dateRange: TimelineDateRange): string {
  if (isTimelineDateRangeInvalid(dateRange)) {
    return "Invalid range";
  }

  const startLabel = formatTimelineDateRangeEndpoint(dateRange.startIso);
  const endLabel = formatTimelineDateRangeEndpoint(dateRange.endIso);
  if (!startLabel && !endLabel) {
    return "Date range";
  }
  if (startLabel && !endLabel) {
    return `From ${startLabel}`;
  }
  if (!startLabel && endLabel) {
    return `Until ${endLabel}`;
  }
  if (dateRange.startIso === dateRange.endIso) {
    return `On ${startLabel}`;
  }
  return `${startLabel} - ${endLabel}`;
}

function toEmptyToken(): FilterValueToken {
  return { key: EMPTY_FIELD_FILTER_KEY, label: "Empty" };
}

function normalizeFieldRef(fieldRef: string | null | undefined): string | null {
  if (typeof fieldRef !== "string") {
    return null;
  }

  const normalized = fieldRef.trim();
  return normalized.length > 0 ? normalized : null;
}

function doSamplesLookStrictlyDateLike(values: readonly TimelineFieldValue[]): boolean {
  let hasDateLikeSample = false;

  for (const value of values) {
    if (value === null || typeof value === "undefined") {
      continue;
    }

    if (typeof value !== "string") {
      return false;
    }

    if (value.trim().length === 0) {
      continue;
    }

    if (parseTimelineDateToTimestamp(value) === null) {
      return false;
    }

    hasDateLikeSample = true;
  }

  return hasDateLikeSample;
}

function parseTimelineDateOnlyParts(value: string): TimelineDateOnlyParts | null {
  const dateOnlyMatch = DATE_ONLY_PATTERN.exec(value);
  if (!dateOnlyMatch) {
    return null;
  }

  const [, yearRaw, monthRaw, dayRaw] = dateOnlyMatch;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!areDateTimePartsValid(year, month, day, 0, 0, 0, 0)) {
    return null;
  }

  return { year, month, day };
}

function matchesTimelineDateOnlyValueWithinRange(
  valueParts: TimelineDateOnlyParts,
  startTimestamp: number | null,
  endTimestamp: number | null
): boolean {
  const valueLocalDay = toDateOnlyDayOrdinal(valueParts);
  const startLocalDay = startTimestamp === null ? null : toTimestampLocalDayOrdinal(startTimestamp);
  const endLocalDay = endTimestamp === null ? null : toTimestampLocalDayOrdinal(endTimestamp);

  if (startLocalDay !== null && valueLocalDay < startLocalDay) {
    return false;
  }
  if (endLocalDay !== null && valueLocalDay > endLocalDay) {
    return false;
  }

  return true;
}

function toTimestampLocalDayOrdinal(timestamp: number): number {
  const date = new Date(timestamp);
  return toDateOnlyDayOrdinal({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate()
  });
}

function toDateOnlyDayOrdinal(parts: TimelineDateOnlyParts): number {
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / MS_PER_DAY);
}

function areDateTimePartsValid(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number
): boolean {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    !Number.isInteger(second) ||
    !Number.isInteger(millisecond) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59 ||
    millisecond < 0 ||
    millisecond > 999
  ) {
    return false;
  }

  const candidate = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day &&
    candidate.getUTCHours() === hour &&
    candidate.getUTCMinutes() === minute &&
    candidate.getUTCSeconds() === second &&
    candidate.getUTCMilliseconds() === millisecond
  );
}

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

function formatTimelineDateRangeEndpoint(iso: string | null): string | null {
  const timestamp = parseTimelineDateToTimestamp(iso);
  if (timestamp === null) {
    return null;
  }

  const date = new Date(timestamp);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
