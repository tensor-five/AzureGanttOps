import {
  createTimelineDateRangeFieldFilter,
  createTimelineValueFieldFilter,
  isTimelineDateRangeFilter,
  MAX_TIMELINE_FILTER_SLOTS,
  normalizeTimelineFilterFieldRef,
  type TimelineDateRange,
  type TimelineFieldFilter
} from "./timeline-filter-model.js";
import {
  isActiveTimelineFieldFilter,
  isTimelineDateFieldRef,
  normalizeLegacyTimelineDateFilterValueIso,
  normalizeTimelineDateIso,
  type TimelineDateFilterContext
} from "./timeline-field-filtering.js";

export const TIMELINE_VALUE_FILTERS_QUERY_PARAM = "tf";
export const TIMELINE_DATE_FILTERS_QUERY_PARAM = "tdf";
export const LEGACY_TIMELINE_FILTERS_QUERY_PARAM = "timelineFilters";

type ParsedTimelineFilter =
  | {
      kind: "value";
      fieldRef: string;
      selectedValueKeys: string[];
    }
  | {
      kind: "dateRange";
      fieldRef: string;
      dateRange: TimelineDateRange;
    };

export type SerializedTimelineFilterParam = {
  name: typeof TIMELINE_VALUE_FILTERS_QUERY_PARAM | typeof TIMELINE_DATE_FILTERS_QUERY_PARAM;
  value: string;
};

export function hasTimelineFilterUrlSearchParams(search: string): boolean {
  try {
    const params = new URLSearchParams(search);
    return (
      params.has(TIMELINE_VALUE_FILTERS_QUERY_PARAM) ||
      params.has(TIMELINE_DATE_FILTERS_QUERY_PARAM) ||
      params.has(LEGACY_TIMELINE_FILTERS_QUERY_PARAM)
    );
  } catch {
    return false;
  }
}

export function parseTimelineFiltersFromSearch(
  search: string,
  options: { dateFilterContext?: TimelineDateFilterContext } = {}
): TimelineFieldFilter[] {
  try {
    const params = new URLSearchParams(search);
    const parsed: ParsedTimelineFilter[] = [];

    for (const [name, value] of params.entries()) {
      if (parsed.length >= MAX_TIMELINE_FILTER_SLOTS) {
        break;
      }

      const entry =
        name === TIMELINE_VALUE_FILTERS_QUERY_PARAM
          ? parseCompactValueTimelineFilterParam(value, options.dateFilterContext)
          : name === TIMELINE_DATE_FILTERS_QUERY_PARAM
            ? parseCompactDateTimelineFilterParam(value)
            : null;
      if (entry) {
        parsed.push(entry);
      }
    }

    if (parsed.length > 0) {
      return withSlotIds(parsed);
    }

    const legacyRaw = params.get(LEGACY_TIMELINE_FILTERS_QUERY_PARAM);
    if (!legacyRaw) {
      return [];
    }

    return withSlotIds(parseLegacyTimelineFilters(legacyRaw, options.dateFilterContext).slice(0, MAX_TIMELINE_FILTER_SLOTS));
  } catch {
    return [];
  }
}

export function serializeTimelineFiltersForUrl(filters: TimelineFieldFilter[]): SerializedTimelineFilterParam[] {
  return filters
    .filter((filter) => isActiveTimelineFieldFilter(filter))
    .slice(0, MAX_TIMELINE_FILTER_SLOTS)
    .map((filter): SerializedTimelineFilterParam | null => {
      const fieldRef = normalizeTimelineFilterFieldRef(filter.fieldRef);
      if (!fieldRef) {
        return null;
      }

      if (isTimelineDateRangeFilter(filter)) {
        return {
          name: TIMELINE_DATE_FILTERS_QUERY_PARAM,
          value: toCompactDateTimelineFilterParam(fieldRef, filter.dateRange)
        };
      }

      return {
        name: TIMELINE_VALUE_FILTERS_QUERY_PARAM,
        value: toCompactValueTimelineFilterParam(fieldRef, filter.selectedValueKeys)
      };
    })
    .filter((entry): entry is SerializedTimelineFilterParam => entry !== null);
}

export function syncTimelineFiltersToUrl(filters: TimelineFieldFilter[]): void {
  if (typeof globalThis.window === "undefined") {
    return;
  }

  const params = new URLSearchParams(globalThis.window.location.search);
  params.delete(TIMELINE_VALUE_FILTERS_QUERY_PARAM);
  params.delete(TIMELINE_DATE_FILTERS_QUERY_PARAM);
  params.delete(LEGACY_TIMELINE_FILTERS_QUERY_PARAM);
  serializeTimelineFiltersForUrl(filters).forEach((entry) => {
    params.append(entry.name, entry.value);
  });

  const nextSearch = params.toString();
  const normalizedCurrentSearch = globalThis.window.location.search.startsWith("?")
    ? globalThis.window.location.search.slice(1)
    : globalThis.window.location.search;
  if (nextSearch === normalizedCurrentSearch) {
    return;
  }

  const nextUrl = `${globalThis.window.location.pathname}${nextSearch.length > 0 ? `?${nextSearch}` : ""}${globalThis.window.location.hash}`;
  globalThis.window.history.replaceState(globalThis.window.history.state, "", nextUrl);
}

