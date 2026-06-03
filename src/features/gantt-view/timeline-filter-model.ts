export const MAX_TIMELINE_FILTER_SLOTS = 5;

export type TimelineDateRange = {
  startIso: string | null;
  endIso: string | null;
};

type TimelineFieldFilterBase = {
  slotId: number;
  fieldRef: string | null;
};

export type TimelineValueFieldFilter = TimelineFieldFilterBase & {
  kind: "value";
  selectedValueKeys: string[];
};

export type TimelineDateRangeFieldFilter = TimelineFieldFilterBase & {
  kind: "dateRange";
  dateRange: TimelineDateRange;
};

export type TimelineFieldFilter = TimelineValueFieldFilter | TimelineDateRangeFieldFilter;

export type TimelineFilterGroup = {
  groupId: number;
  filters: TimelineFieldFilter[];
};

export const EMPTY_TIMELINE_DATE_RANGE: TimelineDateRange = {
  startIso: null,
  endIso: null
};

export function createInitialTimelineFieldFilters(): TimelineFieldFilter[] {
  return [createTimelineFieldFilter(0)];
}

export function createInitialTimelineFilterGroups(): TimelineFilterGroup[] {
  return [createTimelineFilterGroup(0, createInitialTimelineFieldFilters())];
}

export function createTimelineFilterGroup(groupId: number, filters: TimelineFieldFilter[]): TimelineFilterGroup {
  return {
    groupId,
    filters: filters.map((filter) => cloneTimelineFieldFilter(filter))
  };
}

export function createTimelineFieldFilter(slotId: number): TimelineFieldFilter {
  return createTimelineValueFieldFilter(slotId);
}

export function createTimelineValueFieldFilter(
  slotId: number,
  fieldRef: string | null = null,
  selectedValueKeys: string[] = []
): TimelineValueFieldFilter {
  return {
    slotId,
    fieldRef: normalizeTimelineFilterFieldRef(fieldRef),
    kind: "value",
    selectedValueKeys: [...new Set(selectedValueKeys)]
  };
}

export function createTimelineDateRangeFieldFilter(
  slotId: number,
  fieldRef: string,
  dateRange: TimelineDateRange = EMPTY_TIMELINE_DATE_RANGE
): TimelineDateRangeFieldFilter {
  return {
    slotId,
    fieldRef: normalizeTimelineFilterFieldRef(fieldRef),
    kind: "dateRange",
    dateRange: normalizeTimelineDateRange(dateRange)
  };
}

export function normalizeTimelineFilterFieldRef(fieldRef: string | null | undefined): string | null {
  if (typeof fieldRef !== "string") {
    return null;
  }

  const normalized = fieldRef.trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeTimelineDateRange(dateRange: TimelineDateRange): TimelineDateRange {
  return {
    startIso: normalizeDateRangeIso(dateRange.startIso),
    endIso: normalizeDateRangeIso(dateRange.endIso)
  };
}

export function isTimelineValueFieldFilter(filter: TimelineFieldFilter): filter is TimelineValueFieldFilter {
  return filter.kind === "value";
}

export function isTimelineDateRangeFilter(filter: TimelineFieldFilter): filter is TimelineDateRangeFieldFilter {
  return filter.kind === "dateRange";
}

function cloneTimelineFieldFilter(filter: TimelineFieldFilter): TimelineFieldFilter {
  if (isTimelineDateRangeFilter(filter)) {
    return {
      ...filter,
      dateRange: normalizeTimelineDateRange(filter.dateRange)
    };
  }

  return {
    ...filter,
    selectedValueKeys: [...filter.selectedValueKeys]
  };
}

function normalizeDateRangeIso(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
