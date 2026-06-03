import {
  createTimelineDateRangeFieldFilter,
  createTimelineFilterGroup,
  createTimelineValueFieldFilter,
  isTimelineDateRangeFilter,
  MAX_TIMELINE_FILTER_SLOTS,
  normalizeTimelineFilterFieldRef,
  type TimelineDateRange,
  type TimelineFieldFilter,
  type TimelineFilterGroup
} from "./timeline-filter-model.js";
import {
  isActiveTimelineFieldFilter,
  isActiveTimelineDateRange,
  isTimelineDateFieldRef,
  normalizeLegacyTimelineDateFilterValueIso,
  normalizeTimelineDateIso,
  type TimelineDateFilterContext
} from "./timeline-field-filtering.js";

export const TIMELINE_VALUE_FILTERS_QUERY_PARAM = "tf";
export const TIMELINE_DATE_FILTERS_QUERY_PARAM = "tdf";
export const TIMELINE_FILTER_GROUPS_QUERY_PARAM = "tfg";
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
  name:
    | typeof TIMELINE_VALUE_FILTERS_QUERY_PARAM
    | typeof TIMELINE_DATE_FILTERS_QUERY_PARAM
    | typeof TIMELINE_FILTER_GROUPS_QUERY_PARAM;
  value: string;
};

