import React from "react";

import {
  normalizeAvailableWorkItemTypes,
  resolveDefaultChildWorkItemType,
  type WorkItemTypeOption
} from "../../domain/work-items/child-work-item-type.js";

export type ChildWorkItemTypeLoadState =
  | { status: "idle"; options: WorkItemTypeOption[]; error: null }
  | { status: "loading"; options: WorkItemTypeOption[]; error: null }
  | { status: "loaded"; options: WorkItemTypeOption[]; error: null }
  | { status: "error"; options: WorkItemTypeOption[]; error: string };

export function useChildWorkItemTypeMenu(input: {
  menuKey: number | null;
  parentWorkItemType: string | null | undefined;
  onFetchWorkItemTypes?: () => Promise<WorkItemTypeOption[]>;
}): {
  isOpen: boolean;
  loadState: ChildWorkItemTypeLoadState;
  options: WorkItemTypeOption[];
  activeIndex: number;
  activeWorkItemType: string | null;
  openMenu: () => void;
  toggleMenu: () => void;
  closeMenu: () => void;
  setActiveByIndex: (index: number) => void;
  moveActive: (delta: number) => void;
} {
  const [isOpen, setIsOpen] = React.useState(false);
  const [loadState, setLoadState] = React.useState<ChildWorkItemTypeLoadState>({
    status: "idle",
    options: [],
    error: null
  });
  const [activeWorkItemType, setActiveWorkItemType] = React.useState<string | null>(null);
  const fetchWorkItemTypesRef = React.useRef(input.onFetchWorkItemTypes);

  React.useEffect(() => {
    fetchWorkItemTypesRef.current = input.onFetchWorkItemTypes;
  }, [input.onFetchWorkItemTypes]);

  React.useEffect(() => {
    setIsOpen(false);
    setLoadState({
      status: "idle",
      options: [],
      error: null
    });
    setActiveWorkItemType(null);
  }, [input.menuKey]);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    const fetchWorkItemTypes = fetchWorkItemTypesRef.current;
    if (!fetchWorkItemTypes) {
      setLoadState({
        status: "loaded",
        options: [],
        error: null
      });
      setActiveWorkItemType(null);
      return;
    }

    let cancelled = false;
    setLoadState((current) => ({
      status: "loading",
      options: current.options,
      error: null
    }));

    void fetchWorkItemTypes()
      .then((options) => {
        if (cancelled) {
          return;
        }

        const normalizedOptions = normalizeAvailableWorkItemTypes(options).map((name) => ({ name }));
        setLoadState({
          status: "loaded",
          options: normalizedOptions,
          error: null
        });
        setActiveWorkItemType(resolveDefaultChildWorkItemType(input.parentWorkItemType, normalizedOptions));
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setLoadState({
          status: "error",
          options: [],
          error: error instanceof Error ? error.message : "Work Item Types konnten nicht geladen werden."
        });
        setActiveWorkItemType(null);
      });

    return () => {
      cancelled = true;
    };
  }, [input.parentWorkItemType, isOpen]);

  const options = loadState.status === "loaded" ? loadState.options : [];
  const activeIndex = options.findIndex((option) => option.name === activeWorkItemType);

  const setActiveByIndex = React.useCallback(
    (index: number) => {
      if (options.length === 0) {
        setActiveWorkItemType(null);
        return;
      }

      const normalizedIndex = Math.max(0, Math.min(options.length - 1, index));
      setActiveWorkItemType(options[normalizedIndex]?.name ?? null);
    },
    [options]
  );

  const moveActive = React.useCallback(
    (delta: number) => {
      if (options.length === 0) {
        return;
      }

      const currentIndex = activeIndex >= 0 ? activeIndex : 0;
      const nextIndex = (currentIndex + delta + options.length) % options.length;
      setActiveByIndex(nextIndex);
    },
    [activeIndex, options.length, setActiveByIndex]
  );

  return {
    isOpen,
    loadState,
    options,
    activeIndex,
    activeWorkItemType,
    openMenu: () => setIsOpen(true),
    toggleMenu: () => setIsOpen((current) => !current),
    closeMenu: () => setIsOpen(false),
    setActiveByIndex,
    moveActive
  };
}
