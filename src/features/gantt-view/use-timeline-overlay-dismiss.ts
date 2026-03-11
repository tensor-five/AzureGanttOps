import React from "react";

type UseTimelineOverlayDismissParams = {
  colorCodingDropdownOpen: boolean;
  openFilterDropdown: { slotId: number; kind: "field" | "value" } | null;
  labelSettingsOpen: boolean;
  colorCodingControlRef: React.RefObject<HTMLElement | null>;
  filterToggleControlRef: React.RefObject<HTMLElement | null>;
  filterPanelRef: React.RefObject<HTMLElement | null>;
  labelToggleControlRef: React.RefObject<HTMLElement | null>;
  labelPanelRef: React.RefObject<HTMLElement | null>;
  onCloseColorCodingDropdown: () => void;
  onCloseFilterDropdown: () => void;
  onCloseLabelSettings: () => void;
};

export function useTimelineOverlayDismiss(params: UseTimelineOverlayDismissParams): void {
  React.useEffect(() => {
    if (!params.colorCodingDropdownOpen && !params.openFilterDropdown && !params.labelSettingsOpen) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }

      const control = params.colorCodingControlRef.current;
      if (control && control.contains(target)) {
        return;
      }

      const filterToggleControl = params.filterToggleControlRef.current;
      if (filterToggleControl && filterToggleControl.contains(target)) {
        return;
      }

      const filterPanel = params.filterPanelRef.current;
      if (filterPanel && filterPanel.contains(target)) {
        return;
      }

      const labelControl = params.labelToggleControlRef.current;
      if (labelControl && labelControl.contains(target)) {
        return;
      }

      const labelPanel = params.labelPanelRef.current;
      if (labelPanel && labelPanel.contains(target)) {
        return;
      }

      params.onCloseColorCodingDropdown();
      params.onCloseFilterDropdown();
      params.onCloseLabelSettings();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      params.onCloseColorCodingDropdown();
      params.onCloseFilterDropdown();
      params.onCloseLabelSettings();
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    params.colorCodingControlRef,
    params.colorCodingDropdownOpen,
    params.filterPanelRef,
    params.filterToggleControlRef,
    params.labelPanelRef,
    params.labelSettingsOpen,
    params.labelToggleControlRef,
    params.onCloseColorCodingDropdown,
    params.onCloseFilterDropdown,
    params.onCloseLabelSettings,
    params.openFilterDropdown
  ]);
}