function parseCompactValueTimelineFilterParam(
  value: string,
  dateFilterContext: TimelineDateFilterContext | undefined
): ParsedTimelineFilter | null {
  const compactParts = value.split("~");
  const rawFieldRef = compactParts[0] ?? "";
  const rawValues = compactParts[1] ?? "";
  if (!rawFieldRef) {
    return null;
  }

  const fieldRef = decodeTimelineFilterToken(rawFieldRef).trim();
  if (fieldRef.length === 0) {
    return null;
  }

  const selectedValueKeys = rawValues
    .split(",")
    .map((entry) => decodeTimelineFilterToken(entry).trim())
    .filter((entry) => entry.length > 0);

  const uniqueSelectedValueKeys = [...new Set(selectedValueKeys)];
  if (uniqueSelectedValueKeys.length === 0) {
    return null;
  }

  if (isTimelineDateFieldRef(fieldRef, dateFilterContext)) {
    return migrateValueFilterToDateRange(fieldRef, uniqueSelectedValueKeys) ?? {
      kind: "value",
      fieldRef,
      selectedValueKeys: uniqueSelectedValueKeys
    };
  }

  return {
    kind: "value",
    fieldRef,
    selectedValueKeys: uniqueSelectedValueKeys
  };
}

function parseCompactDateTimelineFilterParam(value: string): ParsedTimelineFilter | null {
  const compactParts = value.split("~");
  const rawFieldRef = compactParts[0] ?? "";
  if (!rawFieldRef) {
    return null;
  }

  const fieldRef = decodeTimelineFilterToken(rawFieldRef).trim();
  if (fieldRef.length === 0) {
    return null;
  }

  const dateRange = {
    startIso: normalizeTimelineDateIso(decodeTimelineFilterToken(compactParts[1] ?? "")),
    endIso: normalizeTimelineDateIso(decodeTimelineFilterToken(compactParts[2] ?? ""))
  };
  if (!dateRange.startIso && !dateRange.endIso) {
    return null;
  }

  return {
    kind: "dateRange",
    fieldRef,
    dateRange
  };
}

function parseLegacyTimelineFilters(
  legacyRaw: string,
  dateFilterContext: TimelineDateFilterContext | undefined
): ParsedTimelineFilter[] {
  const parsed = JSON.parse(legacyRaw);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((entry): ParsedTimelineFilter | null => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const maybeFieldRef = "fieldRef" in entry ? (entry.fieldRef as unknown) : null;
      const maybeValues = "selectedValueKeys" in entry ? (entry.selectedValueKeys as unknown) : [];
      const fieldRef = normalizeTimelineFilterFieldRef(typeof maybeFieldRef === "string" ? maybeFieldRef : null);
      if (!fieldRef) {
        return null;
      }

      const selectedValueKeys = Array.isArray(maybeValues)
        ? [...new Set(maybeValues.filter((value): value is string => typeof value === "string"))]
        : [];
      if (selectedValueKeys.length === 0) {
        return null;
      }

      if (isTimelineDateFieldRef(fieldRef, dateFilterContext)) {
        return migrateValueFilterToDateRange(fieldRef, selectedValueKeys) ?? {
          kind: "value",
          fieldRef,
          selectedValueKeys
        };
      }

      return {
        kind: "value",
        fieldRef,
        selectedValueKeys
      };
    })
    .filter((entry): entry is ParsedTimelineFilter => entry !== null);
}

function migrateValueFilterToDateRange(fieldRef: string, selectedValueKeys: string[]): ParsedTimelineFilter | null {
  if (selectedValueKeys.length !== 1) {
    return null;
  }

  const normalizedDateValues: string[] = [];
  for (const value of selectedValueKeys) {
    const normalizedDateValue = normalizeLegacyTimelineDateFilterValueIso(value);
    if (!normalizedDateValue) {
      return null;
    }
    normalizedDateValues.push(normalizedDateValue);
  }

  const uniqueNormalizedDateValues = [...new Set(normalizedDateValues)];

  if (uniqueNormalizedDateValues.length !== 1) {
    return null;
  }

  const [iso] = uniqueNormalizedDateValues;
  return {
    kind: "dateRange",
    fieldRef,
    dateRange: {
      startIso: iso,
      endIso: iso
    }
  };
}

function withSlotIds(parsed: ParsedTimelineFilter[]): TimelineFieldFilter[] {
  return parsed.slice(0, MAX_TIMELINE_FILTER_SLOTS).map((entry, index) => {
    if (entry.kind === "dateRange") {
      return createTimelineDateRangeFieldFilter(index, entry.fieldRef, entry.dateRange);
    }

    return createTimelineValueFieldFilter(index, entry.fieldRef, entry.selectedValueKeys);
  });
}

function toCompactValueTimelineFilterParam(fieldRef: string, selectedValueKeys: string[]): string {
  const encodedFieldRef = encodeTimelineFilterToken(fieldRef);
  const valuePart =
    selectedValueKeys.length > 0
      ? [...new Set(selectedValueKeys)].map((value) => encodeTimelineFilterToken(value)).join(",")
      : "";
  return `${encodedFieldRef}~${valuePart}`;
}

function toCompactDateTimelineFilterParam(fieldRef: string, dateRange: TimelineDateRange): string {
  return [
    encodeTimelineFilterToken(fieldRef),
    dateRange.startIso ? encodeTimelineFilterToken(dateRange.startIso) : "",
    dateRange.endIso ? encodeTimelineFilterToken(dateRange.endIso) : ""
  ].join("~");
}

function decodeTimelineFilterToken(token: string): string {
  try {
    return decodeURIComponent(token);
  } catch {
    // Keep legacy unescaped tokens parseable even when they contain stray "%".
    return token;
  }
}

function encodeTimelineFilterToken(token: string): string {
  return encodeURIComponent(token).replace(/~/g, "%7E");
}
