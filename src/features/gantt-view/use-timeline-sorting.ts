import React from "react";

import {
  DEFAULT_TIMELINE_SORT_PREFERENCE,
  hydrateTimelineSortPreference,
  loadLastTimelineSortPreference,
  saveTimelineSortPreference,
  type TimelineSortField,
  type TimelineSortPreference
} from "./timeline-sort-preference.js";

type UseTimelineSortingResult = {
  sortSettingsOpen: boolean;
  setSortSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  timelineSortPreference: TimelineSortPreference;
  selectPrimarySortField: (field: TimelineSortField) => void;
  selectSecondarySortField: (field: TimelineSortField | null) => void;
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
        secondary: field === "startDate" ? null : "startDate"
      });
    },
    [setAndPersist]
  );

  const selectSecondarySortField = React.useCallback(
    (field: TimelineSortField | null) => {
      setAndPersist({
        primary: timelineSortPreference.primary,
        secondary: field
      });
    },
    [setAndPersist, timelineSortPreference.primary]
  );

  return {
    sortSettingsOpen,
    setSortSettingsOpen,
    timelineSortPreference,
    selectPrimarySortField,
    selectSecondarySortField
  };
}
