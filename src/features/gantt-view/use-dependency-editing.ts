import React from "react";

export type ActiveDependencyDrag = {
  pointerId: number;
  sourceWorkItemId: number;
  pointerX: number;
  pointerY: number;
  hoveredTargetWorkItemId: number | null;
};

export type DependencyViewMode = "edit" | "show" | "none" | "violations";

export type SelectedDependency = {
  predecessorWorkItemId: number;
  successorWorkItemId: number;
  dependencyType: "FS";
};

type DependencyViewModeOption = {
  value: DependencyViewMode;
  label: string;
};

export const DEPENDENCY_VIEW_MODE_OPTIONS: readonly DependencyViewModeOption[] = [
  { value: "show", label: "Show all" },
  { value: "edit", label: "Edit links" },
  { value: "violations", label: "Show conflicts only" },
  { value: "none", label: "Hide all" }
];

export function useDependencyEditing(): {
  activeDependencyDrag: ActiveDependencyDrag | null;
  setActiveDependencyDrag: React.Dispatch<React.SetStateAction<ActiveDependencyDrag | null>>;
  dependencyViewMode: DependencyViewMode;
  setDependencyViewMode: React.Dispatch<React.SetStateAction<DependencyViewMode>>;
  selectedDependency: SelectedDependency | null;
  setSelectedDependency: React.Dispatch<React.SetStateAction<SelectedDependency | null>>;
} {
  const [activeDependencyDrag, setActiveDependencyDrag] = React.useState<ActiveDependencyDrag | null>(null);
  const [dependencyViewMode, setDependencyViewMode] = React.useState<DependencyViewMode>("show");
  const [selectedDependency, setSelectedDependency] = React.useState<SelectedDependency | null>(null);

  return {
    activeDependencyDrag,
    setActiveDependencyDrag,
    dependencyViewMode,
    setDependencyViewMode,
    selectedDependency,
    setSelectedDependency
  };
}
