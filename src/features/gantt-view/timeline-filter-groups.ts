import {
  createInitialTimelineFilterGroups,
  createTimelineDateRangeFieldFilter,
  createTimelineFieldFilter,
  createTimelineFilterGroup,
  createTimelineValueFieldFilter,
  isTimelineDateRangeFilter,
  isTimelineValueFieldFilter,
  MAX_TIMELINE_FILTER_SLOTS,
  normalizeTimelineFilterFieldRef,
  type TimelineDateRange,
  type TimelineFieldFilter,
  type TimelineFilterGroup
} from "./timeline-filter-model.js";
import {
  isTimelineDateFieldRef,
  type TimelineDateFilterContext
} from "./timeline-field-filtering.js";

export function flattenTimelineFilterGroups(groups: TimelineFilterGroup[]): TimelineFieldFilter[] {
  return groups.flatMap((group) => group.filters);
}

export function createTimelineFilterGroupsFromFilters(filters: TimelineFieldFilter[]): TimelineFilterGroup[] {
  return filters.length === 0 ? [] : [createTimelineFilterGroup(0, filters)];
}

export function countTimelineFilterSlots(groups: TimelineFilterGroup[]): number {
  return groups.reduce((count, group) => count + group.filters.length, 0);
}

export function findTimelineFilterBySlotId(groups: TimelineFilterGroup[], slotId: number): TimelineFieldFilter | null {
  for (const group of groups) {
    const filter = group.filters.find((entry) => entry.slotId === slotId);
    if (filter) {
      return filter;
    }
  }

  return null;
}

export function resolveNextTimelineFilterSlotId(groups: TimelineFilterGroup[]): number {
  const slotIds = flattenTimelineFilterGroups(groups).map((filter) => filter.slotId);
  return slotIds.length === 0 ? 0 : Math.max(...slotIds) + 1;
}

export function resolveNextTimelineFilterGroupId(groups: TimelineFilterGroup[]): number {
  const groupIds = groups.map((group) => group.groupId);
  return groupIds.length === 0 ? 0 : Math.max(...groupIds) + 1;
}

export function addTimelineFilterGroup(
  groups: TimelineFilterGroup[],
  groupId: number,
  slotId: number
): TimelineFilterGroup[] {
  if (countTimelineFilterSlots(groups) >= MAX_TIMELINE_FILTER_SLOTS) {
    return groups;
  }

  return [...groups, createTimelineFilterGroup(groupId, [createTimelineFieldFilter(slotId)])];
}

export function removeTimelineFilterGroup(groups: TimelineFilterGroup[], groupId: number): TimelineFilterGroup[] {
  if (!groups.some((group) => group.groupId === groupId)) {
    return groups;
  }

  if (groups.length <= 1) {
    const onlyGroup = groups[0];
    if (!onlyGroup) {
      return createInitialTimelineFilterGroups();
    }

    const firstSlotId = onlyGroup.filters[0]?.slotId ?? 0;
    return [createTimelineFilterGroup(onlyGroup.groupId, [createTimelineFieldFilter(firstSlotId)])];
  }

  const nextGroups = groups.filter((group) => group.groupId !== groupId);
  return nextGroups.length === 0 ? createInitialTimelineFilterGroups() : nextGroups;
}

export function addTimelineFilterConditionToGroup(
  groups: TimelineFilterGroup[],
  groupId: number,
  slotId: number
): TimelineFilterGroup[] {
  if (countTimelineFilterSlots(groups) >= MAX_TIMELINE_FILTER_SLOTS) {
    return groups;
  }

  return groups.map((group) =>
    group.groupId === groupId
      ? createTimelineFilterGroup(group.groupId, [...group.filters, createTimelineFieldFilter(slotId)])
      : group
  );
}

export function removeTimelineFilterCondition(groups: TimelineFilterGroup[], slotId: number): TimelineFilterGroup[] {
  const targetGroup = groups.find((group) => group.filters.some((filter) => filter.slotId === slotId));
  if (!targetGroup) {
    return groups;
  }

  if (targetGroup.filters.length <= 1) {
    if (groups.length <= 1) {
      return [createTimelineFilterGroup(targetGroup.groupId, [createTimelineFieldFilter(slotId)])];
    }

    return groups.filter((group) => group.groupId !== targetGroup.groupId);
  }

  return groups.map((group) =>
    group.groupId === targetGroup.groupId
      ? createTimelineFilterGroup(
          group.groupId,
          group.filters.filter((filter) => filter.slotId !== slotId)
        )
      : group
  );
}

