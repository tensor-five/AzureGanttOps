import React from "react";

import {
  DEFAULT_TIMELINE_SORT_PREFERENCE,
  hydrateTimelineSortPreference,
  loadLastTimelineSortPreference,
  saveTimelineSortPreference,
  type TimelineSortDirection,
  type TimelineSortField,
  type TimelineSortPreference
} from "./timeline-sort-preference.js";

type UseTimelineSortingResult = {
  sortSettingsOpen: boolean;
  setSortSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  timelineSortPreference: TimelineSortPreference;
  selectPrimarySortField: (field: TimelineSortField) => void;
  selectSecondarySortField: (field: TimelineSortField | null) => void;
  togglePrimarySortDirection: () => void;
  toggleSecondarySortDirection: () => void;
};

export function useTimelineSorting(queryId?: string | null): UseTimelineSortingResult {
  const [sortSettingsOpen, setSortSettingsOpen] = React.useState(false);
  const [timelineSortPreference, setTimelineSortPreference] = React.useState<TimelineSortPreference>(
    () => loadLastTimelineSortPreference(queryId) ?? DEFAULT_TIMELINE_SORT_PREFERENCE
  );

  React.useEffect(() => {
    hydrateTimelineSortPreference((preference) => {
      setTimelineSortPreference(preference);
    }, queryId);
  }, [queryId]);

  const setAndPersist = React.useCallback((preference: TimelineSortPreference) => {
    setTimelineSortPreference(preference);
    saveTimelineSortPreference(preference, queryId);
  }, [queryId]);

  const selectPrimarySortField = React.useCallback(
    (field: TimelineSortField) => {
      setAndPersist({
        primary: field,
        primaryDirection: timelineSortPreference.primaryDirection,
        secondary: field === "startDate" ? null : "startDate",
        secondaryDirection: timelineSortPreference.secondaryDirection
      });
    },
    [setAndPersist, timelineSortPreference.primaryDirection, timelineSortPreference.secondaryDirection]
  );

  const selectSecondarySortField = React.useCallback(
    (field: TimelineSortField | null) => {
      setAndPersist({
        primary: timelineSortPreference.primary,
        primaryDirection: timelineSortPreference.primaryDirection,
        secondary: field,
        secondaryDirection: timelineSortPreference.secondaryDirection
      });
    },
    [setAndPersist, timelineSortPreference.primary, timelineSortPreference.primaryDirection, timelineSortPreference.secondaryDirection]
  );

  const toggleSortDirection = React.useCallback(
    (key: "primaryDirection" | "secondaryDirection") => {
      const nextDirection: TimelineSortDirection = timelineSortPreference[key] === "asc" ? "desc" : "asc";
      setAndPersist({
        ...timelineSortPreference,
        [key]: nextDirection
      });
    },
    [setAndPersist, timelineSortPreference]
  );

  return {
    sortSettingsOpen,
    setSortSettingsOpen,
    timelineSortPreference,
    selectPrimarySortField,
    selectSecondarySortField,
    togglePrimarySortDirection: () => toggleSortDirection("primaryDirection"),
    toggleSecondarySortDirection: () => toggleSortDirection("secondaryDirection")
  };
}
