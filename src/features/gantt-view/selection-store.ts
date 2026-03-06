export type TimelineSelectableItem = {
  workItemId: number;
};

export type TimelineSelectionStore = {
  select: (workItemId: number | null) => void;
  getSelectedWorkItemId: () => number | null;
  reconcile: (items: ReadonlyArray<TimelineSelectableItem>) => number | null;
  clear: () => void;
};

export function createTimelineSelectionStore(initialSelectedWorkItemId: number | null = null): TimelineSelectionStore {
  let selectedWorkItemId = initialSelectedWorkItemId;

  return {
    select: (workItemId) => {
      selectedWorkItemId = workItemId;
    },
    getSelectedWorkItemId: () => selectedWorkItemId,
    reconcile: (items) => {
      if (selectedWorkItemId === null) {
        return null;
      }

      const stillExists = items.some((item) => item.workItemId === selectedWorkItemId);
      if (!stillExists) {
        selectedWorkItemId = null;
      }

      return selectedWorkItemId;
    },
    clear: () => {
      selectedWorkItemId = null;
    }
  };
}