export function updateTimelineFilterFieldSelection(
  groups: TimelineFilterGroup[],
  slotId: number,
  fieldRef: string | null,
  dateFilterContext: TimelineDateFilterContext
): TimelineFilterGroup[] {
  const normalizedFieldRef = normalizeTimelineFilterFieldRef(fieldRef);

  return mapTimelineFilterBySlotId(groups, slotId, (filter) => {
    if (!normalizedFieldRef) {
      return createTimelineFieldFilter(filter.slotId);
    }

    if (isTimelineDateFieldRef(normalizedFieldRef, dateFilterContext)) {
      return createTimelineDateRangeFieldFilter(
        filter.slotId,
        normalizedFieldRef,
        filter.fieldRef === normalizedFieldRef && isTimelineDateRangeFilter(filter)
          ? filter.dateRange
          : { startIso: null, endIso: null }
      );
    }

    return createTimelineValueFieldFilter(
      filter.slotId,
      normalizedFieldRef,
      filter.fieldRef === normalizedFieldRef && isTimelineValueFieldFilter(filter) ? filter.selectedValueKeys : []
    );
  });
}

export function toggleTimelineFilterValueSelection(
  groups: TimelineFilterGroup[],
  slotId: number,
  valueKey: string
): TimelineFilterGroup[] {
  return mapTimelineFilterBySlotId(groups, slotId, (filter) => {
    if (!isTimelineValueFieldFilter(filter)) {
      return filter;
    }

    const selectedValueKeys = filter.selectedValueKeys.includes(valueKey)
      ? filter.selectedValueKeys.filter((entry) => entry !== valueKey)
      : [...filter.selectedValueKeys, valueKey];

    return {
      ...filter,
      selectedValueKeys
    };
  });
}

export function toggleVisibleTimelineFilterValueSelections(
  groups: TimelineFilterGroup[],
  slotId: number,
  valueKeys: string[]
): TimelineFilterGroup[] {
  if (valueKeys.length === 0) {
    return groups;
  }

  return mapTimelineFilterBySlotId(groups, slotId, (filter) => {
    if (!isTimelineValueFieldFilter(filter)) {
      return filter;
    }

    const visibleValueKeySet = new Set(valueKeys);
    const allVisibleValuesSelected = valueKeys.every((valueKey) => filter.selectedValueKeys.includes(valueKey));

    if (allVisibleValuesSelected) {
      return {
        ...filter,
        selectedValueKeys: filter.selectedValueKeys.filter((valueKey) => !visibleValueKeySet.has(valueKey))
      };
    }

    const selectedValueKeys = [...filter.selectedValueKeys];
    for (const valueKey of valueKeys) {
      if (!selectedValueKeys.includes(valueKey)) {
        selectedValueKeys.push(valueKey);
      }
    }

    return {
      ...filter,
      selectedValueKeys
    };
  });
}

export function updateTimelineFilterDateRange(
  groups: TimelineFilterGroup[],
  slotId: number,
  dateRange: TimelineDateRange
): TimelineFilterGroup[] {
  return mapTimelineFilterBySlotId(groups, slotId, (filter) => {
    if (!filter.fieldRef) {
      return filter;
    }

    return createTimelineDateRangeFieldFilter(filter.slotId, filter.fieldRef, dateRange);
  });
}

export function findTimelineFilterGroupIdBySlotId(groups: TimelineFilterGroup[], slotId: number): number | null {
  const group = groups.find((entry) => entry.filters.some((filter) => filter.slotId === slotId));
  return group?.groupId ?? null;
}

function mapTimelineFilterBySlotId(
  groups: TimelineFilterGroup[],
  slotId: number,
  mapFilter: (filter: TimelineFieldFilter) => TimelineFieldFilter
): TimelineFilterGroup[] {
  return groups.map((group) => {
    if (!group.filters.some((filter) => filter.slotId === slotId)) {
      return group;
    }

    return createTimelineFilterGroup(
      group.groupId,
      group.filters.map((filter) => (filter.slotId === slotId ? mapFilter(filter) : filter))
    );
  });
}