export function hasTimelineFilterUrlSearchParams(search: string): boolean {
  try {
    const params = new URLSearchParams(search);
    return (
      params.has(TIMELINE_FILTER_GROUPS_QUERY_PARAM) ||
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
  return parseTimelineFilterGroupsFromSearch(search, options).flatMap((group) => group.filters);
}

export function parseTimelineFilterGroupsFromSearch(
  search: string,
  options: { dateFilterContext?: TimelineDateFilterContext } = {}
): TimelineFilterGroup[] {
  try {
    const params = new URLSearchParams(search);

    const groupRaw = params.get(TIMELINE_FILTER_GROUPS_QUERY_PARAM);
    if (groupRaw !== null) {
      const parsedGroups = parseVersionedTimelineFilterGroupsParam(groupRaw);
      if (parsedGroups !== null) {
        return withGroupAndSlotIds(parsedGroups);
      }
    }

    const parsed = parseCompactAndLegacyTimelineFilters(params, options.dateFilterContext);
    return parsed.length > 0 ? [createTimelineFilterGroup(0, withSlotIds(parsed))] : [];
  } catch {
    return [];
  }
}

export function serializeTimelineFiltersForUrl(filters: TimelineFieldFilter[]): SerializedTimelineFilterParam[] {
  return serializeFlatTimelineFiltersForUrl(filters);
}

export function serializeTimelineFilterGroupsForUrl(groups: TimelineFilterGroup[]): SerializedTimelineFilterParam[] {
  const activeGroups = limitActiveTimelineFilterGroups(groups);
  if (activeGroups.length === 0) {
    return [];
  }

  if (activeGroups.length === 1) {
    return serializeFlatTimelineFiltersForUrl(activeGroups[0]?.filters ?? []);
  }

  return [
    {
      name: TIMELINE_FILTER_GROUPS_QUERY_PARAM,
      value: JSON.stringify({
        version: 1,
        groups: activeGroups.map((group) => ({
          filters: group.filters.map((filter) => toVersionedTimelineFilter(filter))
        }))
      })
    }
  ];
}

export function syncTimelineFiltersToUrl(filters: TimelineFieldFilter[]): void {
  syncTimelineFilterGroupsToUrl([createTimelineFilterGroup(0, filters)]);
}

export function syncTimelineFilterGroupsToUrl(groups: TimelineFilterGroup[]): void {
  if (typeof globalThis.window === "undefined") {
    return;
  }

  const params = new URLSearchParams(globalThis.window.location.search);
  params.delete(TIMELINE_FILTER_GROUPS_QUERY_PARAM);
  params.delete(TIMELINE_VALUE_FILTERS_QUERY_PARAM);
  params.delete(TIMELINE_DATE_FILTERS_QUERY_PARAM);
  params.delete(LEGACY_TIMELINE_FILTERS_QUERY_PARAM);
  serializeTimelineFilterGroupsForUrl(groups).forEach((entry) => {
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

function parseCompactAndLegacyTimelineFilters(
  params: URLSearchParams,
  dateFilterContext: TimelineDateFilterContext | undefined
): ParsedTimelineFilter[] {
  const parsed: ParsedTimelineFilter[] = [];

  for (const [name, value] of params.entries()) {
    if (parsed.length >= MAX_TIMELINE_FILTER_SLOTS) {
      break;
    }

    const entry =
      name === TIMELINE_VALUE_FILTERS_QUERY_PARAM
        ? parseCompactValueTimelineFilterParam(value, dateFilterContext)
        : name === TIMELINE_DATE_FILTERS_QUERY_PARAM
          ? parseCompactDateTimelineFilterParam(value)
          : null;
    if (entry) {
      parsed.push(entry);
    }
  }

  if (parsed.length > 0) {
    return parsed;
  }

  const legacyRaw = params.get(LEGACY_TIMELINE_FILTERS_QUERY_PARAM);
  if (!legacyRaw) {
    return [];
  }

  try {
    return parseLegacyTimelineFilters(legacyRaw, dateFilterContext).slice(0, MAX_TIMELINE_FILTER_SLOTS);
  } catch {
    return [];
  }
}

function serializeFlatTimelineFiltersForUrl(filters: TimelineFieldFilter[]): SerializedTimelineFilterParam[] {
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

function parseVersionedTimelineFilterGroupsParam(value: string): ParsedTimelineFilter[][] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const version = "version" in parsed ? (parsed.version as unknown) : null;
  const groups = "groups" in parsed ? (parsed.groups as unknown) : null;
  if (version !== 1 || !Array.isArray(groups)) {
    return null;
  }

  const parsedGroups: ParsedTimelineFilter[][] = [];
  let activeFilterCount = 0;
  for (const group of groups) {
    if (!group || typeof group !== "object") {
      return null;
    }

    const filters = "filters" in group ? (group.filters as unknown) : null;
    if (!Array.isArray(filters)) {
      return null;
    }

    const parsedFilters: ParsedTimelineFilter[] = [];
    for (const filter of filters) {
      if (activeFilterCount >= MAX_TIMELINE_FILTER_SLOTS) {
        break;
      }

      const parsedFilter = parseVersionedTimelineFilter(filter);
      if (parsedFilter === null) {
        return null;
      }

      if (!isActiveParsedTimelineFilter(parsedFilter)) {
        continue;
      }

      parsedFilters.push(parsedFilter);
      activeFilterCount += 1;
    }

    if (parsedFilters.length > 0) {
      parsedGroups.push(parsedFilters);
    }
  }

  return parsedGroups;
}

function parseVersionedTimelineFilter(value: unknown): ParsedTimelineFilter | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const kind = "kind" in value ? (value.kind as unknown) : null;
  const fieldRef = normalizeTimelineFilterFieldRef("fieldRef" in value ? (value.fieldRef as unknown as string) : null);
  if (!fieldRef) {
    return null;
  }

  if (kind === "value") {
    const maybeSelectedValueKeys = "selectedValueKeys" in value ? (value.selectedValueKeys as unknown) : null;
    if (!Array.isArray(maybeSelectedValueKeys)) {
      return null;
    }

    return {
      kind: "value",
      fieldRef,
      selectedValueKeys: [
        ...new Set(
          maybeSelectedValueKeys
            .filter((entry): entry is string => typeof entry === "string")
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0)
        )
      ]
    };
  }

  if (kind === "dateRange") {
    const maybeDateRange = "dateRange" in value ? (value.dateRange as unknown) : null;
    if (!maybeDateRange || typeof maybeDateRange !== "object") {
      return null;
    }

    return {
      kind: "dateRange",
      fieldRef,
      dateRange: {
        startIso: normalizeTimelineDateIso("startIso" in maybeDateRange ? (maybeDateRange.startIso as unknown as string) : null),
        endIso: normalizeTimelineDateIso("endIso" in maybeDateRange ? (maybeDateRange.endIso as unknown as string) : null)
      }
    };
  }

  return null;
}

function isActiveParsedTimelineFilter(filter: ParsedTimelineFilter): boolean {
  if (filter.kind === "dateRange") {
    return isActiveTimelineDateRange(filter.dateRange);
  }

  return filter.selectedValueKeys.length > 0;
}

function limitActiveTimelineFilterGroups(groups: TimelineFilterGroup[]): TimelineFilterGroup[] {
  const activeGroups: TimelineFilterGroup[] = [];
  let activeFilterCount = 0;

  for (const group of groups) {
    if (activeFilterCount >= MAX_TIMELINE_FILTER_SLOTS) {
      break;
    }

    const filters: TimelineFieldFilter[] = [];
    for (const filter of group.filters) {
      if (activeFilterCount >= MAX_TIMELINE_FILTER_SLOTS) {
        break;
      }

      if (!isActiveTimelineFieldFilter(filter)) {
        continue;
      }

      filters.push(filter);
      activeFilterCount += 1;
    }

    if (filters.length > 0) {
      activeGroups.push(createTimelineFilterGroup(group.groupId, filters));
    }
  }

  return activeGroups;
}

function toVersionedTimelineFilter(filter: TimelineFieldFilter): ParsedTimelineFilter {
  const fieldRef = normalizeTimelineFilterFieldRef(filter.fieldRef);
  if (!fieldRef) {
    throw new Error("Cannot serialize a timeline filter without a fieldRef.");
  }

  if (isTimelineDateRangeFilter(filter)) {
    return {
      kind: "dateRange",
      fieldRef,
      dateRange: filter.dateRange
    };
  }

  return {
    kind: "value",
    fieldRef,
    selectedValueKeys: [...new Set(filter.selectedValueKeys)]
  };
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

function withGroupAndSlotIds(parsedGroups: ParsedTimelineFilter[][]): TimelineFilterGroup[] {
  const groups: TimelineFilterGroup[] = [];
  let nextSlotId = 0;

  parsedGroups.forEach((parsedFilters, groupIndex) => {
    const filters: TimelineFieldFilter[] = [];
    for (const entry of parsedFilters) {
      if (nextSlotId >= MAX_TIMELINE_FILTER_SLOTS) {
        break;
      }

      filters.push(
        entry.kind === "dateRange"
          ? createTimelineDateRangeFieldFilter(nextSlotId, entry.fieldRef, entry.dateRange)
          : createTimelineValueFieldFilter(nextSlotId, entry.fieldRef, entry.selectedValueKeys)
      );
      nextSlotId += 1;
    }

    if (filters.length > 0) {
      groups.push(createTimelineFilterGroup(groupIndex, filters));
    }
  });

  return groups;
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
