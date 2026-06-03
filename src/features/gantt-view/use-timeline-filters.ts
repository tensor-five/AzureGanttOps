import React from "react";

import {
  createInitialTimelineFilterGroups,
  type TimelineFieldFilter,
  type TimelineFilterGroup
} from "./timeline-filter-model.js";
import {
  createTimelineFilterGroupsFromFilters,
  flattenTimelineFilterGroups,
  resolveNextTimelineFilterGroupId
} from "./timeline-filter-groups.js";

export type { TimelineFieldFilter, TimelineFilterGroup } from "./timeline-filter-model.js";

export type OpenFilterDropdownState =
  | {
      slotId: number;
      kind: "field";
    }
  | {
      slotId: number;
      kind: "value";
    }
  | null;

type TimelineFilterState = {
  filters?: TimelineFieldFilter[];
  groups?: TimelineFilterGroup[];
  nextSlotId: number;
  nextGroupId?: number;
};

export function useTimelineFilters(initialState: TimelineFilterState): {
  timelineFiltersOpen: boolean;
  setTimelineFiltersOpen: React.Dispatch<React.SetStateAction<boolean>>;
  timelineFilterGroups: TimelineFilterGroup[];
  setTimelineFilterGroups: React.Dispatch<React.SetStateAction<TimelineFilterGroup[]>>;
  timelineFieldFilters: TimelineFieldFilter[];
  setTimelineFieldFilters: React.Dispatch<React.SetStateAction<TimelineFieldFilter[]>>;
  nextFilterSlotId: number;
  setNextFilterSlotId: React.Dispatch<React.SetStateAction<number>>;
  nextFilterGroupId: number;
  setNextFilterGroupId: React.Dispatch<React.SetStateAction<number>>;
  openFilterDropdown: OpenFilterDropdownState;
  setOpenFilterDropdown: React.Dispatch<React.SetStateAction<OpenFilterDropdownState>>;
  filterFieldSearchDraft: string;
  setFilterFieldSearchDraft: React.Dispatch<React.SetStateAction<string>>;
  filterValueSearchDraft: string;
  setFilterValueSearchDraft: React.Dispatch<React.SetStateAction<string>>;
} {
  const [resolvedInitialState] = React.useState(() => {
    const groups = resolveInitialTimelineFilterGroups(initialState);
    return {
      groups,
      nextGroupId: initialState.nextGroupId ?? resolveNextTimelineFilterGroupId(groups)
    };
  });
  const [timelineFiltersOpen, setTimelineFiltersOpen] = React.useState(false);
  const [timelineFilterGroups, setTimelineFilterGroups] = React.useState<TimelineFilterGroup[]>(() =>
    resolvedInitialState.groups
  );
  const [nextFilterSlotId, setNextFilterSlotId] = React.useState(() => initialState.nextSlotId);
  const [nextFilterGroupId, setNextFilterGroupId] = React.useState(() => resolvedInitialState.nextGroupId);
  const [openFilterDropdown, setOpenFilterDropdown] = React.useState<OpenFilterDropdownState>(null);
  const [filterFieldSearchDraft, setFilterFieldSearchDraft] = React.useState("");
  const [filterValueSearchDraft, setFilterValueSearchDraft] = React.useState("");
  const timelineFieldFilters = React.useMemo(
    () => flattenTimelineFilterGroups(timelineFilterGroups),
    [timelineFilterGroups]
  );
  const setTimelineFieldFilters = React.useCallback<React.Dispatch<React.SetStateAction<TimelineFieldFilter[]>>>(
    (next) => {
      setTimelineFilterGroups((currentGroups) => {
        const currentFilters = flattenTimelineFilterGroups(currentGroups);
        const nextFilters = typeof next === "function" ? next(currentFilters) : next;
        const nextGroups = createTimelineFilterGroupsFromFilters(nextFilters);
        return nextGroups.length > 0 ? nextGroups : createInitialTimelineFilterGroups();
      });
    },
    []
  );

  return {
    timelineFiltersOpen,
    setTimelineFiltersOpen,
    timelineFilterGroups,
    setTimelineFilterGroups,
    timelineFieldFilters,
    setTimelineFieldFilters,
    nextFilterSlotId,
    setNextFilterSlotId,
    nextFilterGroupId,
    setNextFilterGroupId,
    openFilterDropdown,
    setOpenFilterDropdown,
    filterFieldSearchDraft,
    setFilterFieldSearchDraft,
    filterValueSearchDraft,
    setFilterValueSearchDraft
  };
}

function resolveInitialTimelineFilterGroups(initialState: TimelineFilterState): TimelineFilterGroup[] {
  if (initialState.groups && initialState.groups.length > 0) {
    return initialState.groups;
  }

  if (initialState.filters && initialState.filters.length > 0) {
    return createTimelineFilterGroupsFromFilters(initialState.filters);
  }

  return createInitialTimelineFilterGroups();
}
