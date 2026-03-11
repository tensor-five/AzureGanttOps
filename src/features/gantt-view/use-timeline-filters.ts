import React from "react";

export type TimelineFieldFilter = {
  slotId: number;
  fieldRef: string | null;
  selectedValueKeys: string[];
};

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
  filters: TimelineFieldFilter[];
  nextSlotId: number;
};

export function useTimelineFilters(initialState: TimelineFilterState): {
  timelineFiltersOpen: boolean;
  setTimelineFiltersOpen: React.Dispatch<React.SetStateAction<boolean>>;
  timelineFieldFilters: TimelineFieldFilter[];
  setTimelineFieldFilters: React.Dispatch<React.SetStateAction<TimelineFieldFilter[]>>;
  nextFilterSlotId: number;
  setNextFilterSlotId: React.Dispatch<React.SetStateAction<number>>;
  openFilterDropdown: OpenFilterDropdownState;
  setOpenFilterDropdown: React.Dispatch<React.SetStateAction<OpenFilterDropdownState>>;
  filterFieldSearchDraft: string;
  setFilterFieldSearchDraft: React.Dispatch<React.SetStateAction<string>>;
  filterValueSearchDraft: string;
  setFilterValueSearchDraft: React.Dispatch<React.SetStateAction<string>>;
} {
  const [timelineFiltersOpen, setTimelineFiltersOpen] = React.useState(false);
  const [timelineFieldFilters, setTimelineFieldFilters] = React.useState<TimelineFieldFilter[]>(
    () => initialState.filters
  );
  const [nextFilterSlotId, setNextFilterSlotId] = React.useState(() => initialState.nextSlotId);
  const [openFilterDropdown, setOpenFilterDropdown] = React.useState<OpenFilterDropdownState>(null);
  const [filterFieldSearchDraft, setFilterFieldSearchDraft] = React.useState("");
  const [filterValueSearchDraft, setFilterValueSearchDraft] = React.useState("");

  return {
    timelineFiltersOpen,
    setTimelineFiltersOpen,
    timelineFieldFilters,
    setTimelineFieldFilters,
    nextFilterSlotId,
    setNextFilterSlotId,
    openFilterDropdown,
    setOpenFilterDropdown,
    filterFieldSearchDraft,
    setFilterFieldSearchDraft,
    filterValueSearchDraft,
    setFilterValueSearchDraft
  };
}
