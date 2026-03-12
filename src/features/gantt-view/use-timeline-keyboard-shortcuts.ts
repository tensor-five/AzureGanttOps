import React from "react";

type SelectedDependency = {
  predecessorWorkItemId: number;
  successorWorkItemId: number;
  dependencyType: "FS";
};

type UseTimelineKeyboardShortcutsParams = {
  isRefreshing?: boolean;
  onRemoveDependency?: (input: { predecessorWorkItemId: number; successorWorkItemId: number }) => Promise<void>;
  onRetryRefresh?: () => void;
  onToggleTimelineFilters: () => void;
  onToggleSortSettings: () => void;
  onToggleLabelSettings: () => void;
  onRotateDependencyMode: () => void;
  onSelectMonthZoom: () => void;
  onSelectWeekZoom: () => void;
  selectedDependency: SelectedDependency | null;
  setSelectedDependency: React.Dispatch<React.SetStateAction<SelectedDependency | null>>;
  setSpacePanPressed: React.Dispatch<React.SetStateAction<boolean>>;
  setAdoptScheduleError: React.Dispatch<React.SetStateAction<string | null>>;
  spacePanPressedRef: React.MutableRefObject<boolean>;
};

export function useTimelineKeyboardShortcuts(params: UseTimelineKeyboardShortcutsParams): void {
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.key === " ") {
        params.spacePanPressedRef.current = true;
        params.setSpacePanPressed(true);
        event.preventDefault();
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && params.selectedDependency && params.onRemoveDependency) {
        event.preventDefault();
        void params
          .onRemoveDependency({
            predecessorWorkItemId: params.selectedDependency.predecessorWorkItemId,
            successorWorkItemId: params.selectedDependency.successorWorkItemId
          })
          .catch((error) => {
            const message = error instanceof Error ? error.message : "Unknown error";
            params.setAdoptScheduleError(message);
          });
        params.setSelectedDependency(null);
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "f") {
        params.onToggleTimelineFilters();
        event.preventDefault();
        return;
      }

      if (key === "s") {
        params.onToggleSortSettings();
        event.preventDefault();
        return;
      }

      if (key === "l") {
        params.onToggleLabelSettings();
        event.preventDefault();
        return;
      }

      if (key === "d") {
        params.onRotateDependencyMode();
        event.preventDefault();
        return;
      }

      if (key === "m") {
        params.onSelectMonthZoom();
        event.preventDefault();
        return;
      }

      if (key === "w") {
        params.onSelectWeekZoom();
        event.preventDefault();
        return;
      }

      if (key !== "r" || params.isRefreshing === true) {
        return;
      }

      params.onRetryRefresh?.();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key !== " ") {
        return;
      }

      params.spacePanPressedRef.current = false;
      params.setSpacePanPressed(false);
    };

    const onWindowBlur = () => {
      params.spacePanPressedRef.current = false;
      params.setSpacePanPressed(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onWindowBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onWindowBlur);
    };
  }, [
    params.isRefreshing,
    params.onRemoveDependency,
    params.onRotateDependencyMode,
    params.onRetryRefresh,
    params.onSelectMonthZoom,
    params.onSelectWeekZoom,
    params.onToggleLabelSettings,
    params.onToggleSortSettings,
    params.onToggleTimelineFilters,
    params.selectedDependency,
    params.setAdoptScheduleError,
    params.setSelectedDependency,
    params.setSpacePanPressed,
    params.spacePanPressedRef
  ]);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") {
    return true;
  }

  return target.isContentEditable || Boolean(target.closest("[contenteditable='true']"));
}
