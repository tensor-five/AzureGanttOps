import React from "react";

import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";
import type { TimelineDensity } from "./timeline-density-preference.js";
import {
  DEFAULT_OVERDUE_EXCLUDED_STATE_CODES,
  hydrateTimelineColorCodingPreference,
  loadLastTimelineColorCoding,
  loadTimelineFieldColorCodingConfig,
  saveLastTimelineColorCoding,
  saveTimelineFieldColorCodingConfig,
  type TimelineFieldColorCodingConfig,
  type TimelineColorCoding
} from "./timeline-color-coding-preference.js";
import {
  buildTimelineDetailsLines,
  TimelineDetailsPanel,
  type TimelineDetailsPanelProps
} from "./timeline-details-panel.js";
import {
  hydrateTimelineViewportPreference,
  loadLastTimelineViewportPreference,
  saveTimelineViewportPreference,
  type TimelineViewportPreference
} from "./timeline-viewport-preference.js";
import {
  DEFAULT_TIMELINE_LABEL_FIELDS,
  hydrateTimelineLabelFieldsPreference,
  loadLastTimelineLabelFields,
  saveTimelineLabelFields
} from "./timeline-label-fields-preference.js";
import {
  DEFAULT_TIMELINE_SIDEBAR_FIELDS,
  hydrateTimelineSidebarFieldsPreference,
  loadLastTimelineSidebarFields,
  saveTimelineSidebarFields
} from "./timeline-sidebar-fields-preference.js";
import {
  hydrateTimelineSidebarWidthPreference,
  loadLastTimelineSidebarWidthPx,
  saveTimelineSidebarWidthPx
} from "./timeline-sidebar-width-preference.js";
import {
  hydrateTimelineSidebarRowJustifyPreference,
  loadLastTimelineSidebarRowJustify,
  saveTimelineSidebarRowJustify,
  type TimelineSidebarRowJustify
} from "./timeline-sidebar-row-justify-preference.js";
import {
  hydrateTimelineDetailsWidthPreference,
  loadLastTimelineDetailsWidthPx,
  saveTimelineDetailsWidthPx
} from "./timeline-details-width-preference.js";
import { createTimelineSelectionStore, type TimelineSelectionStore } from "./selection-store.js";
import { TimelineMainSplitter } from "./timeline-main-splitter.js";
import {
  DEPENDENCY_VIEW_MODE_OPTIONS,
  useDependencyEditing,
  type ActiveDependencyDrag,
  type DependencyViewMode,
  type SelectedDependency
} from "./use-dependency-editing.js";
import {
  useScheduleDragging,
  type ActiveScheduleDrag,
  type ActiveUnschedulableDrag,
  type DragMode,
  type UnscheduledDropPreview
} from "./use-schedule-dragging.js";
import {
  useTimelineFilters,
  type OpenFilterDropdownState,
  type TimelineFieldFilter
} from "./use-timeline-filters.js";
import { useTimelineOverlayDismiss } from "./use-timeline-overlay-dismiss.js";
import { useTimelineKeyboardShortcuts } from "./use-timeline-keyboard-shortcuts.js";
import { TimelineSortControl } from "./timeline-sort-control.js";
import { applyTimelineSorting } from "./timeline-sorting.js";
import { useTimelineSorting } from "./use-timeline-sorting.js";
import { useTreeExpandCollapse, applyTreeVisibility } from "./use-tree-expand-collapse.js";
import { useReparentDragging } from "./use-reparent-dragging.js";
import { useTimelineResizing } from "./use-timeline-resizing.js";
import { useDragAutoScroll } from "./use-drag-auto-scroll.js";
import { TimelinePaneActionsToolbar } from "./timeline-pane-actions-toolbar.js";
import { TimelineFilterPanel } from "./timeline-filter-panel.js";
import { TimelineColorCodingPanel } from "./timeline-color-coding-panel.js";
import { extractFilterMatchKeys, extractFilterValueTokens } from "./timeline-field-filtering.js";
import type { WorkItemSyncState } from "../../shared/ui-state/work-item-sync-state.js";

const MAX_PRIMARY_TITLE_LENGTH = 42;

export type TimelinePaneProps = {
  timeline: TimelineReadModel | null;
  activeQueryId?: string | null;
  showDependencies: boolean;
  isRefreshing?: boolean;
  workItemSyncState?: WorkItemSyncState;
  workItemSyncError?: string | null;
  liveSyncEnabled?: boolean;
  pendingWorkItemSyncCount?: number;
  organization?: string;
  project?: string;
  density?: TimelineDensity;
  selectionStore?: TimelineSelectionStore;
  onAdoptUnschedulableSchedule?: (input: {
    targetWorkItemId: number;
    startDate: string;
    endDate: string;
  }) => Promise<void>;
  onCreateDependency?: (input: { predecessorWorkItemId: number; successorWorkItemId: number }) => Promise<void>;
  onRemoveDependency?: (input: { predecessorWorkItemId: number; successorWorkItemId: number }) => Promise<void>;
  onUpdateWorkItemSchedule?: (input: {
    targetWorkItemId: number;
    startDate: string;
    endDate: string;
  }) => Promise<void>;
  onUpdateSelectedWorkItemDetails?: (input: {
    targetWorkItemId: number;
    title: string;
    descriptionHtml: string;
    state: string;
    stateColor: string | null;
  }) => Promise<void>;
  onReparentWorkItem?: (input: { targetWorkItemId: number; newParentId: number | null }) => Promise<void>;
  onFetchWorkItemStateOptions?: (input: { targetWorkItemId: number }) => Promise<Array<{ name: string; color: string | null }>>;
  onDensityChange?: (density: TimelineDensity) => void;
  onRetryRefresh?: () => void;
  onSetLiveSyncEnabled?: (enabled: boolean) => void;
  onPushPendingWorkItemChanges?: () => void;
  onClearPendingWorkItemChanges?: () => void;
  onDetailsDirtyChange?: (dirty: boolean) => void;
};

type ActivePanDrag = {
  pointerId: number;
  originClientX: number;
  originClientY: number;
  originScrollLeft: number;
  originScrollTop: number;
};

type TimelineZoomLevel = "week" | "month" | "quarter" | "year";

type TimelineLabelFieldOption = {
  fieldRef: string;
  label: string;
  subtitle: string;
  searchText: string;
};

type TimelineViewportState = {
  dayWidthPx: number;
  setDayWidthPx: React.Dispatch<React.SetStateAction<number>>;
  activePanDrag: ActivePanDrag | null;
  setActivePanDrag: React.Dispatch<React.SetStateAction<ActivePanDrag | null>>;
  spacePanPressed: boolean;
  setSpacePanPressed: React.Dispatch<React.SetStateAction<boolean>>;
  chartViewportWidthPx: number;
  setChartViewportWidthPx: React.Dispatch<React.SetStateAction<number>>;
  chartViewportHeightPx: number;
  setChartViewportHeightPx: React.Dispatch<React.SetStateAction<number>>;
  chartScrollRef: React.RefObject<HTMLDivElement | null>;
  chartSvgRef: React.RefObject<SVGSVGElement | null>;
  mainLaneRef: React.RefObject<HTMLDivElement | null>;
  zoomAnchorRef: React.RefObject<{ dayOffset: number; pointerOffsetX: number } | null>;
  wheelZoomFrameRef: React.RefObject<number | null>;
  pendingWheelDayWidthRef: React.RefObject<number | null>;
  liveDayWidthRef: React.RefObject<number>;
  committedDayWidthRef: React.RefObject<number>;
  zoomCommitTimerRef: React.RefObject<number | null>;
  pendingFitRangeRef: React.RefObject<{ start: Date; end: Date } | null>;
  pendingViewportRestoreRef: React.RefObject<TimelineViewportPreference | null>;
  viewportPersistDebounceRef: React.RefObject<number | null>;
  spacePanPressedRef: React.RefObject<boolean>;
  initialViewportAppliedRef: React.RefObject<boolean>;
  zoomLevel: TimelineZoomLevel;
};

function useTimelineViewport(initialViewportPreference: TimelineViewportPreference | null): TimelineViewportState {
  const [dayWidthPx, setDayWidthPx] = React.useState<number>(() => {
    if (!initialViewportPreference) {
      return DAY_WIDTH_WEEK_PX;
    }

    return clamp(quantizeDayWidth(initialViewportPreference.dayWidthPx), DAY_WIDTH_MIN_PX, DAY_WIDTH_MAX_PX);
  });
  const [activePanDrag, setActivePanDrag] = React.useState<ActivePanDrag | null>(null);
  const [spacePanPressed, setSpacePanPressed] = React.useState(false);
  const [chartViewportWidthPx, setChartViewportWidthPx] = React.useState<number>(0);
  const [chartViewportHeightPx, setChartViewportHeightPx] = React.useState<number>(0);
  const chartScrollRef = React.useRef<HTMLDivElement | null>(null);
  const chartSvgRef = React.useRef<SVGSVGElement | null>(null);
  const mainLaneRef = React.useRef<HTMLDivElement | null>(null);
  const zoomAnchorRef = React.useRef<{ dayOffset: number; pointerOffsetX: number } | null>(null);
  const wheelZoomFrameRef = React.useRef<number | null>(null);
  const pendingWheelDayWidthRef = React.useRef<number | null>(null);
  const liveDayWidthRef = React.useRef(dayWidthPx);
  const committedDayWidthRef = React.useRef(dayWidthPx);
  const zoomCommitTimerRef = React.useRef<number | null>(null);
  const pendingFitRangeRef = React.useRef<{ start: Date; end: Date } | null>(null);
  const pendingViewportRestoreRef = React.useRef<TimelineViewportPreference | null>(initialViewportPreference);
  const viewportPersistDebounceRef = React.useRef<number | null>(null);
  const spacePanPressedRef = React.useRef(false);
  const initialViewportAppliedRef = React.useRef(false);
  const lastZoomLevelRef = React.useRef<TimelineZoomLevel>(
    resolveZoomLevelWithoutHysteresis(initialViewportPreference?.dayWidthPx ?? DAY_WIDTH_WEEK_PX)
  );

  const zoomLevel = React.useMemo(() => {
    const prev = lastZoomLevelRef.current;
    const next = resolveZoomLevelWithHysteresis(dayWidthPx, prev);
    lastZoomLevelRef.current = next;
    return next;
  }, [dayWidthPx]);

  return {
    dayWidthPx,
    setDayWidthPx,
    activePanDrag,
    setActivePanDrag,
    spacePanPressed,
    setSpacePanPressed,
    chartViewportWidthPx,
    setChartViewportWidthPx,
    chartViewportHeightPx,
    setChartViewportHeightPx,
    chartScrollRef,
    chartSvgRef,
    mainLaneRef,
    zoomAnchorRef,
    wheelZoomFrameRef,
    pendingWheelDayWidthRef,
    liveDayWidthRef,
    committedDayWidthRef,
    zoomCommitTimerRef,
    pendingFitRangeRef,
    pendingViewportRestoreRef,
    viewportPersistDebounceRef,
    spacePanPressedRef,
    initialViewportAppliedRef,
    zoomLevel
  };
}

type TimelineColorCodingState = {
  colorCoding: TimelineColorCoding;
  setColorCoding: React.Dispatch<React.SetStateAction<TimelineColorCoding>>;
  fieldColorCoding: TimelineFieldColorCodingConfig;
  setFieldColorCoding: React.Dispatch<React.SetStateAction<TimelineFieldColorCodingConfig>>;
  lastSelectedFieldRef: string | null;
  setLastSelectedFieldRef: React.Dispatch<React.SetStateAction<string | null>>;
  colorSettingsOpen: boolean;
  setColorSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  colorCodingDropdownOpen: boolean;
  setColorCodingDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  colorCodingSearchDraft: string;
  setColorCodingSearchDraft: React.Dispatch<React.SetStateAction<string>>;
};

function useTimelineColorCoding(queryId?: string | null): TimelineColorCodingState {
  const [colorCoding, setColorCoding] = React.useState<TimelineColorCoding>(() => loadLastTimelineColorCoding(queryId) ?? "none");
  const [fieldColorCoding, setFieldColorCoding] = React.useState<TimelineFieldColorCodingConfig>(() =>
    loadTimelineFieldColorCodingConfig(queryId)
  );
  const [lastSelectedFieldRef, setLastSelectedFieldRef] = React.useState<string | null>(() =>
    loadTimelineFieldColorCodingConfig(queryId).fieldRef
  );
  const [colorSettingsOpen, setColorSettingsOpen] = React.useState(false);
  const [colorCodingDropdownOpen, setColorCodingDropdownOpen] = React.useState(false);
  const [colorCodingSearchDraft, setColorCodingSearchDraft] = React.useState("");

  return {
    colorCoding,
    setColorCoding,
    fieldColorCoding,
    setFieldColorCoding,
    lastSelectedFieldRef,
    setLastSelectedFieldRef,
    colorSettingsOpen,
    setColorSettingsOpen,
    colorCodingDropdownOpen,
    setColorCodingDropdownOpen,
    colorCodingSearchDraft,
    setColorCodingSearchDraft
  };
}

export function TimelinePane(props: TimelinePaneProps): React.ReactElement {
  const initialTimelineFilterState = React.useMemo(() => resolveInitialTimelineFilterState(), []);
  const activeQueryId = props.activeQueryId ?? null;
  const initialViewportPreference = React.useMemo(() => loadLastTimelineViewportPreference(activeQueryId), [activeQueryId]);
  const scheduleDragging = useScheduleDragging();
  const dependencyEditing = useDependencyEditing();
  const timelineFilters = useTimelineFilters(initialTimelineFilterState);
  const timelineSorting = useTimelineSorting(activeQueryId);
  const internalSelectionStoreRef = React.useRef<TimelineSelectionStore | null>(null);
  if (internalSelectionStoreRef.current === null) {
    internalSelectionStoreRef.current = createTimelineSelectionStore();
  }

  const selectionStore = props.selectionStore ?? internalSelectionStoreRef.current;
  const {
    adoptedSchedulesByWorkItemId,
    setAdoptedSchedulesByWorkItemId,
    editedBarSchedulesByWorkItemId,
    setEditedBarSchedulesByWorkItemId,
    adoptScheduleError,
    setAdoptScheduleError,
    activeScheduleDrag,
    setActiveScheduleDrag,
    activeUnschedulableDrag,
    setActiveUnschedulableDrag,
    unscheduledDropPreview,
    setUnscheduledDropPreview
  } = scheduleDragging;
  const {
    activeDependencyDrag,
    setActiveDependencyDrag,
    dependencyViewMode,
    setDependencyViewMode,
    selectedDependency,
    setSelectedDependency
  } = dependencyEditing;
  const {
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
  } = timelineFilters;
  const {
    sortSettingsOpen,
    setSortSettingsOpen,
    timelineSortPreference,
    selectPrimarySortField,
    selectSecondarySortField,
    togglePrimarySortDirection,
    toggleSecondarySortDirection
  } = timelineSorting;
  const sortedBaseTimeline = React.useMemo(
    () => applyTimelineSorting(props.timeline, timelineSortPreference),
    [props.timeline, timelineSortPreference]
  );
  const effectiveTimeline = React.useMemo(() => {
    const withAdopted = applyAdoptedSchedules(sortedBaseTimeline, adoptedSchedulesByWorkItemId);
    return applyEditedBarSchedules(withAdopted, editedBarSchedulesByWorkItemId);
  }, [sortedBaseTimeline, adoptedSchedulesByWorkItemId, editedBarSchedulesByWorkItemId]);
  const [selectedWorkItemId, setSelectedWorkItemId] = React.useState<number | null>(() =>
    selectionStore.getSelectedWorkItemId()
  );
  const [hoveredDependencyKey, setHoveredDependencyKey] = React.useState<string | null>(null);
  const {
    dayWidthPx,
    setDayWidthPx,
    activePanDrag,
    setActivePanDrag,
    spacePanPressed,
    setSpacePanPressed,
    chartViewportWidthPx,
    setChartViewportWidthPx,
    chartViewportHeightPx,
    setChartViewportHeightPx,
    chartScrollRef,
    chartSvgRef,
    mainLaneRef,
    zoomAnchorRef,
    wheelZoomFrameRef,
    pendingWheelDayWidthRef,
    liveDayWidthRef,
    committedDayWidthRef,
    zoomCommitTimerRef,
    pendingFitRangeRef,
    pendingViewportRestoreRef,
    viewportPersistDebounceRef,
    spacePanPressedRef,
    initialViewportAppliedRef,
    zoomLevel
  } = useTimelineViewport(initialViewportPreference);
  const autoScrollCallbackRef = React.useRef<() => void>(() => {});
  const stableAutoScrollCallback = React.useCallback(() => autoScrollCallbackRef.current(), []);
  const updateDragAutoScroll = useDragAutoScroll(chartScrollRef, activeScheduleDrag !== null, stableAutoScrollCallback);
  const [detailsWidthPx, setDetailsWidthPx] = React.useState<number>(() => {
    const preferredWidth = loadLastTimelineDetailsWidthPx(activeQueryId);
    return preferredWidth === null ? DETAILS_PANEL_DEFAULT_WIDTH_PX : preferredWidth;
  });
  const [sidebarWidthPx, setSidebarWidthPx] = React.useState<number>(() => {
    const preferredWidth = loadLastTimelineSidebarWidthPx(activeQueryId);
    return preferredWidth === null ? TIMELINE_SIDEBAR_DEFAULT_WIDTH_PX : preferredWidth;
  });
  const {
    colorCoding,
    setColorCoding,
    fieldColorCoding,
    setFieldColorCoding,
    lastSelectedFieldRef,
    setLastSelectedFieldRef,
    colorSettingsOpen,
    setColorSettingsOpen,
    colorCodingDropdownOpen,
    setColorCodingDropdownOpen,
    colorCodingSearchDraft,
    setColorCodingSearchDraft
  } = useTimelineColorCoding(activeQueryId);
  const [labelSettingsOpen, setLabelSettingsOpen] = React.useState(false);
  const [labelFieldSearchDraft, setLabelFieldSearchDraft] = React.useState("");
  const [sidebarFieldSearchDraft, setSidebarFieldSearchDraft] = React.useState("");
  const [timelineLabelFields, setTimelineLabelFields] = React.useState<string[]>(
    () => loadLastTimelineLabelFields(activeQueryId) ?? [...DEFAULT_TIMELINE_LABEL_FIELDS]
  );
  const [timelineSidebarFields, setTimelineSidebarFields] = React.useState<string[]>(
    () => loadLastTimelineSidebarFields(activeQueryId) ?? [...DEFAULT_TIMELINE_SIDEBAR_FIELDS]
  );
  const [timelineSidebarRowJustify, setTimelineSidebarRowJustify] = React.useState<TimelineSidebarRowJustify>(
    () => loadLastTimelineSidebarRowJustify(activeQueryId) ?? "flex-start"
  );
  const timelineMainGridRef = React.useRef<HTMLDivElement | null>(null);
  const colorCodingControlRef = React.useRef<HTMLDivElement | null>(null);
  const filterToggleControlRef = React.useRef<HTMLDivElement | null>(null);
  const filterPanelRef = React.useRef<HTMLDivElement | null>(null);
  const sortToggleControlRef = React.useRef<HTMLDivElement | null>(null);
  const sortPanelRef = React.useRef<HTMLDivElement | null>(null);
  const labelToggleControlRef = React.useRef<HTMLDivElement | null>(null);
  const labelPanelRef = React.useRef<HTMLDivElement | null>(null);
  const labelMenuSidebarOptionsRef = React.useRef<HTMLDivElement | null>(null);
  const labelMenuBarOptionsRef = React.useRef<HTMLDivElement | null>(null);
  const labelMenuScrollSyncSourceRef = React.useRef<"sidebar" | "bar" | null>(null);
  const barPointerSelectionIntentRef = React.useRef<{ workItemId: number; wasSelected: boolean } | null>(null);
  const suppressNextBarClickRef = React.useRef(false);
  const lastDragClientXRef = React.useRef<number>(0);
  const dependencyMarkerReactId = React.useId();
  const dependencyMarkerId = React.useMemo(
    () => `timeline-dependency-arrowhead-${dependencyMarkerReactId.replace(/:/g, "")}`,
    [dependencyMarkerReactId]
  );
  const dependencyAlertMarkerId = React.useMemo(
    () => `timeline-dependency-arrowhead-alert-${dependencyMarkerReactId.replace(/:/g, "")}`,
    [dependencyMarkerReactId]
  );

  const dependencyMode = dependencyViewMode === "edit";
  const dependencyVisible = props.showDependencies && dependencyViewMode !== "none";
  const canEditSchedule = Boolean(props.onUpdateWorkItemSchedule) && !dependencyMode;
  const timelineResizing = useTimelineResizing({
    timelineMainGridRef,
    detailsWidthPx,
    setDetailsWidthPx,
    sidebarWidthPx,
    setSidebarWidthPx,
    sidebarFieldsCount: timelineSidebarFields.length,
    detailsPanelMinWidthPx: DETAILS_PANEL_MIN_WIDTH_PX,
    detailsPanelContentMinWidthPx: DETAILS_PANEL_CONTENT_MIN_WIDTH_PX,
    timelineSidebarMinWidthPx: TIMELINE_SIDEBAR_MIN_WIDTH_PX,
    timelineSidebarCollapsedWidthPx: TIMELINE_SIDEBAR_COLLAPSED_WIDTH_PX,
    clamp,
    resolveTimelineDetailsMaxWidthPx,
    resolveTimelineSidebarMaxWidthPx,
    persistDetailsWidthPx: (widthPx) => {
      saveTimelineDetailsWidthPx(widthPx, activeQueryId);
    },
    persistSidebarWidthPx: (widthPx) => {
      saveTimelineSidebarWidthPx(widthPx, activeQueryId);
    }
  });
  const {
    isSidebarResizing,
    isDetailsResizing,
    detailsContentHidden,
    sidebarCollapsed,
    effectiveSidebarWidthPx,
    detailsResizeMovedRef,
    sidebarEffectiveWidthLiveRef,
    beginSidebarResize,
    beginDetailsResize,
    toggleDetailsPanelFromSplitter
  } = timelineResizing;

  React.useEffect(() => {
    hydrateTimelineViewportPreference((viewport) => {
      pendingViewportRestoreRef.current = viewport;
      setDayWidthPx(clamp(quantizeDayWidth(viewport.dayWidthPx), DAY_WIDTH_MIN_PX, DAY_WIDTH_MAX_PX));
      initialViewportAppliedRef.current = false;
    }, activeQueryId);
  }, [activeQueryId]);

  React.useEffect(() => {
    hydrateTimelineColorCodingPreference((mode) => {
      setColorCoding(mode);
      const config = loadTimelineFieldColorCodingConfig(activeQueryId);
      setFieldColorCoding(config);
      if (config.fieldRef) {
        setLastSelectedFieldRef(config.fieldRef);
      }
    }, activeQueryId);
  }, [activeQueryId]);

  React.useEffect(() => {
    hydrateTimelineLabelFieldsPreference((fieldRefs) => {
      setTimelineLabelFields(sanitizeTimelineFieldRefList(fieldRefs));
    }, activeQueryId);
  }, [activeQueryId]);

  React.useEffect(() => {
    hydrateTimelineSidebarFieldsPreference((fieldRefs) => {
      setTimelineSidebarFields(sanitizeTimelineFieldRefList(fieldRefs));
    }, activeQueryId);
  }, [activeQueryId]);

  React.useEffect(() => {
    hydrateTimelineSidebarRowJustifyPreference((justify) => {
      setTimelineSidebarRowJustify(justify);
    }, activeQueryId);
  }, [activeQueryId]);

  React.useEffect(() => {
    hydrateTimelineSidebarWidthPreference((widthPx) => {
      setSidebarWidthPx((current) => {
        const next = clamp(widthPx, TIMELINE_SIDEBAR_MIN_WIDTH_PX, TIMELINE_SIDEBAR_MAX_WIDTH_PX);
        return Math.abs(current - next) < 1 ? current : next;
      });
    }, activeQueryId);
  }, [activeQueryId]);

  React.useEffect(() => {
    hydrateTimelineDetailsWidthPreference((widthPx) => {
      setDetailsWidthPx((current) => {
        const maxWidth = resolveTimelineDetailsMaxWidthPx(timelineMainGridRef.current, sidebarEffectiveWidthLiveRef.current);
        const next = clamp(widthPx, DETAILS_PANEL_MIN_WIDTH_PX, maxWidth);
        return Math.abs(current - next) < 1 ? current : next;
      });
    }, activeQueryId);
  }, [activeQueryId, sidebarEffectiveWidthLiveRef]);

  useTimelineOverlayDismiss({
    colorCodingDropdownOpen,
    openFilterDropdown,
    sortSettingsOpen,
    labelSettingsOpen,
    colorCodingControlRef,
    filterToggleControlRef,
    filterPanelRef,
    sortToggleControlRef,
    sortPanelRef,
    labelToggleControlRef,
    labelPanelRef,
    onCloseColorCodingDropdown: () => {
      setColorCodingDropdownOpen(false);
    },
    onCloseFilterDropdown: () => {
      setOpenFilterDropdown(null);
    },
    onCloseSortSettings: () => {
      setSortSettingsOpen(false);
    },
    onCloseLabelSettings: () => {
      setLabelSettingsOpen(false);
    }
  });

  React.useEffect(() => {
    setAdoptedSchedulesByWorkItemId({});
    setEditedBarSchedulesByWorkItemId({});
    setActiveScheduleDrag(null);
    setActivePanDrag(null);
    setActiveUnschedulableDrag(null);
    setActiveDependencyDrag(null);
    setUnscheduledDropPreview(null);
    setSelectedDependency(null);
    initialViewportAppliedRef.current = false;
  }, [props.timeline]);

  React.useEffect(() => {
    if (dependencyViewMode === "none") {
      setSelectedDependency(null);
    }
  }, [dependencyViewMode]);

  React.useEffect(() => {
    syncTimelineFiltersToUrl(timelineFieldFilters);
  }, [timelineFieldFilters]);

  React.useEffect(() => {
    initialViewportAppliedRef.current = false;
    const scrollElement = chartScrollRef.current;
    if (scrollElement) {
      scrollElement.scrollTop = 0;
    }
  }, [timelineFieldFilters]);

  const availableFieldRefs = React.useMemo(() => listAvailableColorCodingFields(effectiveTimeline), [effectiveTimeline]);
  const availableTimelineLabelFieldOptions = React.useMemo(
    () => buildTimelineLabelFieldOptions(availableFieldRefs),
    [availableFieldRefs]
  );
  const filteredTimeline = React.useMemo(
    () => applyTimelineFieldFilters(effectiveTimeline, timelineFieldFilters),
    [effectiveTimeline, timelineFieldFilters]
  );
  const activeTimelineFilters = React.useMemo(
    () => timelineFieldFilters.filter((filter) => isActiveTimelineFieldFilter(filter)),
    [timelineFieldFilters]
  );
  const colorCodingOptions = React.useMemo(
    () => buildColorCodingOptions(availableFieldRefs),
    [availableFieldRefs]
  );
  const filteredColorCodingOptions = React.useMemo(
    () => filterColorCodingOptions(colorCodingOptions, colorCodingSearchDraft),
    [colorCodingOptions, colorCodingSearchDraft]
  );
  const selectedFieldRef = colorCoding === "field" ? (fieldColorCoding.fieldRef ?? lastSelectedFieldRef) : null;
  const selectedFieldValueStats = React.useMemo(
    () => listFieldValueStats(effectiveTimeline, selectedFieldRef),
    [effectiveTimeline, selectedFieldRef]
  );
  const selectedModeValueStats = React.useMemo(
    () => listModeValueStats(effectiveTimeline, colorCoding),
    [effectiveTimeline, colorCoding]
  );
  const treeState = useTreeExpandCollapse(filteredTimeline?.treeLayout ?? null);
  const reparentDrag = useReparentDragging(filteredTimeline?.treeLayout ?? null);
  const isTreeQuery = filteredTimeline?.queryType !== "flat" && filteredTimeline?.treeLayout !== null;
  const visibleTimeline = React.useMemo(
    () => applyTreeVisibility(filteredTimeline, treeState.collapsedIds),
    [filteredTimeline, treeState.collapsedIds]
  );
  const includeUnscheduledDropLane = Boolean(activeUnschedulableDrag && unscheduledDropPreview);
  const colorByWorkItemId = React.useMemo(
    () => buildColorByWorkItemId(effectiveTimeline, colorCoding, fieldColorCoding),
    [effectiveTimeline, colorCoding, fieldColorCoding]
  );
  const chartModel = React.useMemo(
    () =>
      buildVisualChartModel(
        visibleTimeline,
        dayWidthPx,
        zoomLevel,
        colorByWorkItemId,
        chartViewportWidthPx,
        timelineLabelFields,
        includeUnscheduledDropLane,
        treeState.collapsedIds
      ),
    [
      visibleTimeline,
      dayWidthPx,
      zoomLevel,
      colorByWorkItemId,
      chartViewportWidthPx,
      timelineLabelFields,
      includeUnscheduledDropLane,
      treeState.collapsedIds
    ]
  );
  const filteredTimelineLabelFieldOptions = React.useMemo(
    () => filterTimelineLabelFieldOptions(availableTimelineLabelFieldOptions, labelFieldSearchDraft),
    [availableTimelineLabelFieldOptions, labelFieldSearchDraft]
  );
  const filteredTimelineSidebarFieldOptions = React.useMemo(
    () => filterTimelineLabelFieldOptions(availableTimelineLabelFieldOptions, sidebarFieldSearchDraft),
    [availableTimelineLabelFieldOptions, sidebarFieldSearchDraft]
  );

  React.useEffect(() => {
    const selectableItems = [
      ...(visibleTimeline?.bars.map((bar) => ({ workItemId: bar.workItemId })) ?? []),
      ...(visibleTimeline?.unschedulable.map((item) => ({ workItemId: item.workItemId })) ?? [])
    ];
    const reconciled = selectionStore.reconcile(selectableItems);
    setSelectedWorkItemId(reconciled);
  }, [visibleTimeline, selectionStore]);

  const selectWorkItem = React.useCallback(
    (workItemId: number | null) => {
      selectionStore.select(workItemId);
      setSelectedWorkItemId(workItemId);
    },
    [selectionStore]
  );
  const toggleWorkItemSelection = React.useCallback(
    (workItemId: number) => {
      const nextWorkItemId = selectionStore.getSelectedWorkItemId() === workItemId ? null : workItemId;
      selectionStore.select(nextWorkItemId);
      setSelectedWorkItemId(nextWorkItemId);
    },
    [selectionStore]
  );

  const adoptUnschedulableSchedule = React.useCallback(
    async (targetWorkItemId: number, sourceWorkItemId: number) => {
      const sourceBar = filteredTimeline?.bars.find((bar) => bar.workItemId === sourceWorkItemId) ?? null;
      if (!sourceBar || !sourceBar.schedule.startDate || !sourceBar.schedule.endDate) {
        return;
      }

      if (props.onAdoptUnschedulableSchedule) {
        await props.onAdoptUnschedulableSchedule({
          targetWorkItemId,
          startDate: sourceBar.schedule.startDate,
          endDate: sourceBar.schedule.endDate
        });
      }

      setAdoptedSchedulesByWorkItemId((current) => ({
        ...current,
        [targetWorkItemId]: {
          startDate: sourceBar.schedule.startDate,
          endDate: sourceBar.schedule.endDate
        }
      }));
    },
    [filteredTimeline, props]
  );

  const persistTimelineViewportSoon = React.useCallback(() => {
    const scrollElement = chartScrollRef.current;
    if (!scrollElement) {
      return;
    }

    if (viewportPersistDebounceRef.current !== null) {
      window.clearTimeout(viewportPersistDebounceRef.current);
    }

    viewportPersistDebounceRef.current = window.setTimeout(() => {
      viewportPersistDebounceRef.current = null;
      saveTimelineViewportPreference({
        dayWidthPx: liveDayWidthRef.current,
        scrollLeftPx: scrollElement.scrollLeft,
        scrollTopPx: scrollElement.scrollTop
      }, activeQueryId);
    }, VIEWPORT_PERSIST_DEBOUNCE_MS);
  }, [activeQueryId]);

  const resolveFitLayoutLeftOffsets = React.useCallback(
    (scrollElement: HTMLDivElement): { chartStartX: number; obscuredLeftPx: number } => {
      const mainLaneElement = scrollElement.querySelector<HTMLElement>(".timeline-chart-main-lane");
      const splitterElement = scrollElement.querySelector<HTMLElement>(".timeline-main-splitter-embedded");
      const measuredSplitterWidthPx = splitterElement?.getBoundingClientRect().width ?? 0;
      const measuredMainLaneOffsetPx = mainLaneElement?.offsetLeft ?? 0;
      const fallbackSidebarWidthPx = effectiveSidebarWidthPx;
      const fallbackSplitterWidthPx = splitterElement ? TIMELINE_MAIN_SPLITTER_WIDTH_PX : 0;
      const sidebarWidthPx = measuredMainLaneOffsetPx > 0 ? measuredMainLaneOffsetPx : fallbackSidebarWidthPx;
      const splitterWidthPx = measuredSplitterWidthPx > 0 ? measuredSplitterWidthPx : fallbackSplitterWidthPx;

      return {
        chartStartX: sidebarWidthPx + CHART_LEFT_GUTTER,
        obscuredLeftPx: sidebarWidthPx + splitterWidthPx
      };
    },
    [effectiveSidebarWidthPx]
  );

  React.useEffect(() => {
    const scrollElement = chartScrollRef.current;
    if (!scrollElement || initialViewportAppliedRef.current || chartModel.bars.length === 0) {
      return;
    }

    const alignInitialViewport = () => {
      const clientWidth = scrollElement.clientWidth;
      const clientHeight = scrollElement.clientHeight;
      if (clientWidth <= 0 || clientHeight <= 0) {
        return;
      }

      const maxScrollLeft = Math.max(0, scrollElement.scrollWidth - clientWidth);
      const maxScrollTop = Math.max(0, scrollElement.scrollHeight - clientHeight);

      const restoredViewport = pendingViewportRestoreRef.current;
      if (restoredViewport) {
        const nextScrollLeft = clamp(restoredViewport.scrollLeftPx, 0, maxScrollLeft);
        const nextScrollTop = clamp(restoredViewport.scrollTopPx, 0, maxScrollTop);
        scrollElement.scrollLeft = nextScrollLeft;
        scrollElement.scrollTop = nextScrollTop;
        pendingViewportRestoreRef.current = null;
        initialViewportAppliedRef.current = true;
        return;
      }

      const todayTargetX = clientWidth * TODAY_INITIAL_VIEWPORT_RATIO;
      const absoluteTodayX = chartModel.todayX === null ? 0 : effectiveSidebarWidthPx + CHART_LEFT_GUTTER + chartModel.todayX;
      const nextScrollLeft = clamp(absoluteTodayX - todayTargetX, 0, maxScrollLeft);
      const nextScrollTop = clamp(CHART_TOP_PADDING, 0, maxScrollTop);

      if (typeof scrollElement.scrollTo === "function") {
        scrollElement.scrollTo({ left: nextScrollLeft, top: nextScrollTop, behavior: "auto" });
      } else {
        scrollElement.scrollLeft = nextScrollLeft;
        scrollElement.scrollTop = nextScrollTop;
      }

      initialViewportAppliedRef.current = true;
    };

    const frame = window.requestAnimationFrame(alignInitialViewport);
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [chartModel.bars.length, chartModel.todayX, chartModel.width, effectiveSidebarWidthPx]);

  React.useEffect(() => {
    const scrollElement = chartScrollRef.current;
    if (!scrollElement || chartModel.bars.length === 0) {
      setChartViewportWidthPx(0);
      setChartViewportHeightPx(0);
      return;
    }

    const updateViewportSize = (): void => {
      setChartViewportWidthPx(scrollElement.clientWidth);
      setChartViewportHeightPx(scrollElement.clientHeight);
    };

    updateViewportSize();

    if (typeof ResizeObserver !== "undefined") {
      const resizeObserver = new ResizeObserver(() => {
        updateViewportSize();
      });
      resizeObserver.observe(scrollElement);
      return () => {
        resizeObserver.disconnect();
      };
    }

    window.addEventListener("resize", updateViewportSize);
    return () => {
      window.removeEventListener("resize", updateViewportSize);
    };
  }, [chartModel.bars.length]);

  React.useEffect(() => {
    liveDayWidthRef.current = dayWidthPx;
    committedDayWidthRef.current = dayWidthPx;
    persistTimelineViewportSoon();
  }, [dayWidthPx, persistTimelineViewportSoon]);

  React.useEffect(() => {
    return () => {
      if (viewportPersistDebounceRef.current !== null) {
        window.clearTimeout(viewportPersistDebounceRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    return () => {
      if (wheelZoomFrameRef.current !== null) {
        window.cancelAnimationFrame(wheelZoomFrameRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    const anchor = zoomAnchorRef.current;
    const scrollElement = chartScrollRef.current;
    if (!anchor || !scrollElement) {
      return;
    }

    const absoluteTargetX = effectiveSidebarWidthPx + CHART_LEFT_GUTTER + anchor.dayOffset * chartModel.dayWidthPx;
    const desiredScrollLeft = absoluteTargetX - anchor.pointerOffsetX;
    scrollElement.scrollLeft = Math.max(0, desiredScrollLeft);
    zoomAnchorRef.current = null;
    persistTimelineViewportSoon();
  }, [chartModel.dayWidthPx, effectiveSidebarWidthPx, persistTimelineViewportSoon]);

  const applyFitRangeToViewport = React.useCallback(
    (fitRange: { start: Date; end: Date }, dayWidth: number): void => {
      const scrollElement = chartScrollRef.current;
      if (!scrollElement) {
        return;
      }

      const layoutOffsets = resolveFitLayoutLeftOffsets(scrollElement);
      const maxScrollLeft = Math.max(0, scrollElement.scrollWidth - scrollElement.clientWidth);
      const rangeStartWithPadding = addDays(fitRange.start, -FIT_TO_VIEW_SIDE_PADDING_DAYS);
      const rangeStartOffset = dayDiff(chartModel.domainStart, rangeStartWithPadding);
      const desiredStartX = layoutOffsets.chartStartX + rangeStartOffset * dayWidth;
      const viewportTargetX = layoutOffsets.obscuredLeftPx + FIT_TO_VIEW_INSET_PX;
      scrollElement.scrollLeft = clamp(desiredStartX - viewportTargetX, 0, maxScrollLeft);
      persistTimelineViewportSoon();
    },
    [chartModel.domainStart, persistTimelineViewportSoon, resolveFitLayoutLeftOffsets]
  );

  React.useEffect(() => {
    const fitRange = pendingFitRangeRef.current;
    if (!fitRange) {
      return;
    }

    applyFitRangeToViewport(fitRange, chartModel.dayWidthPx);
    pendingFitRangeRef.current = null;
  }, [applyFitRangeToViewport, chartModel.dayWidthPx]);

  const selectWeekZoom = React.useCallback(() => {
    setDayWidthPx(DAY_WIDTH_WEEK_PX);
  }, [setDayWidthPx]);

  const selectMonthZoom = React.useCallback(() => {
    setDayWidthPx(DAY_WIDTH_MONTH_PX);
  }, [setDayWidthPx]);

  const selectQuarterZoom = React.useCallback(() => {
    setDayWidthPx(DAY_WIDTH_QUARTER_PX);
  }, [setDayWidthPx]);

  const selectYearZoom = React.useCallback(() => {
    setDayWidthPx(DAY_WIDTH_YEAR_PX);
  }, [setDayWidthPx]);

  const applyDependencyViewModeChange = React.useCallback(
    (mode: DependencyViewMode) => {
      setDependencyViewMode(mode);
      setActiveDependencyDrag(null);
      setActiveScheduleDrag(null);
      setActiveUnschedulableDrag(null);
      setUnscheduledDropPreview(null);
      setSelectedDependency(null);
    },
    [
      setActiveDependencyDrag,
      setActiveScheduleDrag,
      setActiveUnschedulableDrag,
      setDependencyViewMode,
      setSelectedDependency,
      setUnscheduledDropPreview
    ]
  );

  const rotateDependencyViewMode = React.useCallback(() => {
    const modes = DEPENDENCY_VIEW_MODE_OPTIONS.map((option) => option.value);
    const currentIndex = modes.indexOf(dependencyViewMode);
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % modes.length;
    const nextMode = modes[nextIndex];
    if (!nextMode) {
      return;
    }
    applyDependencyViewModeChange(nextMode);
  }, [applyDependencyViewModeChange, dependencyViewMode]);

  const toggleTimelineFilters = React.useCallback(() => {
    setTimelineFiltersOpen((current) => {
      if (current) {
        setOpenFilterDropdown(null);
      }
      return !current;
    });
  }, [setOpenFilterDropdown, setTimelineFiltersOpen]);

  const toggleSortSettings = React.useCallback(() => {
    setSortSettingsOpen((current) => !current);
  }, [setSortSettingsOpen]);

  const toggleLabelSettings = React.useCallback(() => {
    setLabelSettingsOpen((current) => !current);
    setLabelFieldSearchDraft("");
    setSidebarFieldSearchDraft("");
  }, [setLabelFieldSearchDraft, setLabelSettingsOpen, setSidebarFieldSearchDraft]);

  useTimelineKeyboardShortcuts({
    isRefreshing: props.isRefreshing,
    onPushPendingWorkItemChanges: props.onPushPendingWorkItemChanges,
    onToggleTimelineFilters: toggleTimelineFilters,
    onToggleSortSettings: toggleSortSettings,
    onToggleLabelSettings: toggleLabelSettings,
    onRotateDependencyMode: rotateDependencyViewMode,
    onSelectMonthZoom: selectMonthZoom,
    onSelectWeekZoom: selectWeekZoom,
    onSelectQuarterZoom: selectQuarterZoom,
    onSelectYearZoom: selectYearZoom,
    pendingWorkItemSyncCount: props.pendingWorkItemSyncCount,
    onRemoveDependency: props.onRemoveDependency,
    onRetryRefresh: props.onRetryRefresh,
    selectedDependency,
    setSelectedDependency,
    setSpacePanPressed,
    setAdoptScheduleError,
    spacePanPressedRef
  });

  const handleChartWheel = React.useCallback(
    (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }

      const svg = chartSvgRef.current;
      const scrollElement = chartScrollRef.current;
      const mainLane = mainLaneRef.current;
      if (!svg || !scrollElement) {
        return;
      }

      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      if (rect.width <= 0) {
        return;
      }

      const horizontalScale = svg.viewBox.baseVal.width / rect.width;
      const svgX = (event.clientX - rect.left) * horizontalScale;
      const dayOffset = (svgX - CHART_LEFT_GUTTER) / chartModel.dayWidthPx;
      const pointerOffsetX = event.clientX - scrollElement.getBoundingClientRect().left;
      const deltaPixels = normalizeWheelDelta(event);
      const zoomMultiplier = Math.exp(-deltaPixels * ZOOM_WHEEL_SENSITIVITY);
      const currentDayWidth = pendingWheelDayWidthRef.current ?? liveDayWidthRef.current;
      const nextDayWidth = quantizeDayWidth(clamp(currentDayWidth * zoomMultiplier, DAY_WIDTH_MIN_PX, DAY_WIDTH_MAX_PX));

      zoomAnchorRef.current = { dayOffset, pointerOffsetX };
      pendingWheelDayWidthRef.current = nextDayWidth;

      if (mainLane) {
        const ratio = nextDayWidth / committedDayWidthRef.current;
        const originX = scrollElement.scrollLeft + pointerOffsetX;
        mainLane.style.transformOrigin = `${originX}px 0px`;
        mainLane.style.transform = `scaleX(${ratio})`;
        mainLane.style.willChange = "transform";
      }

      if (zoomCommitTimerRef.current !== null) {
        clearTimeout(zoomCommitTimerRef.current);
      }
      zoomCommitTimerRef.current = window.setTimeout(() => {
        zoomCommitTimerRef.current = null;
        const pendingDayWidth = pendingWheelDayWidthRef.current;
        pendingWheelDayWidthRef.current = null;
        if (pendingDayWidth === null) {
          return;
        }

        if (mainLane) {
          mainLane.style.transform = "";
          mainLane.style.transformOrigin = "";
          mainLane.style.willChange = "";
        }
        committedDayWidthRef.current = pendingDayWidth;
        setDayWidthPx((current) => (current === pendingDayWidth ? current : pendingDayWidth));
      }, ZOOM_COMMIT_DELAY_MS);
    },
    [chartModel.dayWidthPx, dayWidthPx]
  );

  React.useEffect(() => {
    const scrollElement = chartScrollRef.current;
    if (!scrollElement) {
      return;
    }

    const onWheel = (event: WheelEvent) => {
      handleChartWheel(event);
    };

    scrollElement.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      scrollElement.removeEventListener("wheel", onWheel);
    };
  }, [handleChartWheel]);

  React.useEffect(() => {
    const scrollElement = chartScrollRef.current;
    if (!scrollElement) {
      return;
    }

    const onScroll = () => {
      persistTimelineViewportSoon();
    };

    scrollElement.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scrollElement.removeEventListener("scroll", onScroll);
    };
  }, [persistTimelineViewportSoon]);

  const zoomToFitTimeline = React.useCallback(() => {
    const scrollElement = chartScrollRef.current;
    const visibleTimelineRange = resolveTimelineVisibleRange(filteredTimeline);
    if (!scrollElement || !visibleTimelineRange) {
      return;
    }

    const layoutOffsets = resolveFitLayoutLeftOffsets(scrollElement);
    const availableWidth =
      scrollElement.clientWidth -
      layoutOffsets.obscuredLeftPx -
      CHART_LEFT_GUTTER -
      CHART_RIGHT_PADDING_PX -
      FIT_TO_VIEW_INSET_PX * 2;
    if (availableWidth <= 0) {
      return;
    }

    const spanDays = Math.max(1, dayDiffInclusive(visibleTimelineRange.start, visibleTimelineRange.end));
    const fittedDayWidthPx = clamp(quantizeDayWidth(availableWidth / spanDays), DAY_WIDTH_MIN_PX, DAY_WIDTH_MAX_PX);
    pendingFitRangeRef.current = visibleTimelineRange;
    if (Math.abs(fittedDayWidthPx - chartModel.dayWidthPx) < 0.01) {
      applyFitRangeToViewport(visibleTimelineRange, fittedDayWidthPx);
      pendingFitRangeRef.current = null;
      return;
    }
    setDayWidthPx(fittedDayWidthPx);
  }, [applyFitRangeToViewport, chartModel.dayWidthPx, filteredTimeline, resolveFitLayoutLeftOffsets]);

  const beginPanDrag = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!spacePanPressedRef.current || event.button !== 0) {
        return;
      }

      const scrollElement = chartScrollRef.current;
      if (!scrollElement) {
        return;
      }

      event.preventDefault();
      if ("setPointerCapture" in event.currentTarget) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }

      setActivePanDrag({
        pointerId: event.pointerId,
        originClientX: event.clientX,
        originClientY: event.clientY,
        originScrollLeft: scrollElement.scrollLeft,
        originScrollTop: scrollElement.scrollTop
      });
    },
    []
  );

  const updatePanDrag = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    setActivePanDrag((current) => {
      if (!current || current.pointerId !== event.pointerId) {
        return current;
      }

      const scrollElement = chartScrollRef.current;
      if (!scrollElement) {
        return current;
      }

      const deltaX = event.clientX - current.originClientX;
      const deltaY = event.clientY - current.originClientY;
      scrollElement.scrollLeft = current.originScrollLeft - deltaX;
      scrollElement.scrollTop = current.originScrollTop - deltaY;
      return current;
    });
  }, []);

  const finishPanDrag = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const pointerId = event.pointerId;
      setActivePanDrag((current) => {
        if (!current || current.pointerId !== pointerId) {
          return current;
        }

        persistTimelineViewportSoon();
        return null;
      });
    },
    [persistTimelineViewportSoon]
  );

  const geometryByWorkItemId = React.useMemo(() => {
    const byId = new Map<number, BarGeometry>();
    chartModel.bars.forEach((bar, index) => {
      const y = resolveTimelineBarTopY(index);
      const x = CHART_LEFT_GUTTER + bar.x;
      byId.set(bar.workItemId, { x, y, width: bar.width, midY: y + BAR_HEIGHT / 2 });
    });
    return byId;
  }, [chartModel.bars]);
  const chartBarByWorkItemId = React.useMemo(() => {
    const byId = new Map<number, VisualTimelineBar>();
    chartModel.bars.forEach((bar) => {
      byId.set(bar.workItemId, bar);
    });
    return byId;
  }, [chartModel.bars]);
  const visibleDependencies = React.useMemo(() => {
    if (!filteredTimeline) {
      return [];
    }

    if (dependencyViewMode !== "violations") {
      return filteredTimeline.dependencies;
    }

    return filteredTimeline.dependencies.filter((dependency) => {
      const predecessorBar = chartBarByWorkItemId.get(dependency.predecessorWorkItemId);
      const successorBar = chartBarByWorkItemId.get(dependency.successorWorkItemId);
      return isDependencyViolated(predecessorBar, successorBar);
    });
  }, [chartBarByWorkItemId, dependencyViewMode, filteredTimeline]);
  const dependencyConnectors = React.useMemo(() => {
    if (!dependencyVisible || !filteredTimeline) {
      return [] as VisualDependencyConnector[];
    }

    const uniqueDependencies = deduplicateTimelineDependencies(visibleDependencies);

    const groupedByPredecessor = new Map<number, typeof uniqueDependencies>();
    for (const dep of uniqueDependencies) {
      const group = groupedByPredecessor.get(dep.predecessorWorkItemId);
      if (group) {
        group.push(dep);
      } else {
        groupedByPredecessor.set(dep.predecessorWorkItemId, [dep]);
      }
    }

    const connectors: VisualDependencyConnector[] = [];

    for (const [predecessorId, group] of groupedByPredecessor) {
      const from = geometryByWorkItemId.get(predecessorId);
      if (!from) {
        continue;
      }

      const resolvedTargets: Array<{ dependency: (typeof uniqueDependencies)[number]; to: BarGeometry; isViolated: boolean }> = [];
      for (const dependency of group) {
        const to = geometryByWorkItemId.get(dependency.successorWorkItemId);
        if (!to) {
          continue;
        }
        const predecessorBar = chartBarByWorkItemId.get(dependency.predecessorWorkItemId);
        const successorBar = chartBarByWorkItemId.get(dependency.successorWorkItemId);
        resolvedTargets.push({ dependency, to, isViolated: isDependencyViolated(predecessorBar, successorBar) });
      }

      if (resolvedTargets.length === 0) {
        continue;
      }

      const baseBendX = resolvedTargets.length > 1
        ? resolveStemBendX(from, resolvedTargets.map((t) => t.to), 0)
        : null;

      for (let i = 0; i < resolvedTargets.length; i++) {
        const { dependency, to, isViolated } = resolvedTargets[i];
        const bendX = baseBendX !== null ? baseBendX + i * DEPENDENCY_BEND_STAGGER_PX : null;
        connectors.push({
          key: `${dependency.predecessorWorkItemId}-${dependency.successorWorkItemId}-${dependency.dependencyType}-${i}`,
          path: bendX !== null
            ? buildDependencyConnectorPathWithBendX(from, to, bendX)
            : buildDependencyConnectorPath(from, to, 0),
          markerEnd: `url(#${isViolated ? dependencyAlertMarkerId : dependencyMarkerId})`,
          predecessorWorkItemId: dependency.predecessorWorkItemId,
          successorWorkItemId: dependency.successorWorkItemId,
          dependencyType: dependency.dependencyType,
          isViolated
        });
      }
    }

    return connectors;
  }, [
    chartBarByWorkItemId,
    dependencyAlertMarkerId,
    dependencyMarkerId,
    dependencyVisible,
    visibleDependencies,
    geometryByWorkItemId
  ]);
  React.useEffect(() => {
    if (!selectedDependency) {
      return;
    }

    const stillVisible = dependencyConnectors.some(
      (dependency) =>
        dependency.predecessorWorkItemId === selectedDependency.predecessorWorkItemId &&
        dependency.successorWorkItemId === selectedDependency.successorWorkItemId &&
        dependency.dependencyType === selectedDependency.dependencyType
    );
    if (!stillVisible) {
      setSelectedDependency(null);
    }
  }, [dependencyConnectors, selectedDependency]);
  const hoveredDependencyWorkItemIds = React.useMemo(() => {
    if (!hoveredDependencyKey) {
      return null;
    }
    const connector = dependencyConnectors.find((c) => c.key === hoveredDependencyKey);
    if (!connector) {
      return null;
    }
    return new Set([connector.predecessorWorkItemId, connector.successorWorkItemId]);
  }, [hoveredDependencyKey, dependencyConnectors]);
  const activeDependencyDragPreview = React.useMemo(() => {
    if (!activeDependencyDrag) {
      return null;
    }

    const from = geometryByWorkItemId.get(activeDependencyDrag.sourceWorkItemId);
    if (!from) {
      return null;
    }

    const hoveredGeometry =
      activeDependencyDrag.hoveredTargetWorkItemId === null
        ? null
        : geometryByWorkItemId.get(activeDependencyDrag.hoveredTargetWorkItemId) ?? null;
    const targetX = hoveredGeometry ? hoveredGeometry.x : activeDependencyDrag.pointerX;
    const targetY = hoveredGeometry ? hoveredGeometry.midY : activeDependencyDrag.pointerY;
    const hoveredTargetIsValid =
      hoveredGeometry !== null &&
      activeDependencyDrag.hoveredTargetWorkItemId !== null &&
      activeDependencyDrag.hoveredTargetWorkItemId !== activeDependencyDrag.sourceWorkItemId;

    return {
      path: buildDependencyConnectorToPointPath(from, targetX, targetY, activeDependencyDrag.sourceWorkItemId),
      hoveredTargetWorkItemId: hoveredTargetIsValid ? activeDependencyDrag.hoveredTargetWorkItemId : null
    };
  }, [activeDependencyDrag, geometryByWorkItemId]);

  const updateEditedSchedule = React.useCallback((workItemId: number, startDate: Date, endDate: Date) => {
    setEditedBarSchedulesByWorkItemId((current) => ({
      ...current,
      [workItemId]: {
        startDate: toIsoDateUtc(startDate),
        endDate: toIsoDateUtc(endDate)
      }
    }));
  }, []);

  const beginBarDrag = React.useCallback(
    (input: {
      event: React.PointerEvent<SVGElement>;
      mode: DragMode;
      bar: VisualTimelineBar;
    }) => {
      if (!canEditSchedule) {
        return;
      }

      if (input.event.button !== 0) {
        return;
      }

      input.event.preventDefault();
      input.event.stopPropagation();
      if ("setPointerCapture" in input.event.currentTarget) {
        input.event.currentTarget.setPointerCapture(input.event.pointerId);
      }
      setAdoptScheduleError(null);
      selectWorkItem(input.bar.workItemId);
      setActiveScheduleDrag({
        mode: input.mode,
        pointerId: input.event.pointerId,
        workItemId: input.bar.workItemId,
        originClientX: input.event.clientX,
        originScrollLeft: chartScrollRef.current?.scrollLeft ?? 0,
        startDate: input.bar.start,
        endDate: input.bar.end,
        lastDayDelta: 0
      });
    },
    [canEditSchedule, chartScrollRef, selectWorkItem]
  );
  const beginDependencyDrag = React.useCallback(
    (input: {
      event: React.PointerEvent<SVGElement>;
      sourceWorkItemId: number;
    }) => {
      if (!dependencyMode || input.event.button !== 0) {
        return;
      }

      const sourceGeometry = geometryByWorkItemId.get(input.sourceWorkItemId);
      if (!sourceGeometry) {
        return;
      }

      const svgPoint = clientPointToSvg(input.event.clientX, input.event.clientY, chartSvgRef.current);
      input.event.preventDefault();
      input.event.stopPropagation();
      if ("setPointerCapture" in input.event.currentTarget) {
        input.event.currentTarget.setPointerCapture(input.event.pointerId);
      }

      setAdoptScheduleError(null);
      selectWorkItem(input.sourceWorkItemId);
      setActiveDependencyDrag({
        pointerId: input.event.pointerId,
        sourceWorkItemId: input.sourceWorkItemId,
        pointerX: svgPoint.x,
        pointerY: svgPoint.y,
        hoveredTargetWorkItemId: null
      });
    },
    [dependencyMode, geometryByWorkItemId, selectWorkItem]
  );

  const applyDragDelta = React.useCallback(
    (active: ActiveScheduleDrag, clientX: number) => {
      const scrollDelta = (chartScrollRef.current?.scrollLeft ?? 0) - active.originScrollLeft;
      const effectiveClientDelta = clientX - active.originClientX + scrollDelta;
      const deltaDays = clientDeltaToDays(effectiveClientDelta, chartSvgRef.current, chartModel.dayWidthPx);
      if (deltaDays === active.lastDayDelta) {
        return;
      }

      const next = calculateDraggedSchedule(active.mode, active.startDate, active.endDate, deltaDays);
      setActiveScheduleDrag((current) => (current ? { ...current, lastDayDelta: deltaDays } : current));
      updateEditedSchedule(active.workItemId, next.startDate, next.endDate);
    },
    [chartModel.dayWidthPx, chartScrollRef, updateEditedSchedule]
  );

  const handleAutoScroll = React.useCallback(() => {
    const active = activeScheduleDrag;
    if (!active) {
      return;
    }
    applyDragDelta(active, lastDragClientXRef.current);
  }, [activeScheduleDrag, applyDragDelta]);
  autoScrollCallbackRef.current = handleAutoScroll;

  const handleChartPointerMove = React.useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const activeDependency = activeDependencyDrag;
      if (activeDependency && event.pointerId === activeDependency.pointerId) {
        const svgPoint = clientPointToSvg(event.clientX, event.clientY, chartSvgRef.current);
        if (svgPoint.x !== activeDependency.pointerX || svgPoint.y !== activeDependency.pointerY) {
          suppressNextBarClickRef.current = true;
        }
        const hoveredTargetWorkItemId = resolveHoveredDependencyTargetWorkItemId(
          geometryByWorkItemId,
          svgPoint.x,
          svgPoint.y,
          activeDependency.sourceWorkItemId
        );

        setActiveDependencyDrag((current) =>
          current
            ? {
                ...current,
                pointerX: svgPoint.x,
                pointerY: svgPoint.y,
                hoveredTargetWorkItemId
              }
            : current
        );
        return;
      }

      const active = activeScheduleDrag;
      if (!active || event.pointerId !== active.pointerId) {
        return;
      }

      if (event.clientX !== active.originClientX) {
        suppressNextBarClickRef.current = true;
      }

      lastDragClientXRef.current = event.clientX;
      updateDragAutoScroll(event.clientX, event.clientY);
      applyDragDelta(active, event.clientX);
    },
    [activeDependencyDrag, activeScheduleDrag, applyDragDelta, geometryByWorkItemId, updateDragAutoScroll]
  );

  const persistDraggedSchedule = React.useCallback(
    async (drag: ActiveScheduleDrag) => {
      const override = editedBarSchedulesByWorkItemId[drag.workItemId];
      if (!override || !props.onUpdateWorkItemSchedule) {
        return;
      }

      const previousBar = props.timeline?.bars.find((entry) => entry.workItemId === drag.workItemId);
      const previousStart = previousBar?.schedule.startDate;
      const previousEnd = previousBar?.schedule.endDate;

      const changed = previousStart !== override.startDate || previousEnd !== override.endDate;
      if (!changed) {
        return;
      }

      try {
        await props.onUpdateWorkItemSchedule({
          targetWorkItemId: drag.workItemId,
          startDate: override.startDate,
          endDate: override.endDate
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        setAdoptScheduleError(message);
        setEditedBarSchedulesByWorkItemId((current) => {
          const next = { ...current };
          if (previousStart && previousEnd) {
            next[drag.workItemId] = { startDate: previousStart, endDate: previousEnd };
          } else {
            delete next[drag.workItemId];
          }
          return next;
        });
      }
    },
    [editedBarSchedulesByWorkItemId, props, props.timeline]
  );

  const finishActiveDrag = React.useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const dependencyDrag = activeDependencyDrag;
      if (dependencyDrag && event.pointerId === dependencyDrag.pointerId) {
        setActiveDependencyDrag(null);
        const successorWorkItemId = dependencyDrag.hoveredTargetWorkItemId;
        if (
          successorWorkItemId !== null &&
          successorWorkItemId !== dependencyDrag.sourceWorkItemId &&
          props.onCreateDependency
        ) {
          void props
            .onCreateDependency({
              predecessorWorkItemId: dependencyDrag.sourceWorkItemId,
              successorWorkItemId
            })
            .catch((error) => {
              const message = error instanceof Error ? error.message : "Unknown error";
              setAdoptScheduleError(message);
            });
        }
        return;
      }

      const active = activeScheduleDrag;
      if (!active || event.pointerId !== active.pointerId) {
        return;
      }

      setActiveScheduleDrag(null);
      void persistDraggedSchedule(active);
    },
    [activeDependencyDrag, activeScheduleDrag, persistDraggedSchedule, props]
  );

  const persistWorkItemSchedule = React.useCallback(
    async (input: { targetWorkItemId: number; startDate: string; endDate: string }) => {
      if (props.onUpdateWorkItemSchedule) {
        await props.onUpdateWorkItemSchedule(input);
        return;
      }

      if (props.onAdoptUnschedulableSchedule) {
        await props.onAdoptUnschedulableSchedule(input);
      }
    },
    [props]
  );

  const scheduleUnscheduledFromDrop = React.useCallback(
    async (input: { workItemId: number; startDate: Date; fixedEndDate: Date | null }) => {
      const range = resolveUnscheduledDropRange(input.startDate, input.fixedEndDate);
      const startDate = toIsoDateUtc(range.startDate);
      const endDate = toIsoDateUtc(range.endDate);

      await persistWorkItemSchedule({
        targetWorkItemId: input.workItemId,
        startDate,
        endDate
      });

      setAdoptedSchedulesByWorkItemId((current) => ({
        ...current,
        [input.workItemId]: { startDate, endDate }
      }));
      selectWorkItem(input.workItemId);
    },
    [persistWorkItemSchedule, selectWorkItem]
  );

  const startUnscheduledDrag = React.useCallback(
    (event: React.DragEvent<HTMLElement>, workItemId: number, fixedEndDate: Date | null) => {
      if (dependencyMode) {
        return;
      }
      event.dataTransfer.setData("text/plain", String(workItemId));
      event.dataTransfer.effectAllowed = "move";
      setActiveUnschedulableDrag({ workItemId, fixedEndDate });
    },
    [dependencyMode]
  );

  const clearUnscheduledDrag = React.useCallback(() => {
    setActiveUnschedulableDrag(null);
    setUnscheduledDropPreview(null);
  }, []);

  const handleChartDragOver = React.useCallback(
    (event: React.DragEvent<SVGSVGElement>) => {
      if (!activeUnschedulableDrag) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const startDate = clientXToDate(event.clientX, chartSvgRef.current, chartModel.domainStart, chartModel.dayWidthPx);
      setUnscheduledDropPreview(resolveUnscheduledDropRange(startDate, activeUnschedulableDrag.fixedEndDate));
    },
    [activeUnschedulableDrag, chartModel.dayWidthPx, chartModel.domainStart]
  );

  const handleChartDrop = React.useCallback(
    (event: React.DragEvent<SVGSVGElement>) => {
      if (!activeUnschedulableDrag) {
        return;
      }

      event.preventDefault();
      setAdoptScheduleError(null);

      const droppedDate = clientXToDate(event.clientX, chartSvgRef.current, chartModel.domainStart, chartModel.dayWidthPx);
      const workItemId = activeUnschedulableDrag.workItemId;
      setActiveUnschedulableDrag(null);
      setUnscheduledDropPreview(null);

      void scheduleUnscheduledFromDrop({
        workItemId,
        startDate: droppedDate,
        fixedEndDate: activeUnschedulableDrag.fixedEndDate
      }).catch((error) => {
        const message = error instanceof Error ? error.message : "Unknown error";
        setAdoptScheduleError(message);
      });
    },
    [activeUnschedulableDrag, chartModel.dayWidthPx, chartModel.domainStart, scheduleUnscheduledFromDrop]
  );

  const updateFieldColorCoding = React.useCallback(
    (next: TimelineFieldColorCodingConfig) => {
      setFieldColorCoding(next);
      saveTimelineFieldColorCodingConfig(next, activeQueryId);
    },
    []
  );

  const selectFieldForColorCoding = React.useCallback(
    (fieldRef: string | null) => {
      const normalizedFieldRef = fieldRef && fieldRef.trim().length > 0 ? fieldRef.trim() : null;
      if (normalizedFieldRef) {
        setLastSelectedFieldRef(normalizedFieldRef);
      }
      updateFieldColorCoding({
        fieldRef: normalizedFieldRef,
        valueColors: normalizedFieldRef ? fieldColorCoding.valueColors : {},
        overdueExcludedStateCodes: fieldColorCoding.overdueExcludedStateCodes
      });
    },
    [fieldColorCoding.overdueExcludedStateCodes, fieldColorCoding.valueColors, updateFieldColorCoding]
  );

  const updateFieldValueColor = React.useCallback(
    (valueKey: string, color: string | null) => {
      const nextValueColors = { ...fieldColorCoding.valueColors };
      const scopedKey = toScopedFieldValueColorKey(fieldColorCoding.fieldRef, valueKey);
      if (scopedKey) {
        if (!color) {
          delete nextValueColors[scopedKey];
        } else {
          nextValueColors[scopedKey] = color;
        }
      }

      if (!color) {
        delete nextValueColors[valueKey];
      } else {
        nextValueColors[valueKey] = color;
      }

      updateFieldColorCoding({
        fieldRef: fieldColorCoding.fieldRef,
        valueColors: nextValueColors,
        overdueExcludedStateCodes: fieldColorCoding.overdueExcludedStateCodes
      });
    },
    [fieldColorCoding.fieldRef, fieldColorCoding.overdueExcludedStateCodes, fieldColorCoding.valueColors, updateFieldColorCoding]
  );

  const toggleOverdueExcludedState = React.useCallback(
    (stateCode: string, excluded: boolean) => {
      const normalizedStateCode = normalizeStateCodeForComparison(stateCode);
      if (normalizedStateCode.length === 0) {
        return;
      }

      const next = new Set(
        resolveOverdueExcludedStateCodes(
          fieldColorCoding.overdueExcludedStateCodes,
          DEFAULT_OVERDUE_EXCLUDED_STATE_CODES
        )
      );
      if (excluded) {
        next.add(normalizedStateCode);
      } else {
        next.delete(normalizedStateCode);
      }

      updateFieldColorCoding({
        fieldRef: fieldColorCoding.fieldRef,
        valueColors: fieldColorCoding.valueColors,
        overdueExcludedStateCodes: [...next].sort((left, right) => left.localeCompare(right))
      });
    },
    [fieldColorCoding.fieldRef, fieldColorCoding.overdueExcludedStateCodes, fieldColorCoding.valueColors, updateFieldColorCoding]
  );

  const selectColorCodingOption = React.useCallback(
    (option: ColorCodingOption) => {
      setColorCoding(option.mode);
      saveLastTimelineColorCoding(option.mode, activeQueryId);
      if (option.mode === "field") {
        selectFieldForColorCoding(option.fieldRef);
      } else {
        updateFieldColorCoding({
          fieldRef: null,
          valueColors: fieldColorCoding.valueColors,
          overdueExcludedStateCodes: fieldColorCoding.overdueExcludedStateCodes
        });
      }
      setColorCodingDropdownOpen(false);
      setColorCodingSearchDraft("");
    },
    [fieldColorCoding.overdueExcludedStateCodes, fieldColorCoding.valueColors, selectFieldForColorCoding, updateFieldColorCoding]
  );

  const applyFirstFilteredColorCodingOption = React.useCallback((): boolean => {
    const preferredOption = pickPreferredColorCodingOption(filteredColorCodingOptions, colorCodingSearchDraft);
    if (!preferredOption) {
      return false;
    }

    selectColorCodingOption(preferredOption);
    return true;
  }, [colorCodingSearchDraft, filteredColorCodingOptions, selectColorCodingOption]);

  const applyFieldFilterSelection = React.useCallback((slotId: number, fieldRef: string | null) => {
    const normalizedFieldRef = fieldRef?.trim() ? fieldRef.trim() : null;
    setTimelineFieldFilters((current) =>
      current.map((filter) =>
        filter.slotId === slotId
          ? {
              ...filter,
              fieldRef: normalizedFieldRef,
              selectedValueKeys: normalizedFieldRef && filter.fieldRef === normalizedFieldRef ? filter.selectedValueKeys : []
            }
          : filter
      )
    );
  }, []);

  const toggleTimelineFieldValueSelection = React.useCallback((slotId: number, valueKey: string) => {
    setTimelineFieldFilters((current) =>
      current.map((filter) => {
        if (filter.slotId !== slotId) {
          return filter;
        }

        const exists = filter.selectedValueKeys.includes(valueKey);
        if (exists) {
          return {
            ...filter,
            selectedValueKeys: filter.selectedValueKeys.filter((entry) => entry !== valueKey)
          };
        }

        return {
          ...filter,
          selectedValueKeys: [...filter.selectedValueKeys, valueKey]
        };
      })
    );
  }, []);

  const toggleVisibleTimelineFieldValueSelections = React.useCallback((slotId: number, valueKeys: string[]) => {
    if (valueKeys.length === 0) {
      return;
    }

    setTimelineFieldFilters((current) =>
      current.map((filter) => {
        if (filter.slotId !== slotId) {
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

        const nextSelectedValueKeys = [...filter.selectedValueKeys];
        for (const valueKey of valueKeys) {
          if (!nextSelectedValueKeys.includes(valueKey)) {
            nextSelectedValueKeys.push(valueKey);
          }
        }

        return {
          ...filter,
          selectedValueKeys: nextSelectedValueKeys
        };
      })
    );
  }, []);

  const addTimelineFilterSlot = React.useCallback(() => {
    setTimelineFieldFilters((current) => {
      if (current.length >= MAX_TIMELINE_FILTER_SLOTS) {
        return current;
      }
      return [...current, createTimelineFieldFilter(nextFilterSlotId)];
    });
    setNextFilterSlotId((current) => current + 1);
  }, [nextFilterSlotId]);

  const removeTimelineFilterSlot = React.useCallback(
    (slotId: number) => {
      setTimelineFieldFilters((current) => {
        if (current.length <= 1) {
          return current.map((filter) =>
            filter.slotId === slotId ? { ...filter, fieldRef: null, selectedValueKeys: [] } : filter
          );
        }

        return current.filter((filter) => filter.slotId !== slotId);
      });

      if (openFilterDropdown?.slotId === slotId) {
        setOpenFilterDropdown(null);
      }
    },
    [openFilterDropdown?.slotId]
  );

  const toggleTimelineLabelField = React.useCallback((fieldRef: string) => {
    const normalized = fieldRef.trim();
    if (!normalized) {
      return;
    }

    setTimelineLabelFields((current) => {
      const exists = current.includes(normalized);
      const next = exists ? current.filter((entry) => entry !== normalized) : [...current, normalized];
      const sanitized = sanitizeTimelineFieldRefList(next);
      saveTimelineLabelFields(sanitized, activeQueryId);
      return sanitized;
    });
  }, []);

  const clearTimelineLabelFields = React.useCallback(() => {
    setTimelineLabelFields(() => {
      saveTimelineLabelFields([], activeQueryId);
      return [];
    });
  }, []);

  const toggleTimelineSidebarField = React.useCallback((fieldRef: string) => {
    const normalized = fieldRef.trim();
    if (!normalized) {
      return;
    }

    setTimelineSidebarFields((current) => {
      const exists = current.includes(normalized);
      const next = exists ? current.filter((entry) => entry !== normalized) : [...current, normalized];
      const sanitized = sanitizeTimelineFieldRefList(next);
      saveTimelineSidebarFields(sanitized, activeQueryId);
      return sanitized;
    });
  }, []);

  const clearTimelineSidebarFields = React.useCallback(() => {
    setTimelineSidebarFields(() => {
      saveTimelineSidebarFields([], activeQueryId);
      return [];
    });
  }, []);

  const openTimelineLabelSettingsFromSidebar = React.useCallback(() => {
    setLabelSettingsOpen(true);
    setLabelFieldSearchDraft("");
    setSidebarFieldSearchDraft("");
  }, []);

  const syncLabelMenuScrollFromSidebar = React.useCallback(() => {
    const sidebar = labelMenuSidebarOptionsRef.current;
    const bar = labelMenuBarOptionsRef.current;
    if (!sidebar || !bar) {
      return;
    }

    if (labelMenuScrollSyncSourceRef.current === "bar") {
      labelMenuScrollSyncSourceRef.current = null;
      return;
    }

    if (Math.abs(bar.scrollTop - sidebar.scrollTop) <= 1) {
      return;
    }

    labelMenuScrollSyncSourceRef.current = "sidebar";
    bar.scrollTop = sidebar.scrollTop;
  }, []);

  const syncLabelMenuScrollFromBar = React.useCallback(() => {
    const sidebar = labelMenuSidebarOptionsRef.current;
    const bar = labelMenuBarOptionsRef.current;
    if (!sidebar || !bar) {
      return;
    }

    if (labelMenuScrollSyncSourceRef.current === "sidebar") {
      labelMenuScrollSyncSourceRef.current = null;
      return;
    }

    if (Math.abs(sidebar.scrollTop - bar.scrollTop) <= 1) {
      return;
    }

    labelMenuScrollSyncSourceRef.current = "bar";
    sidebar.scrollTop = bar.scrollTop;
  }, []);

  const openFilterSlot = React.useMemo(
    () =>
      openFilterDropdown === null
        ? null
        : timelineFieldFilters.find((filter) => filter.slotId === openFilterDropdown.slotId) ?? null,
    [openFilterDropdown, timelineFieldFilters]
  );
  const openFilterFieldOptions = React.useMemo(() => {
    if (!openFilterDropdown || openFilterDropdown.kind !== "field") {
      return [];
    }
    return filterFieldRefsBySearch(availableFieldRefs, filterFieldSearchDraft);
  }, [availableFieldRefs, filterFieldSearchDraft, openFilterDropdown]);
  const openFilterValueOptions = React.useMemo(() => {
    if (!openFilterDropdown || openFilterDropdown.kind !== "value" || !openFilterSlot?.fieldRef) {
      return [];
    }
    return filterFieldValueStatsBySearch(
      listFieldValueStats(effectiveTimeline, openFilterSlot.fieldRef),
      filterValueSearchDraft
    );
  }, [effectiveTimeline, filterValueSearchDraft, openFilterDropdown, openFilterSlot?.fieldRef]);

  const detailProps: TimelineDetailsPanelProps = {
    timeline: filteredTimeline,
    selectedWorkItemId,
    contentHidden: detailsContentHidden,
    organization: props.organization,
    project: props.project,
    onUpdateSelectedWorkItemDetails: props.onUpdateSelectedWorkItemDetails,
    onFetchWorkItemStateOptions: props.onFetchWorkItemStateOptions,
    onDirtyChange: props.onDetailsDirtyChange
  };
  const timelineMainGridStyle = {
    ["--timeline-sidebar-width-px"]: `${Math.round(effectiveSidebarWidthPx)}px`,
    ["--timeline-details-width-px"]: `${Math.round(detailsWidthPx)}px`
  } as React.CSSProperties;
  const timelineMainSplitterStyle =
    chartViewportHeightPx > 0
      ? ({
          height: `${chartViewportHeightPx}px`
        } as React.CSSProperties)
      : undefined;

  const barCount = chartModel.bars.length;
  const unscheduledCount = filteredTimeline?.unschedulable.length ?? 0;
  const selectedColorCodingLabel = resolveSelectedColorCodingLabel(colorCoding, fieldColorCoding.fieldRef);
  const isFieldColorCodingMode = colorCoding === "field";
  const isReadOnlyStatusColorCodingMode = colorCoding === "status";
  const isOverdueColorCodingMode = colorCoding === "overdue";

  return React.createElement(
    "section",
    {
      "aria-label": "timeline-pane",
      className: "timeline-pane"
    },
    React.createElement(TimelinePaneActionsToolbar, {
      isRefreshing: props.isRefreshing === true,
      onRetryRefresh: () => {
        props.onRetryRefresh?.();
      },
      zoomLevel,
      onSelectWeekZoom: selectWeekZoom,
      onSelectMonthZoom: selectMonthZoom,
      onSelectQuarterZoom: selectQuarterZoom,
      onSelectYearZoom: selectYearZoom,
      dependencyViewMode,
      dependencyModeOptions: DEPENDENCY_VIEW_MODE_OPTIONS,
      onChangeDependencyMode: applyDependencyViewModeChange,
      colorCodingControlRef,
      selectedColorCodingLabel,
      colorCodingDropdownOpen,
      colorCodingSearchDraft,
      filteredColorCodingOptions,
      colorCoding,
      fieldColorCoding,
      onToggleColorCodingDropdown: () => {
        setColorCodingDropdownOpen((current) => !current);
        setColorCodingSearchDraft("");
      },
      onChangeColorCodingSearchDraft: (value) => {
        setColorCodingSearchDraft(value);
      },
      onApplyFirstFilteredColorCodingOption: applyFirstFilteredColorCodingOption,
      onSelectColorCodingOption: selectColorCodingOption,
      onOpenColorSettings: () => {
        if (colorCodingDropdownOpen && colorCodingSearchDraft.trim().length > 0) {
          applyFirstFilteredColorCodingOption();
        }
        setColorSettingsOpen(true);
      },
      filterToggleControlRef,
      timelineFiltersOpen,
      activeTimelineFiltersCount: activeTimelineFilters.length,
      onToggleTimelineFilters: toggleTimelineFilters,
      sortControl: React.createElement(TimelineSortControl, {
        availableFieldRefs,
        controlRef: sortToggleControlRef,
        panelRef: sortPanelRef,
        sortSettingsOpen,
        timelineSortPreference,
        onToggleSortSettings: toggleSortSettings,
        onSelectPrimarySortField: selectPrimarySortField,
        onSelectSecondarySortField: selectSecondarySortField,
        onTogglePrimarySortDirection: togglePrimarySortDirection,
        onToggleSecondarySortDirection: toggleSecondarySortDirection
      }),
      labelToggleControlRef,
      labelSettingsOpen,
      timelineLabelFields,
      timelineSidebarFields,
      labelPanelRef,
      labelMenuSidebarOptionsRef,
      labelMenuBarOptionsRef,
      sidebarFieldSearchDraft,
      labelFieldSearchDraft,
      filteredTimelineSidebarFieldOptions,
      filteredTimelineLabelFieldOptions,
      onToggleLabelSettings: toggleLabelSettings,
      onChangeSidebarFieldSearchDraft: (value) => {
        setSidebarFieldSearchDraft(value);
      },
      onChangeLabelFieldSearchDraft: (value) => {
        setLabelFieldSearchDraft(value);
      },
      onClearTimelineSidebarFields: clearTimelineSidebarFields,
      onClearTimelineLabelFields: clearTimelineLabelFields,
      onSyncLabelMenuScrollFromSidebar: syncLabelMenuScrollFromSidebar,
      onSyncLabelMenuScrollFromBar: syncLabelMenuScrollFromBar,
      onToggleTimelineSidebarField: toggleTimelineSidebarField,
      onToggleTimelineLabelField: toggleTimelineLabelField,
      workItemSyncState: props.workItemSyncState ?? "up_to_date",
      liveSyncEnabled: props.liveSyncEnabled ?? true,
      pendingWorkItemSyncCount: props.pendingWorkItemSyncCount ?? 0,
      onSetLiveSyncEnabled: props.onSetLiveSyncEnabled ?? (() => undefined),
      onPushPendingWorkItemChanges: props.onPushPendingWorkItemChanges ?? (() => undefined),
      onClearPendingWorkItemChanges: props.onClearPendingWorkItemChanges ?? (() => undefined)
    }),
    React.createElement(TimelineFilterPanel, {
      open: timelineFiltersOpen,
      panelRef: filterPanelRef,
      availableFieldRefs,
      timelineFieldFilters,
      openFilterDropdown,
      openFilterFieldOptions,
      openFilterValueOptions,
      effectiveTimelineValueOptionsForFilter: (fieldRef) =>
        filterFieldValueStatsBySearch(listFieldValueStats(effectiveTimeline, fieldRef), ""),
      maxFilterSlots: MAX_TIMELINE_FILTER_SLOTS,
      getFieldDisplayName,
      onSetOpenFilterDropdown: setOpenFilterDropdown,
      onSetFilterFieldSearchDraft: setFilterFieldSearchDraft,
      onSetFilterValueSearchDraft: setFilterValueSearchDraft,
      filterFieldSearchDraft,
      filterValueSearchDraft,
      onApplyFieldFilterSelection: applyFieldFilterSelection,
      onToggleTimelineFieldValueSelection: toggleTimelineFieldValueSelection,
      onToggleVisibleTimelineFieldValueSelections: toggleVisibleTimelineFieldValueSelections,
      onRemoveTimelineFilterSlot: removeTimelineFilterSlot,
      onAddTimelineFilterSlot: addTimelineFilterSlot
    }),
    adoptScheduleError
      ? React.createElement(
          "div",
          {
            role: "status",
            className: "timeline-update-error"
          },
          `Save failed: ${adoptScheduleError}`
        )
      : null,
    React.createElement(TimelineColorCodingPanel, {
      open: colorSettingsOpen,
      colorCoding,
      selectedFieldRef,
      fieldColorCoding,
      selectedFieldValueStats,
      selectedModeValueStats,
      isFieldColorCodingMode,
      isReadOnlyStatusColorCodingMode,
      isOverdueColorCodingMode,
      overdueExcludedStateCodes: resolveOverdueExcludedStateCodes(
        fieldColorCoding.overdueExcludedStateCodes,
        DEFAULT_OVERDUE_EXCLUDED_STATE_CODES
      ),
      onClose: () => {
        setColorSettingsOpen(false);
      },
      onUpdateFieldValueColor: updateFieldValueColor,
      onToggleOverdueExcludedState: toggleOverdueExcludedState,
      resolveSelectedColorCodingLabel,
      toScopedFieldValueColorKey
    }),
    React.createElement(
      "div",
      {
        className: "timeline-main-grid",
        ref: timelineMainGridRef,
        style: timelineMainGridStyle
      },
      React.createElement(
        "div",
        { className: "timeline-main-column timeline-chart-surface" },
        chartModel.bars.length === 0
          ? React.createElement(
              "div",
              { className: "timeline-empty-state" },
              React.createElement("p", { className: "timeline-empty-title" }, "No schedulable timeline bars yet."),
              React.createElement(
                "p",
                { className: "timeline-empty-detail" },
                "Items without start/end dates appear below as unschedulable."
              )
            )
          : React.createElement(
              "div",
              { className: "timeline-chart-viewport-shell" },
              React.createElement(
                "div",
                { className: "timeline-chart-overlay-actions" },
                React.createElement(
                  "button",
                  {
                    type: "button",
                    className: "timeline-chart-fit-button",
                    "aria-label": "Zoom to fit timeline",
                    onClick: zoomToFitTimeline
                  },
                  React.createElement(
                    "svg",
                    {
                      viewBox: "0 0 24 24",
                      className: "timeline-chart-fit-icon",
                      "aria-hidden": "true"
                    },
                    React.createElement("path", {
                      d: "M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4",
                      fill: "none",
                      stroke: "currentColor",
                      strokeWidth: 2,
                      strokeLinecap: "round",
                      strokeLinejoin: "round"
                    })
                  )
                )
              ),
              React.createElement(
                "div",
                {
                  className: [
                    "timeline-chart-scroll",
                    unscheduledCount === 0 ? "timeline-chart-scroll-unscheduled-empty" : "",
                    activeScheduleDrag ? "timeline-chart-scroll-dragging" : "",
                    activePanDrag ? "timeline-chart-scroll-panning" : "",
                    spacePanPressed ? "timeline-chart-scroll-space-pan-ready" : ""
                  ]
                    .filter(Boolean)
                    .join(" "),
                  ref: chartScrollRef,
                  onPointerDown: beginPanDrag,
                  onPointerMove: updatePanDrag,
                  onPointerUp: finishPanDrag,
                  onPointerCancel: finishPanDrag
                },
              React.createElement(
                "div",
                {
                  className: sidebarCollapsed
                    ? "timeline-left-sidebar timeline-left-sidebar-collapsed timeline-left-sidebar-embedded"
                    : "timeline-left-sidebar timeline-left-sidebar-embedded",
                  "aria-label": "Timeline left sidebar",
                  style: { width: `${Math.round(effectiveSidebarWidthPx)}px`, height: `${chartModel.height}px` }
                },
                sidebarCollapsed
                  ? React.createElement(
                      "div",
                      {
                        className: "timeline-left-sidebar-collapsed-body",
                        style: { height: `${chartModel.height}px` }
                      },
                      React.createElement(
                        "button",
                        {
                          type: "button",
                          className: "timeline-left-sidebar-settings-button",
                          "aria-label": "Configure timeline sidebar fields",
                          onClick: openTimelineLabelSettingsFromSidebar
                        },
                        React.createElement(
                          "svg",
                          {
                            viewBox: "0 0 24 24",
                            className: "timeline-left-sidebar-settings-icon",
                            "aria-hidden": "true"
                          },
                          React.createElement("path", {
                            d: "M19.14 12.94a7.98 7.98 0 0 0 .06-.94 7.98 7.98 0 0 0-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54a7.03 7.03 0 0 0-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.84a.5.5 0 0 0 .12.64l2.03 1.58a7.98 7.98 0 0 0-.06.94c0 .32.02.63.06.94L2.83 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.39 1.05.71 1.63.94l.36 2.54a.5.5 0 0 0 .5.42h3.84a.5.5 0 0 0 .5-.42l.36-2.54c.58-.23 1.13-.55 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.2A3.2 3.2 0 1 1 12 8.8a3.2 3.2 0 0 1 0 6.4Z"
                          })
                        )
                      )
                    )
                  : [
                      React.createElement(
                        "div",
                        {
                          className: "timeline-left-sidebar-header",
                          style: { height: `${CHART_TOP_PADDING}px` },
                          key: "header"
                        },
                        React.createElement(
                          "button",
                          {
                            type: "button",
                            className: "timeline-left-sidebar-align-toggle",
                            "aria-label": "Toggle timeline sidebar row alignment",
                            title:
                              timelineSidebarRowJustify === "flex-end"
                                ? "Align sidebar rows left"
                                : "Align sidebar rows right",
                            "aria-pressed": timelineSidebarRowJustify === "flex-end",
                            onClick: () => {
                              const next = timelineSidebarRowJustify === "flex-end" ? "flex-start" : "flex-end";
                              setTimelineSidebarRowJustify(next);
                              saveTimelineSidebarRowJustify(next, activeQueryId);
                            }
                          },
                          React.createElement(
                            "svg",
                            {
                              viewBox: "0 0 24 24",
                              className: "timeline-left-sidebar-align-icon",
                              "aria-hidden": "true"
                            },
                            timelineSidebarRowJustify === "flex-end"
                              ? [
                                  React.createElement("line", { key: "top", x1: "7", y1: "7", x2: "17", y2: "7" }),
                                  React.createElement("line", { key: "middle", x1: "5", y1: "12", x2: "17", y2: "12" }),
                                  React.createElement("line", { key: "bottom", x1: "9", y1: "17", x2: "17", y2: "17" })
                                ]
                              : [
                                  React.createElement("line", { key: "top", x1: "7", y1: "7", x2: "17", y2: "7" }),
                                  React.createElement("line", { key: "middle", x1: "7", y1: "12", x2: "19", y2: "12" }),
                                  React.createElement("line", { key: "bottom", x1: "7", y1: "17", x2: "15", y2: "17" })
                                ]
                          )
                        )
                      ),
                      React.createElement(
                        "div",
                        { className: "timeline-left-sidebar-body", key: "body" },
                        chartModel.bars.map((bar) =>
                          React.createElement(
                            "button",
                            {
                              key: `timeline-sidebar-row-${bar.workItemId}`,
                              type: "button",
                              className: [
                                "timeline-left-sidebar-row",
                                selectedWorkItemId === bar.workItemId ? "timeline-left-sidebar-row-selected" : "",
                                reparentDrag.dragState.sourceWorkItemId === bar.workItemId ? "timeline-sidebar-row-dragging" : "",
                                reparentDrag.dragState.dropTargetWorkItemId === bar.workItemId && reparentDrag.dragState.isValid
                                  ? "timeline-sidebar-row-drop-target"
                                  : "",
                                reparentDrag.dragState.dropTargetWorkItemId === bar.workItemId && !reparentDrag.dragState.isValid && reparentDrag.dragState.sourceWorkItemId !== null
                                  ? "timeline-sidebar-row-drop-invalid"
                                  : "",
                                bar.treeBlockStart ? "timeline-sidebar-row-block-start" : "",
                                bar.treeBlockEnd ? "timeline-sidebar-row-block-end" : ""
                              ].filter(Boolean).join(" "),
                              "aria-label": `timeline-sidebar-row-${bar.workItemId}`,
                              draggable: isTreeQuery && Boolean(props.onReparentWorkItem),
                              style: {
                                height: `${CHART_ROW_HEIGHT}px`,
                                justifyContent: timelineSidebarRowJustify,
                                "--timeline-row-selection-color": bar.color
                              },
                              onClick: () => {
                                toggleWorkItemSelection(bar.workItemId);
                              },
                              onDragStart: isTreeQuery && props.onReparentWorkItem
                                ? (event: React.DragEvent) => {
                                    event.dataTransfer.effectAllowed = "move";
                                    event.dataTransfer.setData("text/plain", String(bar.workItemId));
                                    reparentDrag.startDrag(bar.workItemId);
                                  }
                                : undefined,
                              onDragOver: isTreeQuery && props.onReparentWorkItem
                                ? (event: React.DragEvent) => {
                                    reparentDrag.updateDropTarget(bar.workItemId);
                                    if (reparentDrag.dragState.isValid || reparentDrag.dragState.sourceWorkItemId === null) {
                                      event.preventDefault();
                                      event.dataTransfer.dropEffect = "move";
                                    }
                                  }
                                : undefined,
                              onDragLeave: isTreeQuery ? () => {
                                reparentDrag.updateDropTarget(null);
                              } : undefined,
                              onDrop: isTreeQuery && props.onReparentWorkItem
                                ? (event: React.DragEvent) => {
                                    event.preventDefault();
                                    const result = reparentDrag.executeDrop();
                                    reparentDrag.clearDrag();
                                    if (result && props.onReparentWorkItem) {
                                      void props.onReparentWorkItem(result);
                                    }
                                  }
                                : undefined,
                              onDragEnd: isTreeQuery ? () => {
                                reparentDrag.clearDrag();
                              } : undefined
                            },
                            bar.treeDepth !== null && bar.treeDepth > 0
                              ? buildTreeIndentGuides(bar)
                              : null,
                            bar.treeHasChildren
                              ? React.createElement(
                                  "span",
                                  {
                                    className: "timeline-tree-toggle",
                                    role: "button",
                                    "aria-label": bar.treeIsCollapsed ? "Expand" : "Collapse",
                                    onClick: (event: React.MouseEvent) => {
                                      event.stopPropagation();
                                      treeState.toggle(bar.workItemId);
                                    }
                                  },
                                  bar.treeIsCollapsed ? "\u25B6" : "\u25BC"
                                )
                              : bar.treeDepth !== null
                                ? React.createElement("span", { className: "timeline-tree-toggle-placeholder" })
                                : null,
                            buildTimelineSidebarLabel(bar, timelineSidebarFields)
                          )
                        ),
                        React.createElement("div", {
                          className: "timeline-left-sidebar-tail-spacer",
                          "aria-hidden": "true",
                          style: { height: `${chartModel.tailHeightPx}px` }
                        })
                      )
                    ]
              ),
              !sidebarCollapsed
                ? React.createElement(TimelineMainSplitter, {
                    active: isSidebarResizing,
                    embedded: true,
                    ariaLabel: "Resize timeline sidebar",
                    ariaValueMin: TIMELINE_SIDEBAR_MIN_WIDTH_PX,
                    ariaValueMax: resolveTimelineSidebarMaxWidthPx(timelineMainGridRef.current, detailsWidthPx),
                    ariaValueNow: sidebarWidthPx,
                    onPointerDown: beginSidebarResize,
                    style: { height: `${chartModel.height}px`, left: `${Math.round(effectiveSidebarWidthPx)}px` }
                  })
                : null,
              React.createElement(
                "svg",
                {
                  className: "timeline-shared-row-guides",
                  viewBox: `0 0 ${effectiveSidebarWidthPx + chartModel.width} ${chartModel.height}`,
                  style: { width: `${effectiveSidebarWidthPx + chartModel.width}px`, height: `${chartModel.height}px` },
                  "aria-hidden": "true"
                },
                Array.from({ length: chartModel.contentRows + 1 }, (_, index) =>
                  React.createElement("line", {
                    key: `shared-row-guide-${index}`,
                    x1: 0,
                    y1: CHART_TOP_PADDING + index * CHART_ROW_HEIGHT,
                    x2: effectiveSidebarWidthPx + chartModel.width,
                    y2: CHART_TOP_PADDING + index * CHART_ROW_HEIGHT,
                    className: "timeline-row-guide-line"
                  })
                )
              ),
              React.createElement(
                "div",
                {
                  className: "timeline-chart-main-lane",
                  ref: mainLaneRef,
                  style: { width: `${chartModel.width}px` }
                },
              React.createElement(
                "div",
                { className: "timeline-chart-axis-sticky", "aria-hidden": "true" },
                React.createElement(
                  "svg",
                  {
                    className: "timeline-chart-axis",
                    width: chartModel.width,
                    height: CHART_TOP_PADDING,
                    viewBox: `0 0 ${chartModel.width} ${CHART_TOP_PADDING}`,
                    preserveAspectRatio: "none",
                    style: { width: `${chartModel.width}px`, height: `${CHART_TOP_PADDING}px` }
                  },
                  (zoomLevel === "year"
                    ? chartModel.yearMarkers
                    : zoomLevel === "quarter"
                      ? chartModel.yearMarkers
                      : chartModel.monthMarkers
                  ).map((marker) =>
                    React.createElement(
                      "text",
                      {
                        key: `sticky-top-label-${marker.x}-${marker.label}`,
                        x: CHART_LEFT_GUTTER + marker.x,
                        y: CHART_AXIS_MONTH_LABEL_Y,
                        className: "timeline-axis-month-label"
                      },
                      marker.label
                    )
                  ),
                  (zoomLevel === "week"
                    ? chartModel.weekMarkers
                    : zoomLevel === "quarter"
                      ? chartModel.quarterMarkers
                      : zoomLevel === "year"
                        ? chartModel.quarterMarkers
                        : []
                  ).map((tick) =>
                    React.createElement(
                      "text",
                      {
                        key: `sticky-tick-label-${tick.x}-${tick.label}`,
                        x: CHART_LEFT_GUTTER + tick.x + CHART_AXIS_TICK_LABEL_X_OFFSET,
                        y: CHART_AXIS_TICK_LABEL_Y,
                        className: "timeline-axis-label"
                      },
                      tick.label
                    )
                  ),
                  chartModel.todayX !== null
                    ? React.createElement(
                        "text",
                        {
                          x: CHART_LEFT_GUTTER + chartModel.todayX,
                          y: CHART_AXIS_TODAY_LABEL_Y,
                          className: "timeline-today-label"
                        },
                        "Today"
                      )
                    : null
                )
              ),
              React.createElement(
                "svg",
                {
                  className:
                    activeUnschedulableDrag && !activeScheduleDrag
                      ? "timeline-chart timeline-chart-unscheduled-drop-active"
                      : "timeline-chart",
                  width: chartModel.width,
                  height: chartModel.height,
                  viewBox: `0 0 ${chartModel.width} ${chartModel.height}`,
                  preserveAspectRatio: "none",
                  role: "img",
                  "aria-label": "gantt-chart",
                  style: { width: `${chartModel.width}px`, height: `${chartModel.height}px` },
                  ref: chartSvgRef,
                  onPointerMove: handleChartPointerMove,
                  onPointerUp: finishActiveDrag,
                  onPointerCancel: finishActiveDrag,
                  onDragOver: handleChartDragOver,
                  onDrop: handleChartDrop
                },
                React.createElement(
                  "defs",
                  null,
                  React.createElement(
                    "marker",
                    {
                      id: dependencyMarkerId,
                      viewBox: "0 0 6 8",
                      refX: 5.6,
                      refY: 4,
                      markerWidth: 6,
                      markerHeight: 6,
                      markerUnits: "strokeWidth",
                      orient: "auto"
                    },
                    React.createElement("path", {
                      d: "M 0 0 L 6 4 L 0 8",
                      className: "timeline-dependency-arrowhead"
                    })
                  ),
                  React.createElement(
                    "marker",
                    {
                      id: dependencyAlertMarkerId,
                      viewBox: "0 0 6 8",
                      refX: 5.6,
                      refY: 4,
                      markerWidth: 6,
                      markerHeight: 6,
                      markerUnits: "strokeWidth",
                      orient: "auto"
                    },
                    React.createElement("path", {
                      d: "M 0 0 L 6 4 L 0 8",
                      className: "timeline-dependency-arrowhead-alert"
                    })
                  )
                ),
                buildTreeDepthBandsAndBorders(chartModel.bars, chartModel.width),
                chartModel.currentPeriod
                  ? React.createElement("rect", {
                      x: CHART_LEFT_GUTTER + chartModel.currentPeriod.x,
                      y: CHART_GRID_START_Y,
                      width: chartModel.currentPeriod.width,
                      height: chartModel.height - CHART_BOTTOM_PADDING - CHART_GRID_START_Y,
                      className: "timeline-current-period-highlight"
                    })
                  : null,
                (zoomLevel === "week" || zoomLevel === "month"
                  ? chartModel.weekendBands
                  : []
                ).map((band) =>
                  React.createElement("rect", {
                    key: `timeline-weekend-band-${band.date}`,
                    x: CHART_LEFT_GUTTER + band.x,
                    y: CHART_GRID_START_Y,
                    width: band.width,
                    height: chartModel.height - CHART_BOTTOM_PADDING - CHART_GRID_START_Y,
                    className: "timeline-weekend-band",
                    "data-date": band.date
                  })
                ),
                chartModel.dailyGridLines.map((dayX) =>
                  React.createElement("line", {
                    key: `day-grid-${dayX}`,
                    x1: CHART_LEFT_GUTTER + dayX,
                    y1: CHART_GRID_START_Y,
                    x2: CHART_LEFT_GUTTER + dayX,
                    y2: chartModel.height - CHART_BOTTOM_PADDING,
                    className: "timeline-grid-line-day"
                  })
                ),
                (zoomLevel === "month" ? chartModel.weekMarkers : []).map((week) =>
                  React.createElement("line", {
                    key: `month-week-grid-${week.x}`,
                    x1: CHART_LEFT_GUTTER + week.x,
                    y1: CHART_GRID_START_Y,
                    x2: CHART_LEFT_GUTTER + week.x,
                    y2: chartModel.height - CHART_BOTTOM_PADDING,
                    className: "timeline-grid-line-weekly"
                  })
                ),
                (zoomLevel === "quarter" || zoomLevel === "year"
                  ? chartModel.monthMarkers
                  : []
                ).map((month) =>
                  React.createElement("line", {
                    key: `quarter-month-grid-${month.x}`,
                    x1: CHART_LEFT_GUTTER + month.x,
                    y1: CHART_GRID_START_Y,
                    x2: CHART_LEFT_GUTTER + month.x,
                    y2: chartModel.height - CHART_BOTTOM_PADDING,
                    className: "timeline-grid-line-weekly"
                  })
                ),
                (zoomLevel === "year"
                  ? chartModel.quarterMarkers
                  : zoomLevel === "quarter"
                    ? chartModel.quarterMarkers
                    : chartModel.monthMarkers
                ).map((marker) =>
                  React.createElement("line", {
                    key: `boundary-${marker.x}-${marker.label}`,
                    x1: CHART_LEFT_GUTTER + marker.x,
                    y1: CHART_GRID_START_Y,
                    x2: CHART_LEFT_GUTTER + marker.x,
                    y2: chartModel.height - CHART_BOTTOM_PADDING,
                    className: "timeline-month-boundary-line"
                  })
                ),
                (zoomLevel === "week" ? chartModel.weekMarkers : []).map((tick) =>
                  React.createElement(
                    "g",
                    { key: `${tick.x}-${tick.label}` },
                    React.createElement("line", {
                      x1: CHART_LEFT_GUTTER + tick.x,
                      y1: CHART_GRID_START_Y,
                      x2: CHART_LEFT_GUTTER + tick.x,
                      y2: chartModel.height - CHART_BOTTOM_PADDING,
                      className: "timeline-grid-line"
                    })
                  )
                ),
                chartModel.todayX !== null
                  ? React.createElement(
                      "g",
                      null,
                      React.createElement("line", {
                        x1: CHART_LEFT_GUTTER + chartModel.todayX,
                        y1: CHART_GRID_START_Y,
                        x2: CHART_LEFT_GUTTER + chartModel.todayX,
                        y2: chartModel.height - CHART_BOTTOM_PADDING,
                        className: "timeline-today-line"
                      })
                    )
                  : null,
                chartModel.bars.map((bar, index) => {
                  if (selectedWorkItemId !== bar.workItemId) {
                    return null;
                  }
                  return React.createElement("rect", {
                    key: `timeline-row-highlight-${bar.workItemId}`,
                    x: 0,
                    y: CHART_TOP_PADDING + index * CHART_ROW_HEIGHT,
                    width: chartModel.width,
                    height: CHART_ROW_HEIGHT,
                    fill: `color-mix(in srgb, ${bar.color} 14%, transparent)`,
                    pointerEvents: "none"
                  });
                }),
                chartModel.bars.map((bar, index) => {
                  const y = resolveTimelineBarTopY(index);
                  const isSelected = selectedWorkItemId === bar.workItemId;
                  const isDependencyHovered = hoveredDependencyWorkItemIds !== null && hoveredDependencyWorkItemIds.has(bar.workItemId);
                  const barClassName = ["timeline-bar", isSelected ? "timeline-bar-selected" : "", canEditSchedule ? "timeline-bar-editable" : "", isDependencyHovered ? "timeline-bar-dependency-hover" : ""]
                    .filter(Boolean)
                    .join(" ");
                  return React.createElement(
                    "g",
                    { key: bar.workItemId },
                    React.createElement("rect", {
                      x: CHART_LEFT_GUTTER + bar.x,
                      y,
                      width: bar.width,
                      height: BAR_HEIGHT,
                      rx: 6,
                      className: barClassName,
                      style: { fill: bar.color },
                      role: "button",
                      tabIndex: 0,
                      "aria-label": `timeline-bar-${bar.workItemId}`,
                      "aria-current": isSelected ? "true" : undefined,
                      onClick: () => {
                        if (suppressNextBarClickRef.current) {
                          suppressNextBarClickRef.current = false;
                          barPointerSelectionIntentRef.current = null;
                          return;
                        }
                        const pointerSelectionIntent = barPointerSelectionIntentRef.current;
                        barPointerSelectionIntentRef.current = null;
                        if (pointerSelectionIntent?.workItemId === bar.workItemId) {
                          selectWorkItem(pointerSelectionIntent.wasSelected ? null : bar.workItemId);
                          return;
                        }
                        toggleWorkItemSelection(bar.workItemId);
                      },
                      onKeyDown: (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          toggleWorkItemSelection(bar.workItemId);
                        }
                      },
                      onPointerDown: (event) => {
                        if (spacePanPressedRef.current) {
                          return;
                        }
                        suppressNextBarClickRef.current = false;
                        barPointerSelectionIntentRef.current = {
                          workItemId: bar.workItemId,
                          wasSelected: selectedWorkItemId === bar.workItemId
                        };
                        if (dependencyMode) {
                          beginDependencyDrag({ event, sourceWorkItemId: bar.workItemId });
                          return;
                        }
                        void beginBarDrag({ event, mode: "move", bar });
                      }
                    }),
                    canEditSchedule
                      ? React.createElement("rect", {
                          x: CHART_LEFT_GUTTER + bar.x - HANDLE_WIDTH / 2,
                          y: y + 1,
                          width: HANDLE_WIDTH,
                          height: BAR_HEIGHT - 2,
                          rx: 2,
                          className: "timeline-bar-handle timeline-bar-handle-start",
                          "aria-label": `timeline-bar-start-handle-${bar.workItemId}`,
                          onPointerDown: (event) => {
                            if (spacePanPressedRef.current) {
                              return;
                            }
                            void beginBarDrag({ event, mode: "resize-start", bar });
                          }
                        })
                      : null,
                    canEditSchedule
                      ? React.createElement("rect", {
                          x: CHART_LEFT_GUTTER + bar.x + bar.width - HANDLE_WIDTH / 2,
                          y: y + 1,
                          width: HANDLE_WIDTH,
                          height: BAR_HEIGHT - 2,
                          rx: 2,
                          className: "timeline-bar-handle timeline-bar-handle-end",
                          "aria-label": `timeline-bar-end-handle-${bar.workItemId}`,
                          onPointerDown: (event) => {
                            if (spacePanPressedRef.current) {
                              return;
                            }
                            void beginBarDrag({ event, mode: "resize-end", bar });
                          }
                        })
                      : null,
                    bar.displayLabel.trim().length > 0
                      ? React.createElement(
                          "text",
                          {
                            x: CHART_LEFT_GUTTER + bar.x + 18,
                            y: y + 16,
                            className: ["timeline-bar-label", isSelected ? "timeline-bar-label-selected" : ""].filter(Boolean).join(" ")
                          },
                          truncateTitleToBarWidth(bar.displayLabel, bar.width)
                        )
                      : null,
                    React.createElement("circle", {
                      cx: CHART_LEFT_GUTTER + bar.x + 10,
                      cy: y + BAR_HEIGHT / 2,
                      r: 4.5,
                      className: "timeline-bar-state-dot",
                      style: { fill: bar.stateColor }
                    })
                  );
                }),
                activeUnschedulableDrag && unscheduledDropPreview
                  ? React.createElement(
                      "g",
                      {
                        className: "timeline-unscheduled-drop-preview"
                      },
                      React.createElement("rect", {
                        x: CHART_LEFT_GUTTER + dayDiff(chartModel.domainStart, unscheduledDropPreview.startDate) * chartModel.dayWidthPx,
                        y: CHART_TOP_PADDING + chartModel.bars.length * CHART_ROW_HEIGHT + 8,
                        width: dayDiffInclusive(unscheduledDropPreview.startDate, unscheduledDropPreview.endDate) * chartModel.dayWidthPx,
                        height: BAR_HEIGHT,
                        rx: 6,
                        className: "timeline-unscheduled-drop-preview-bar"
                      }),
                      React.createElement(
                        "text",
                        {
                          x: CHART_LEFT_GUTTER + dayDiff(chartModel.domainStart, unscheduledDropPreview.startDate) * chartModel.dayWidthPx + 8,
                          y: CHART_TOP_PADDING + chartModel.bars.length * CHART_ROW_HEIGHT + 24,
                          className: "timeline-unscheduled-drop-preview-label"
                        },
                        `${formatTickDate(unscheduledDropPreview.startDate)} → ${formatTickDate(unscheduledDropPreview.endDate)} (${dayDiffInclusive(unscheduledDropPreview.startDate, unscheduledDropPreview.endDate)}d)`
                      )
                    )
                  : null,
                dependencyConnectors.map((connector) => {
                  const isSelected =
                    selectedDependency?.predecessorWorkItemId === connector.predecessorWorkItemId &&
                    selectedDependency?.successorWorkItemId === connector.successorWorkItemId &&
                    selectedDependency?.dependencyType === connector.dependencyType;
                  const isHovered = hoveredDependencyKey === connector.key;
                  const className = [
                    "timeline-dependency-line",
                    connector.isViolated ? "timeline-dependency-line-violated" : "",
                    isSelected ? "timeline-dependency-line-selected" : "",
                    isHovered ? "timeline-dependency-line-hovered" : ""
                  ]
                    .filter(Boolean)
                    .join(" ");
                  const hoverHandlers = {
                    onPointerEnter: () => setHoveredDependencyKey(connector.key),
                    onPointerLeave: () => setHoveredDependencyKey((prev) => prev === connector.key ? null : prev)
                  };
                  return React.createElement(
                    "g",
                    {
                      key: connector.key,
                      "aria-label": `dependency-${connector.predecessorWorkItemId}-${connector.successorWorkItemId}`,
                      onClick: () => {
                        setSelectedDependency({
                          predecessorWorkItemId: connector.predecessorWorkItemId,
                          successorWorkItemId: connector.successorWorkItemId,
                          dependencyType: connector.dependencyType
                        });
                      }
                    },
                    React.createElement("path", {
                      d: connector.path,
                      className: "timeline-dependency-line-hitarea",
                      ...hoverHandlers
                    }),
                    React.createElement("path", {
                      d: connector.path,
                      className,
                      markerEnd: connector.markerEnd,
                      pointerEvents: "none"
                    })
                  );
                }),
                activeDependencyDragPreview
                  ? React.createElement("path", {
                      d: activeDependencyDragPreview.path,
                      className: "timeline-dependency-line timeline-dependency-line-draft",
                      markerEnd: `url(#${dependencyMarkerId})`,
                      "aria-label": "dependency-draft"
                    })
                  : null
              )
              )
              )
            ),
        React.createElement(
          "div",
          {
            className: [
              "timeline-unschedulable-list",
              visibleTimeline?.unschedulable.length ? "" : "timeline-unschedulable-list-empty"
            ]
              .filter(Boolean)
              .join(" ")
          },
          React.createElement(
            "div",
            { className: "timeline-unschedulable-header" },
            React.createElement("h4", null, "Unscheduled")
          ),
          visibleTimeline?.unschedulable.length
            ? React.createElement(
                "ul",
                null,
                ...visibleTimeline.unschedulable.map((item) =>
                  React.createElement(
                    "li",
                    {
                      key: item.workItemId,
                      style: (() => {
                        const treeMeta = visibleTimeline.treeLayout?.[item.workItemId];
                        return treeMeta ? { paddingLeft: `${treeMeta.depth * 20}px` } : undefined;
                      })()
                    },
                    (() => {
                      const label = `#${item.details.mappedId} ${item.title}`;
                      const minWidthPx = Math.round(dayWidthPx * 14);
                      const estimatedLabelWidthPx = Math.round(label.length * APPROX_BAR_LABEL_CHAR_WIDTH_PX + 20);
                      const buttonWidthPx = Math.max(minWidthPx, estimatedLabelWidthPx);

                      return React.createElement(
                        "button",
                        {
                          type: "button",
                          className: "timeline-unschedulable-button",
                          style: {
                            backgroundColor: colorByWorkItemId.get(item.workItemId) ?? item.state.color,
                            width: `${buttonWidthPx}px`,
                            maxWidth: "100%"
                          },
                          "aria-label": label,
                          "aria-pressed": selectedWorkItemId === item.workItemId,
                          draggable: !dependencyMode,
                          onDragStart: (event) => {
                            startUnscheduledDrag(event, item.workItemId, resolveUnschedulableFixedEndDate(item));
                          },
                          onDragEnd: () => {
                            clearUnscheduledDrag();
                          },
                          onClick: () => {
                            setAdoptScheduleError(null);
                            if (!dependencyMode && selectedWorkItemId !== null) {
                              void adoptUnschedulableSchedule(item.workItemId, selectedWorkItemId).catch((error) => {
                                const message = error instanceof Error ? error.message : "Unknown error";
                                setAdoptScheduleError(message);
                              });
                            }
                            toggleWorkItemSelection(item.workItemId);
                          }
                        },
                        React.createElement(
                          "span",
                          { className: "timeline-unschedulable-button-main" },
                          React.createElement(
                            "span",
                            { className: "timeline-unschedulable-item-title timeline-unschedulable-item-title-like-bar" },
                            label
                          )
                        )
                      );
                    })()
                  )
                )
              )
            : React.createElement("p", { className: "timeline-unschedulable-empty" }, "None")
        )
      ),
      React.createElement(
        TimelineMainSplitter,
        {
          active: isDetailsResizing,
          ariaLabel: detailsContentHidden ? "Expand details panel" : "Resize details panel",
          ariaValueMin: DETAILS_PANEL_MIN_WIDTH_PX,
          ariaValueMax: resolveTimelineDetailsMaxWidthPx(timelineMainGridRef.current, effectiveSidebarWidthPx),
          ariaValueNow: detailsWidthPx,
          onPointerDown: beginDetailsResize,
          onClick: toggleDetailsPanelFromSplitter,
          style: timelineMainSplitterStyle
        },
        detailsContentHidden
          ? React.createElement(
              "span",
              { className: "timeline-main-splitter-expand-symbol", "aria-hidden": "true" },
              React.createElement(
                "svg",
                {
                  className: "timeline-main-splitter-expand-icon",
                  viewBox: "0 0 16 16",
                  "aria-hidden": "true"
                },
                React.createElement("path", {
                  d: "M10.5 3.5 6 8l4.5 4.5",
                  fill: "none",
                  stroke: "currentColor",
                  strokeWidth: "2.2",
                  strokeLinecap: "round",
                  strokeLinejoin: "round"
                })
              )
            )
          : React.createElement(
              "span",
              { className: "timeline-main-splitter-collapse-symbol", "aria-hidden": "true" },
              React.createElement(
                "svg",
                {
                  className: "timeline-main-splitter-expand-icon",
                  viewBox: "0 0 16 16",
                  "aria-hidden": "true"
                },
                React.createElement("path", {
                  d: "M5.5 3.5 10 8l-4.5 4.5",
                  fill: "none",
                  stroke: "currentColor",
                  strokeWidth: "2.2",
                  strokeLinecap: "round",
                  strokeLinejoin: "round"
                })
              )
            )
      ),
      React.createElement(TimelineDetailsPanel, detailProps)
    )
  );
}

const BAR_HEIGHT = 24;
const BAR_ROW_GAP = 2;
const CHART_ROW_HEIGHT = BAR_HEIGHT + BAR_ROW_GAP;
const BAR_ROW_TOP_INSET_PX = Math.max(0, Math.floor((CHART_ROW_HEIGHT - BAR_HEIGHT) / 2));
const CHART_TOP_PADDING = 64;
const CHART_BOTTOM_PADDING = 18;
const CHART_LEFT_GUTTER = 24;
const CHART_RIGHT_PADDING_PX = 80;
const CHART_AXIS_TODAY_LABEL_Y = CHART_TOP_PADDING - 46;
const CHART_AXIS_MONTH_LABEL_Y = CHART_TOP_PADDING - 32;
const CHART_AXIS_TICK_LABEL_Y = CHART_TOP_PADDING - 16;
const CHART_AXIS_TICK_LABEL_X_OFFSET = 0;
const CHART_GRID_START_Y = CHART_TOP_PADDING - 10;
const TODAY_INITIAL_VIEWPORT_RATIO = 0.38;
const DAY_WIDTH_WEEK_PX = 22;
const DAY_WIDTH_MONTH_PX = 8;
const DAY_WIDTH_QUARTER_PX = 3;
const DAY_WIDTH_YEAR_PX = 1;
const DAY_WIDTH_MAX_PX = 40;
const DAY_WIDTH_MIN_PX = 0.5;
const ZOOM_WHEEL_SENSITIVITY = 0.005;
const ZOOM_DAY_WIDTH_STEP_PX = 0.25;
const DAY_WIDTH_WEEK_MONTH_SWITCH_PX = (DAY_WIDTH_WEEK_PX + DAY_WIDTH_MONTH_PX) / 2;
const DAY_WIDTH_MONTH_QUARTER_SWITCH_PX = (DAY_WIDTH_MONTH_PX + DAY_WIDTH_QUARTER_PX) / 2;
const DAY_WIDTH_QUARTER_YEAR_SWITCH_PX = (DAY_WIDTH_QUARTER_PX + DAY_WIDTH_YEAR_PX) / 2;
const ZOOM_LEVEL_HYSTERESIS_PX = 0.6;
const ZOOM_COMMIT_DELAY_MS = 120;
const FIT_TO_VIEW_INSET_PX = 20;
const FIT_TO_VIEW_SIDE_PADDING_DAYS = 1;
const VIEWPORT_PERSIST_DEBOUNCE_MS = 220;
const DETAILS_PANEL_DEFAULT_WIDTH_PX = 320;
const DETAILS_PANEL_MIN_WIDTH_PX = 0;
const DETAILS_PANEL_MAX_WIDTH_PX = 820;
const DETAILS_PANEL_SPLITTER_WIDTH_PX = 10;
const TIMELINE_MAIN_SPLITTER_WIDTH_PX = 10;
const DETAILS_PANEL_MIN_CHART_WIDTH_PX = 360;
const DETAILS_PANEL_CONTENT_MIN_WIDTH_PX = 260;
const TIMELINE_SIDEBAR_DEFAULT_WIDTH_PX = 260;
const TIMELINE_SIDEBAR_MIN_WIDTH_PX = 160;
const TIMELINE_SIDEBAR_MAX_WIDTH_PX = 640;
const TIMELINE_SIDEBAR_COLLAPSED_WIDTH_PX = 56;
const MIN_BAR_WIDTH_PX = 10;
const HANDLE_WIDTH = 8;
const DEFAULT_UNSCHEDULED_DURATION_DAYS = 14;
const BAR_LABEL_HORIZONTAL_PADDING = 8;
const APPROX_BAR_LABEL_CHAR_WIDTH_PX = 6.5;
const DEFAULT_NEUTRAL_TIMELINE_COLOR = "#374151";
const OVERDUE_TIMELINE_COLOR = "#b91c1c";
const OVERDUE_OK_TIMELINE_COLOR = "#475569";
const DEPENDENCY_ENDPOINT_GAP_PX = 6;
const DEPENDENCY_POINTER_SEGMENT_MIN_PX = 14;
const DEPENDENCY_LANE_ENTRY_MIN_PX = 12;
const MAX_TIMELINE_FILTER_SLOTS = 5;
const TIMELINE_FILTERS_QUERY_PARAM = "tf";
const LEGACY_TIMELINE_FILTERS_QUERY_PARAM = "timelineFilters";
const TIMELINE_LABEL_SPECIAL_FIELD_REFS = {
  title: "title",
  mappedId: "mappedId",
  state: "state"
} as const;
const TIMELINE_CATEGORY_COLORS = [
  "#1d4ed8",
  "#0f766e",
  "#7c3aed",
  "#be123c",
  "#b45309",
  "#0369a1",
  "#166534",
  "#7e22ce",
  "#c2410c",
  "#365314",
  "#334155",
  "#0f766e"
];

type FieldValueStat = {
  key: string;
  label: string;
  count: number;
  defaultColor: string;
};

type BarGeometry = {
  x: number;
  y: number;
  width: number;
  midY: number;
};

type PathPoint = {
  x: number;
  y: number;
};

type VisualTimelineBar = {
  workItemId: number;
  mappedId: string;
  title: string;
  displayLabel: string;
  stateCode: string;
  color: string;
  stateColor: string;
  stateBadge: string;
  fieldValues: Record<string, string | number | null>;
  x: number;
  width: number;
  start: Date;
  end: Date;
  treeDepth: number | null;
  treeHasChildren: boolean;
  treeIsCollapsed: boolean;
  treeIsLastSibling: boolean;
  treeAncestorIsLastSibling: boolean[];
  treeBlockStart: boolean;
  treeBlockEnd: boolean;
};

type VisualDependencyConnector = {
  key: string;
  path: string;
  markerEnd: string;
  predecessorWorkItemId: number;
  successorWorkItemId: number;
  dependencyType: "FS";
  isViolated: boolean;
};


type VisualChartModel = {
  width: number;
  height: number;
  contentRows: number;
  tailHeightPx: number;
  dayWidthPx: number;
  bars: VisualTimelineBar[];
  weekendBands: { x: number; width: number; date: string }[];
  weekMarkers: { x: number; label: string }[];
  dailyGridLines: number[];
  monthMarkers: { x: number; label: string }[];
  quarterMarkers: { x: number; label: string }[];
  yearMarkers: { x: number; label: string }[];
  domainStart: Date;
  currentPeriod: { x: number; width: number } | null;
  todayX: number | null;
};

function buildVisualChartModel(
  timeline: TimelineReadModel | null,
  dayWidthPx: number,
  zoomLevel: TimelineZoomLevel,
  colorByWorkItemId: ReadonlyMap<number, string>,
  viewportWidthPx: number,
  timelineLabelFields: string[],
  includeUnscheduledDropLane: boolean,
  collapsedIds?: ReadonlySet<number>
): VisualChartModel {
  if (!timeline || timeline.bars.length === 0) {
    const todayUtc = new Date();
    const normalizedTodayUtc = new Date(
      Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate())
    );
    return {
      width: 900,
      height: 180,
      contentRows: 0,
      tailHeightPx: CHART_BOTTOM_PADDING,
      dayWidthPx,
      bars: [],
      weekendBands: [],
      weekMarkers: [],
      dailyGridLines: [],
      monthMarkers: [],
      quarterMarkers: [],
      yearMarkers: [],
      domainStart: addDays(normalizedTodayUtc, -1),
      currentPeriod: null,
      todayX: null
    };
  }

  const normalizedBars = timeline.bars
    .map((bar) => {
      const start = parseIso(bar.schedule.startDate);
      const end = parseIso(bar.schedule.endDate);
      if (!start && !end) {
        return null;
      }

      const normalizedStart = start ?? addDays(end as Date, -(DEFAULT_UNSCHEDULED_DURATION_DAYS - 1));
      const normalizedEnd = end ?? addDays(start as Date, 2);
      const rangeStart = normalizedStart.getTime() <= normalizedEnd.getTime() ? normalizedStart : normalizedEnd;
      const rangeEnd = normalizedEnd.getTime() >= normalizedStart.getTime() ? normalizedEnd : normalizedStart;

      return {
        source: bar,
        start: rangeStart,
        end: rangeEnd
      };
    })
    .filter((bar): bar is { source: TimelineReadModel["bars"][number]; start: Date; end: Date } => bar !== null);

  if (normalizedBars.length === 0) {
    const todayUtc = new Date();
    const normalizedTodayUtc = new Date(
      Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate())
    );
    return {
      width: 900,
      height: 180,
      contentRows: 0,
      tailHeightPx: CHART_BOTTOM_PADDING,
      dayWidthPx,
      bars: [],
      weekendBands: [],
      weekMarkers: [],
      dailyGridLines: [],
      monthMarkers: [],
      quarterMarkers: [],
      yearMarkers: [],
      domainStart: addDays(normalizedTodayUtc, -1),
      currentPeriod: null,
      todayX: null
    };
  }

  const minStart = new Date(Math.min(...normalizedBars.map((bar) => bar.start.getTime())));
  const maxEnd = new Date(Math.max(...normalizedBars.map((bar) => bar.end.getTime())));
  const domainStart = addDays(minStart, -1);
  const domainEnd = addDays(maxEnd, 1);
  const timelineCanvasMinWidthPx = Math.max(0, viewportWidthPx - CHART_LEFT_GUTTER - CHART_RIGHT_PADDING_PX);
  const minDaysForViewport = Math.ceil(timelineCanvasMinWidthPx / dayWidthPx);
  const totalDays = Math.max(1, dayDiffInclusive(domainStart, domainEnd), minDaysForViewport);
  const todayUtc = new Date();
  const normalizedTodayUtc = new Date(
    Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate())
  );
  const todayOffset = dayDiff(domainStart, normalizedTodayUtc);
  const todayVisible = todayOffset >= 0 && todayOffset <= totalDays;
  const todayX = todayVisible ? (todayOffset + 0.5) * dayWidthPx : null;

  const currentPeriodStart = startOfIsoWeekUtc(normalizedTodayUtc);
  const currentPeriodEnd = addDays(currentPeriodStart, 6);
  const currentPeriodStartOffset = dayDiff(domainStart, currentPeriodStart);
  const currentPeriodEndOffset = dayDiff(domainStart, currentPeriodEnd);
  const visiblePeriodStart = Math.max(0, currentPeriodStartOffset);
  const visiblePeriodEndExclusive = Math.min(totalDays, currentPeriodEndOffset + 1);
  const currentPeriod =
    visiblePeriodEndExclusive > visiblePeriodStart
      ? {
          x: visiblePeriodStart * dayWidthPx,
          width: (visiblePeriodEndExclusive - visiblePeriodStart) * dayWidthPx
        }
      : null;
  const weekendBands = buildWeekendBands(domainStart, totalDays, dayWidthPx);

  const bars = normalizedBars.map((bar) => {
    const startOffset = dayDiff(domainStart, bar.start);
    const spanDays = Math.max(1, dayDiffInclusive(bar.start, bar.end));
    const treeMeta = timeline.treeLayout?.[bar.source.workItemId] ?? null;
    return {
      workItemId: bar.source.workItemId,
      mappedId: bar.source.details.mappedId,
      title: bar.source.title,
      displayLabel: buildTimelineBarLabel(bar.source, timelineLabelFields),
      stateCode: bar.source.state.code,
      color: colorByWorkItemId.get(bar.source.workItemId) ?? bar.source.state.color,
      stateColor: bar.source.state.color,
      stateBadge: bar.source.state.badge,
      fieldValues: bar.source.details.fieldValues ?? {},
      start: bar.start,
      end: bar.end,
      x: startOffset * dayWidthPx,
      width: Math.max(MIN_BAR_WIDTH_PX, spanDays * dayWidthPx),
      treeDepth: treeMeta?.depth ?? null,
      treeHasChildren: treeMeta?.hasChildren ?? false,
      treeIsCollapsed: treeMeta?.hasChildren ? (collapsedIds?.has(bar.source.workItemId) ?? false) : false,
      treeIsLastSibling: treeMeta?.isLastSibling ?? false,
      treeAncestorIsLastSibling: treeMeta?.ancestorIsLastSibling ?? [],
      treeBlockStart: false,
      treeBlockEnd: false
    };
  });

  assignTreeBlockFlags(bars);

  const weekMarkers = zoomLevel === "week" || zoomLevel === "month"
    ? buildWeeklyAxisMarkers(domainStart, totalDays, dayWidthPx)
    : [];
  const dailyGridLines = zoomLevel === "week" ? buildDailyGridLines(totalDays, dayWidthPx) : [];
  const monthMarkers = buildMonthAxisMarkers(domainStart, totalDays, dayWidthPx);
  const quarterMarkers = buildQuarterAxisMarkers(domainStart, totalDays, dayWidthPx);
  const yearMarkers = buildYearAxisMarkers(domainStart, totalDays, dayWidthPx);

  const timelineWidth = totalDays * dayWidthPx;
  const verticalLayout = resolveTimelineVerticalLayoutMetrics(bars.length, includeUnscheduledDropLane);

  return {
    width: Math.max(900, CHART_LEFT_GUTTER + timelineWidth + CHART_RIGHT_PADDING_PX),
    height: CHART_TOP_PADDING + verticalLayout.contentRows * CHART_ROW_HEIGHT + verticalLayout.tailHeightPx,
    contentRows: verticalLayout.contentRows,
    tailHeightPx: verticalLayout.tailHeightPx,
    dayWidthPx,
    bars,
    weekendBands,
    weekMarkers,
    dailyGridLines,
    monthMarkers,
    quarterMarkers,
    yearMarkers,
    domainStart,
    currentPeriod,
    todayX
  };
}

function buildColorByWorkItemId(
  timeline: TimelineReadModel | null,
  mode: TimelineColorCoding,
  fieldConfig: TimelineFieldColorCodingConfig
): Map<number, string> {
  const map = new Map<number, string>();
  if (!timeline) {
    return map;
  }

  const items = [
    ...timeline.bars.map((bar) => ({
      workItemId: bar.workItemId,
      stateCode: bar.state.code,
      endDate: bar.schedule.endDate,
      parentWorkItemId: bar.details.parentWorkItemId ?? null,
      fieldValues: bar.details.fieldValues ?? {},
      fallbackColor: bar.state.color
    })),
    ...timeline.unschedulable.map((item) => ({
      workItemId: item.workItemId,
      stateCode: item.state.code,
      endDate: item.schedule?.endDate ?? null,
      parentWorkItemId: item.details.parentWorkItemId ?? null,
      fieldValues: item.details.fieldValues ?? {},
      fallbackColor: item.state.color
    }))
  ];

  if (mode === "none") {
    items.forEach((item) => {
      map.set(item.workItemId, DEFAULT_NEUTRAL_TIMELINE_COLOR);
    });
    return map;
  }

  if (mode === "overdue") {
    const overdueExcludedStateCodes = resolveOverdueExcludedStateCodes(
      fieldConfig.overdueExcludedStateCodes,
      DEFAULT_OVERDUE_EXCLUDED_STATE_CODES
    );
    items.forEach((item) => {
      map.set(
        item.workItemId,
        isOverdueTimelineItem(item.endDate, item.stateCode, overdueExcludedStateCodes)
          ? OVERDUE_TIMELINE_COLOR
          : OVERDUE_OK_TIMELINE_COLOR
      );
    });
    return map;
  }

  if (mode === "status") {
    items.forEach((item) => {
      const valueKey = fieldValueToStorageKey(item.stateCode);
      const scopedKey = toScopedModeValueColorKey(mode, valueKey);
      const customColor = (scopedKey ? fieldConfig.valueColors[scopedKey] : null) ?? fieldConfig.valueColors[valueKey] ?? null;
      map.set(item.workItemId, customColor ?? item.fallbackColor ?? DEFAULT_NEUTRAL_TIMELINE_COLOR);
    });
    return map;
  }

  if (mode === "field") {
    const fieldRef = fieldConfig.fieldRef?.trim() ?? "";
    if (fieldRef.length === 0) {
      items.forEach((item) => {
        map.set(item.workItemId, DEFAULT_NEUTRAL_TIMELINE_COLOR);
      });
      return map;
    }

    const categoryByWorkItemId = new Map<number, string>();
    items.forEach((item) => {
      categoryByWorkItemId.set(item.workItemId, fieldValueToCategoryLabel(item.fieldValues[fieldRef]));
    });
    const categoryColorMap = buildCategoricalColorMap([...categoryByWorkItemId.values()]);

    items.forEach((item) => {
      const category = categoryByWorkItemId.get(item.workItemId) ?? "Empty";
      const valueKey = fieldValueToStorageKey(item.fieldValues[fieldRef]);
      const scopedKey = toScopedFieldValueColorKey(fieldRef, valueKey);
      const customColor = (scopedKey ? fieldConfig.valueColors[scopedKey] : null) ?? fieldConfig.valueColors[valueKey] ?? null;
      const categoryColor = categoryColorMap.get(category) ?? DEFAULT_NEUTRAL_TIMELINE_COLOR;
      map.set(item.workItemId, customColor ?? categoryColor);
    });
    return map;
  }

  const categoryByWorkItemId = new Map<number, string>();
  items.forEach((item) => {
    const category = item.parentWorkItemId === null ? "No parent" : `Parent #${item.parentWorkItemId}`;

    categoryByWorkItemId.set(item.workItemId, category);
  });

  const categoryColorMap = buildCategoricalColorMap([...categoryByWorkItemId.values()]);

  items.forEach((item) => {
    const category = categoryByWorkItemId.get(item.workItemId);
    const categoryColor = category ? categoryColorMap.get(category) : null;
    const valueKey = fieldValueToStorageKey(category);
    const scopedKey = toScopedModeValueColorKey(mode, valueKey);
    const customColor = (scopedKey ? fieldConfig.valueColors[scopedKey] : null) ?? fieldConfig.valueColors[valueKey] ?? null;
    map.set(item.workItemId, customColor ?? categoryColor ?? item.fallbackColor ?? DEFAULT_NEUTRAL_TIMELINE_COLOR);
  });

  return map;
}

function resolveTimelineVisibleRange(timeline: TimelineReadModel | null): { start: Date; end: Date } | null {
  if (!timeline || timeline.bars.length === 0) {
    return null;
  }

  const normalizedRanges = timeline.bars
    .map((bar) => {
      const start = parseIso(bar.schedule.startDate);
      const end = parseIso(bar.schedule.endDate);
      if (!start && !end) {
        return null;
      }

      const normalizedStart = start ?? addDays(end as Date, -(DEFAULT_UNSCHEDULED_DURATION_DAYS - 1));
      const normalizedEnd = end ?? addDays(start as Date, 2);
      return normalizedStart.getTime() <= normalizedEnd.getTime()
        ? { start: normalizedStart, end: normalizedEnd }
        : { start: normalizedEnd, end: normalizedStart };
    })
    .filter((value): value is { start: Date; end: Date } => value !== null);

  if (normalizedRanges.length === 0) {
    return null;
  }

  return {
    start: new Date(Math.min(...normalizedRanges.map((range) => range.start.getTime()))),
    end: new Date(Math.max(...normalizedRanges.map((range) => range.end.getTime())))
  };
}

function createInitialTimelineFieldFilters(): TimelineFieldFilter[] {
  return [createTimelineFieldFilter(0)];
}

function createTimelineFieldFilter(slotId: number): TimelineFieldFilter {
  return {
    slotId,
    fieldRef: null,
    selectedValueKeys: []
  };
}

function resolveInitialTimelineFilterState(): { filters: TimelineFieldFilter[]; nextSlotId: number } {
  if (typeof globalThis.location === "undefined") {
    return {
      filters: createInitialTimelineFieldFilters(),
      nextSlotId: 1
    };
  }

  const parsed = parseTimelineFiltersFromSearch(globalThis.location.search);
  if (parsed.length === 0) {
    return {
      filters: createInitialTimelineFieldFilters(),
      nextSlotId: 1
    };
  }

  const filters = parsed.map((entry, index) => ({
    slotId: index,
    fieldRef: entry.fieldRef,
    selectedValueKeys: entry.selectedValueKeys
  }));

  return {
    filters,
    nextSlotId: filters.length
  };
}

function parseTimelineFiltersFromSearch(search: string): Array<{ fieldRef: string | null; selectedValueKeys: string[] }> {
  try {
    const params = new URLSearchParams(search);
    const compactEntries = params.getAll(TIMELINE_FILTERS_QUERY_PARAM);
    if (compactEntries.length > 0) {
      return compactEntries
        .map((entry) => parseCompactTimelineFilterParam(entry))
        .filter((entry): entry is { fieldRef: string; selectedValueKeys: string[] } => entry !== null)
        .slice(0, MAX_TIMELINE_FILTER_SLOTS);
    }

    const legacyRaw = params.get(LEGACY_TIMELINE_FILTERS_QUERY_PARAM);
    if (!legacyRaw) {
      return [];
    }

    const parsed = JSON.parse(legacyRaw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }

        const maybeFieldRef = "fieldRef" in entry ? (entry.fieldRef as unknown) : null;
        const maybeValues = "selectedValueKeys" in entry ? (entry.selectedValueKeys as unknown) : [];
        const fieldRef =
          typeof maybeFieldRef === "string" && maybeFieldRef.trim().length > 0 ? maybeFieldRef.trim() : null;
        const selectedValueKeys = Array.isArray(maybeValues)
          ? [...new Set(maybeValues.filter((value): value is string => typeof value === "string"))]
          : [];
        if (!fieldRef) {
          return null;
        }

        return {
          fieldRef,
          selectedValueKeys
        };
      })
      .filter((entry): entry is { fieldRef: string; selectedValueKeys: string[] } => entry !== null)
      .slice(0, MAX_TIMELINE_FILTER_SLOTS);
  } catch {
    return [];
  }
}

function serializeTimelineFiltersForUrl(
  filters: TimelineFieldFilter[]
): Array<{ fieldRef: string | null; selectedValueKeys: string[] }> {
  return filters
    .map((filter) => ({
      fieldRef: filter.fieldRef?.trim() ? filter.fieldRef.trim() : null,
      selectedValueKeys: [...new Set(filter.selectedValueKeys)]
    }))
    .filter((entry) => entry.fieldRef !== null);
}

function toCompactTimelineFilterParam(entry: { fieldRef: string | null; selectedValueKeys: string[] }): string | null {
  const fieldRef = entry.fieldRef?.trim();
  if (!fieldRef) {
    return null;
  }

  const encodedFieldRef = encodeTimelineFilterToken(fieldRef);
  const valuePart =
    entry.selectedValueKeys.length > 0
      ? entry.selectedValueKeys.map((value) => encodeTimelineFilterToken(value)).join(",")
      : "";
  return `${encodedFieldRef}~${valuePart}`;
}

function parseCompactTimelineFilterParam(value: string): { fieldRef: string; selectedValueKeys: string[] } | null {
  try {
    const [rawFieldRef, rawValues = ""] = value.split("~", 2);
    if (!rawFieldRef) {
      return null;
    }

    const fieldRef = decodeTimelineFilterToken(rawFieldRef).trim();
    if (fieldRef.length === 0) {
      return null;
    }

    const selectedValueKeys = rawValues
      .split(",")
      .map((entry) => decodeTimelineFilterToken(entry).trim())
      .filter((entry) => entry.length > 0);

    return {
      fieldRef,
      selectedValueKeys: [...new Set(selectedValueKeys)]
    };
  } catch {
    return null;
  }
}

function decodeTimelineFilterToken(token: string): string {
  try {
    return decodeURIComponent(token);
  } catch {
    // Keep legacy unescaped tokens parseable even when they contain stray "%".
    return token;
  }
}

function encodeTimelineFilterToken(token: string): string {
  return encodeURIComponent(token).replace(/~/g, "%7E");
}

function syncTimelineFiltersToUrl(filters: TimelineFieldFilter[]): void {
  if (typeof globalThis.window === "undefined") {
    return;
  }

  const params = new URLSearchParams(globalThis.window.location.search);
  params.delete(TIMELINE_FILTERS_QUERY_PARAM);
  params.delete(LEGACY_TIMELINE_FILTERS_QUERY_PARAM);
  serializeTimelineFiltersForUrl(filters)
    .map((entry) => toCompactTimelineFilterParam(entry))
    .filter((entry): entry is string => entry !== null)
    .forEach((entry) => {
      params.append(TIMELINE_FILTERS_QUERY_PARAM, entry);
    });

  const nextSearch = params.toString();
  const normalizedCurrentSearch = globalThis.window.location.search.startsWith("?")
    ? globalThis.window.location.search.slice(1)
    : globalThis.window.location.search;
  if (nextSearch === normalizedCurrentSearch) {
    return;
  }

  const nextUrl = `${globalThis.window.location.pathname}${nextSearch.length > 0 ? `?${nextSearch}` : ""}${globalThis.window.location.hash}`;
  globalThis.window.history.replaceState(globalThis.window.history.state, "", nextUrl);
}

function isActiveTimelineFieldFilter(filter: TimelineFieldFilter): boolean {
  return Boolean(filter.fieldRef && filter.selectedValueKeys.length > 0);
}

function applyTimelineFieldFilters(
  timeline: TimelineReadModel | null,
  filters: TimelineFieldFilter[]
): TimelineReadModel | null {
  if (!timeline) {
    return null;
  }

  const activeFilters = filters.filter((filter) => isActiveTimelineFieldFilter(filter));
  if (activeFilters.length === 0) {
    return timeline;
  }

  const matchesAll = (fieldValues: Record<string, string | number | null> | undefined): boolean => {
    return activeFilters.every((filter) => {
      const normalizedFieldRef = filter.fieldRef?.trim();
      if (!normalizedFieldRef || filter.selectedValueKeys.length === 0) {
        return true;
      }

      const selectedValueKeys = new Set(filter.selectedValueKeys);
      const matchKeys = extractFilterMatchKeys(normalizedFieldRef, fieldValues?.[normalizedFieldRef]);
      return matchKeys.some((key) => selectedValueKeys.has(key));
    });
  };

  const bars = timeline.bars.filter((bar) => matchesAll(bar.details.fieldValues));
  const unschedulable = timeline.unschedulable.filter((item) => matchesAll(item.details.fieldValues));
  const visibleWorkItemIds = new Set<number>([
    ...bars.map((bar) => bar.workItemId),
    ...unschedulable.map((item) => item.workItemId)
  ]);
  const dependencies = timeline.dependencies.filter(
    (dependency) =>
      visibleWorkItemIds.has(dependency.predecessorWorkItemId) &&
      visibleWorkItemIds.has(dependency.successorWorkItemId)
  );
  const suppressedDependencies = timeline.suppressedDependencies.filter(
    (dependency) =>
      visibleWorkItemIds.has(dependency.predecessorWorkItemId) &&
      visibleWorkItemIds.has(dependency.successorWorkItemId)
  );

  return {
    ...timeline,
    bars,
    unschedulable,
    dependencies,
    suppressedDependencies
  };
}

function filterFieldRefsBySearch(fieldRefs: string[], search: string): string[] {
  const normalizedSearch = search.trim().toLowerCase();
  if (normalizedSearch.length === 0) {
    return fieldRefs;
  }

  return fieldRefs.filter((fieldRef) => {
    const displayName = getFieldDisplayName(fieldRef);
    return (
      fieldRef.toLowerCase().includes(normalizedSearch) ||
      displayName.toLowerCase().includes(normalizedSearch)
    );
  });
}

function filterFieldValueStatsBySearch(stats: FieldValueStat[], search: string): FieldValueStat[] {
  const normalizedSearch = search.trim().toLowerCase();
  if (normalizedSearch.length === 0) {
    return stats;
  }

  return stats.filter((entry) => entry.label.toLowerCase().includes(normalizedSearch));
}

function sanitizeTimelineFieldRefList(fieldRefs: string[]): string[] {
  return [...new Set(fieldRefs)]
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function buildTimelineLabelFieldOptions(fieldRefs: string[]): TimelineLabelFieldOption[] {
  const options: TimelineLabelFieldOption[] = [
    {
      fieldRef: TIMELINE_LABEL_SPECIAL_FIELD_REFS.title,
      label: "Title",
      subtitle: "Built-in",
      searchText: "title built in"
    },
    {
      fieldRef: TIMELINE_LABEL_SPECIAL_FIELD_REFS.mappedId,
      label: "ID",
      subtitle: "Built-in",
      searchText: "id mappedid built in"
    },
    {
      fieldRef: TIMELINE_LABEL_SPECIAL_FIELD_REFS.state,
      label: "State",
      subtitle: "Built-in",
      searchText: "state status built in"
    }
  ];

  fieldRefs.forEach((fieldRef) => {
    const displayName = getFieldDisplayName(fieldRef);
    options.push({
      fieldRef,
      label: displayName,
      subtitle: fieldRef,
      searchText: `${displayName} ${fieldRef}`.toLowerCase()
    });
  });

  return options;
}

function filterTimelineLabelFieldOptions(
  options: TimelineLabelFieldOption[],
  search: string
): TimelineLabelFieldOption[] {
  const normalizedSearch = search.trim().toLowerCase();
  if (normalizedSearch.length === 0) {
    return options;
  }

  return options.filter((option) => option.searchText.includes(normalizedSearch));
}

type ColorCodingOption = {
  key: string;
  mode: TimelineColorCoding;
  fieldRef: string | null;
  label: string;
  subtitle?: string;
  searchText: string;
};

const COLOR_CODING_MODE_OPTIONS: ColorCodingOption[] = [
  { key: "mode:none", mode: "none", fieldRef: null, label: "None", subtitle: "Mode", searchText: "none mode" },
  { key: "mode:status", mode: "status", fieldRef: null, label: "Status", subtitle: "Mode", searchText: "status mode state" },
  { key: "mode:parent", mode: "parent", fieldRef: null, label: "Parent", subtitle: "Mode", searchText: "parent mode hierarchy" },
  { key: "mode:overdue", mode: "overdue", fieldRef: null, label: "Overdue", subtitle: "Mode", searchText: "overdue mode late due date" }
];

const COLOR_CODING_RESERVED_FIELD_REFS = new Set(["state", "system.state"]);
const WELL_KNOWN_FILTER_FIELD_REFS = ["System.Tags"] as const;

function buildColorCodingOptions(fieldRefs: string[]): ColorCodingOption[] {
  const fieldOptions = fieldRefs
    .filter((fieldRef) => !isReservedColorCodingFieldRef(fieldRef))
    .map((fieldRef) => {
      const fieldDisplayName = getFieldDisplayName(fieldRef);
      return {
        key: `field:${fieldRef}`,
        mode: "field" as const,
        fieldRef,
        label: fieldDisplayName,
        subtitle: fieldRef,
        searchText: `field ${fieldDisplayName} ${fieldRef}`.toLowerCase()
      };
    });

  return [...COLOR_CODING_MODE_OPTIONS, ...fieldOptions];
}

function isReservedColorCodingFieldRef(fieldRef: string): boolean {
  return COLOR_CODING_RESERVED_FIELD_REFS.has(fieldRef.trim().toLowerCase());
}

function filterColorCodingOptions(options: ColorCodingOption[], search: string): ColorCodingOption[] {
  const normalizedSearch = search.trim().toLowerCase();
  if (normalizedSearch.length === 0) {
    return options;
  }

  return options
    .filter((option) => option.searchText.includes(normalizedSearch))
    .sort((left, right) => {
      if (left.mode === "field" && right.mode !== "field") {
        return -1;
      }
      if (left.mode !== "field" && right.mode === "field") {
        return 1;
      }

      return left.label.localeCompare(right.label);
    });
}

function pickPreferredColorCodingOption(
  options: ColorCodingOption[],
  search: string
): ColorCodingOption | null {
  if (options.length === 0) {
    return null;
  }

  const normalizedSearch = search.trim().toLowerCase();
  if (normalizedSearch.length === 0) {
    return options[0];
  }

  const firstField = options.find((option) => option.mode === "field");
  return firstField ?? options[0];
}

function resolveSelectedColorCodingLabel(mode: TimelineColorCoding, fieldRef: string | null): string {
  if (mode === "field") {
    return fieldRef ? `Field: ${getFieldDisplayName(fieldRef)}` : "Field";
  }

  if (mode === "none") {
    return "None";
  }
  if (mode === "status") {
    return "Status";
  }
  if (mode === "parent") {
    return "Parent";
  }
  return "Overdue";
}

function getFieldDisplayName(fieldRef: string): string {
  const trimmed = fieldRef.trim();
  if (trimmed.length === 0) {
    return fieldRef;
  }

  const parts = trimmed.split(".");
  const lastPart = parts[parts.length - 1]?.trim();
  return lastPart && lastPart.length > 0 ? lastPart : trimmed;
}

function buildTimelineBarLabel(bar: TimelineReadModel["bars"][number], fieldRefs: string[]): string {
  const parts = sanitizeTimelineFieldRefList(fieldRefs)
    .map((fieldRef) => timelineBarLabelValueForFieldRef(bar, fieldRef))
    .filter((value): value is string => value !== null && value.length > 0);

  if (parts.length === 0) {
    return "";
  }

  return parts.join(" - ");
}

function assignTreeBlockFlags(bars: VisualTimelineBar[]): void {
  const isPartOfTree = (bar: VisualTimelineBar): boolean =>
    bar.treeDepth !== null && (bar.treeHasChildren || bar.treeDepth > 0);

  for (let index = 0; index < bars.length; index++) {
    const bar = bars[index];
    if (!isPartOfTree(bar)) {
      continue;
    }

    const prev = index > 0 ? bars[index - 1] : null;
    const next = index + 1 < bars.length ? bars[index + 1] : null;

    bar.treeBlockStart =
      bar.treeDepth === 0 &&
      bar.treeHasChildren &&
      (!prev || !isPartOfTree(prev) || (prev.treeDepth === 0 && !prev.treeHasChildren));

    bar.treeBlockEnd =
      isPartOfTree(bar) &&
      (!next || !isPartOfTree(next) || (next.treeDepth === 0 && next.treeHasChildren));
  }
}

function buildTreeDepthBandsAndBorders(bars: VisualTimelineBar[], chartWidth: number): React.ReactNode[] {
  const elements: React.ReactNode[] = [];

  for (let index = 0; index < bars.length; index++) {
    const bar = bars[index];
    const isTree = bar.treeDepth !== null && (bar.treeHasChildren || bar.treeDepth > 0);
    if (!isTree) {
      continue;
    }

    elements.push(
      React.createElement("rect", {
        key: `tree-depth-band-${bar.workItemId}`,
        x: 0,
        y: CHART_TOP_PADDING + index * CHART_ROW_HEIGHT,
        width: chartWidth,
        height: CHART_ROW_HEIGHT,
        className: `timeline-tree-depth-band timeline-tree-depth-${Math.min(bar.treeDepth ?? 0, 4)}`
      })
    );

    if (bar.treeBlockStart) {
      elements.push(
        React.createElement("rect", {
          key: `tree-block-top-${bar.workItemId}`,
          x: 0,
          y: CHART_TOP_PADDING + index * CHART_ROW_HEIGHT - 1,
          width: chartWidth,
          height: 2,
          className: "timeline-tree-block-border"
        })
      );
    }

    if (bar.treeBlockEnd) {
      elements.push(
        React.createElement("rect", {
          key: `tree-block-bottom-${bar.workItemId}`,
          x: 0,
          y: CHART_TOP_PADDING + (index + 1) * CHART_ROW_HEIGHT - 1,
          width: chartWidth,
          height: 2,
          className: "timeline-tree-block-border"
        })
      );
    }
  }

  return elements;
}

function buildTreeIndentGuides(bar: VisualTimelineBar): React.ReactNode {
  const depth = bar.treeDepth ?? 0;
  if (depth === 0) {
    return null;
  }

  const guides: React.ReactNode[] = [];

  for (let level = 0; level < depth - 1; level++) {
    const ancestorIsLast = bar.treeAncestorIsLastSibling[level + 1] ?? false;
    guides.push(
      React.createElement("span", {
        key: `guide-${level}`,
        className: ancestorIsLast
          ? "timeline-tree-guide timeline-tree-guide-blank"
          : "timeline-tree-guide timeline-tree-guide-pipe"
      })
    );
  }

  guides.push(
    React.createElement("span", {
      key: `guide-branch`,
      className: bar.treeIsLastSibling
        ? "timeline-tree-guide timeline-tree-guide-elbow"
        : "timeline-tree-guide timeline-tree-guide-tee"
    })
  );

  return React.createElement(
    "span",
    { className: "timeline-tree-guides", "aria-hidden": "true" },
    ...guides
  );
}

function buildTimelineSidebarLabel(bar: VisualTimelineBar, fieldRefs: string[]): string {
  const parts = sanitizeTimelineFieldRefList(fieldRefs)
    .map((fieldRef) => timelineSidebarLabelValueForFieldRef(bar, fieldRef))
    .filter((value): value is string => value !== null && value.length > 0);

  if (parts.length === 0) {
    return "";
  }

  return parts.join(" - ");
}

function timelineSidebarLabelValueForFieldRef(bar: VisualTimelineBar, fieldRef: string): string | null {
  if (fieldRef === TIMELINE_LABEL_SPECIAL_FIELD_REFS.title) {
    return normalizeTimelineLabelValue(bar.title);
  }

  if (fieldRef === TIMELINE_LABEL_SPECIAL_FIELD_REFS.mappedId) {
    return normalizeTimelineLabelValue(bar.mappedId);
  }

  if (fieldRef === TIMELINE_LABEL_SPECIAL_FIELD_REFS.state) {
    return normalizeTimelineLabelValue(bar.stateCode);
  }

  return normalizeTimelineLabelValue(bar.fieldValues[fieldRef]);
}

function timelineBarLabelValueForFieldRef(
  bar: TimelineReadModel["bars"][number],
  fieldRef: string
): string | null {
  if (fieldRef === TIMELINE_LABEL_SPECIAL_FIELD_REFS.title) {
    return normalizeTimelineLabelValue(bar.title);
  }

  if (fieldRef === TIMELINE_LABEL_SPECIAL_FIELD_REFS.mappedId) {
    return normalizeTimelineLabelValue(bar.details.mappedId);
  }

  if (fieldRef === TIMELINE_LABEL_SPECIAL_FIELD_REFS.state) {
    return normalizeTimelineLabelValue(bar.state.code);
  }

  return normalizeTimelineLabelValue(bar.details.fieldValues?.[fieldRef]);
}

function normalizeTimelineLabelValue(value: string | number | null | undefined): string | null {
  if (value === null || typeof value === "undefined") {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function listAvailableColorCodingFields(timeline: TimelineReadModel | null): string[] {
  const set = new Set<string>();
  WELL_KNOWN_FILTER_FIELD_REFS.forEach((fieldRef) => set.add(fieldRef));
  if (timeline) {
    const register = (fieldValues: Record<string, string | number | null> | undefined): void => {
      if (!fieldValues) {
        return;
      }

      Object.keys(fieldValues).forEach((fieldRef) => {
        if (fieldRef.trim().length > 0) {
          set.add(fieldRef);
        }
      });
    };

    timeline.bars.forEach((bar) => register(bar.details.fieldValues));
    timeline.unschedulable.forEach((item) => register(item.details.fieldValues));
  }

  return [...set].sort((a, b) => a.localeCompare(b));
}

function listFieldValueStats(timeline: TimelineReadModel | null, fieldRef: string | null): FieldValueStat[] {
  if (!timeline || !fieldRef) {
    return [];
  }

  const trimmedFieldRef = fieldRef.trim();
  if (trimmedFieldRef.length === 0) {
    return [];
  }

  const counts = new Map<string, { label: string; count: number }>();
  const register = (value: string | number | null | undefined): void => {
    const uniqueTokensForItem = new Map<string, string>();
    extractFilterValueTokens(trimmedFieldRef, value).forEach((token) => {
      uniqueTokensForItem.set(token.key, token.label);
    });

    uniqueTokensForItem.forEach((label, key) => {
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
        return;
      }

      counts.set(key, { label, count: 1 });
    });
  };

  timeline.bars.forEach((bar) => register(bar.details.fieldValues?.[trimmedFieldRef]));
  timeline.unschedulable.forEach((item) => register(item.details.fieldValues?.[trimmedFieldRef]));

  const categoryColorMap = buildCategoricalColorMap([...counts.values()].map((entry) => entry.label));
  return [...counts.entries()]
    .map(([key, entry]) => ({
      key,
      label: entry.label,
      count: entry.count,
      defaultColor: categoryColorMap.get(entry.label) ?? DEFAULT_NEUTRAL_TIMELINE_COLOR
    }))
    .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: "base", numeric: true }));
}

function listModeValueStats(timeline: TimelineReadModel | null, mode: TimelineColorCoding): FieldValueStat[] {
  if (!timeline || (mode !== "status" && mode !== "overdue")) {
    return [];
  }

  const counts = new Map<string, { label: string; count: number }>();
  const register = (value: string): void => {
    const key = fieldValueToStorageKey(value);
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }

    counts.set(key, {
      label: value,
      count: 1
    });
  };

  timeline.bars.forEach((bar) => register(bar.state.code));
  timeline.unschedulable.forEach((item) => register(item.state.code));

  const categoryColorMap = buildCategoricalColorMap([...counts.values()].map((entry) => entry.label));
  return [...counts.entries()]
    .map(([key, entry]) => ({
      key,
      label: entry.label,
      count: entry.count,
      defaultColor: categoryColorMap.get(entry.label) ?? DEFAULT_NEUTRAL_TIMELINE_COLOR
    }))
    .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: "base", numeric: true }));
}

function fieldValueToStorageKey(value: string | number | null | undefined): string {
  if (value === null || typeof value === "undefined") {
    return "__null__";
  }

  return String(value);
}

function toScopedFieldValueColorKey(fieldRef: string | null, valueKey: string): string | null {
  const normalizedFieldRef = fieldRef?.trim();
  if (!normalizedFieldRef) {
    return null;
  }

  return `${normalizedFieldRef}::${valueKey}`;
}

function toScopedModeValueColorKey(mode: TimelineColorCoding, valueKey: string): string | null {
  if (mode !== "parent" && mode !== "status") {
    return null;
  }

  return `mode:${mode}::${valueKey}`;
}

function fieldValueToCategoryLabel(value: string | number | null | undefined): string {
  if (value === null || typeof value === "undefined") {
    return "Empty";
  }

  const text = String(value).trim();
  return text.length > 0 ? text : "Empty";
}

function buildCategoricalColorMap(categories: string[]): Map<string, string> {
  const unique = Array.from(new Set(categories.map((entry) => entry.trim()).filter((entry) => entry.length > 0))).sort((a, b) =>
    a.localeCompare(b)
  );
  const map = new Map<string, string>();
  unique.forEach((category, index) => {
    map.set(category, TIMELINE_CATEGORY_COLORS[index % TIMELINE_CATEGORY_COLORS.length]);
  });
  return map;
}

function isOverdueTimelineItem(endDateIso: string | null, stateCode: string, overdueExcludedStateCodes: string[]): boolean {
  if (!endDateIso) {
    return false;
  }

  const endDate = parseIso(endDateIso);
  if (!endDate) {
    return false;
  }

  const todayUtc = new Date();
  const todayStartUtc = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate()));
  if (endDate.getTime() >= todayStartUtc.getTime()) {
    return false;
  }

  const normalizedState = normalizeStateCodeForComparison(stateCode);
  if (normalizedState.length === 0) {
    return true;
  }

  return !resolveOverdueExcludedStateCodes(overdueExcludedStateCodes, DEFAULT_OVERDUE_EXCLUDED_STATE_CODES).includes(normalizedState);
}

function resolveOverdueExcludedStateCodes(
  stateCodes: string[] | null | undefined,
  defaults: string[]
): string[] {
  if (!Array.isArray(stateCodes)) {
    return [...defaults];
  }

  return [...new Set(stateCodes.map((stateCode) => normalizeStateCodeForComparison(stateCode)).filter((stateCode) => stateCode.length > 0))];
}

function normalizeStateCodeForComparison(stateCode: string): string {
  return stateCode.trim().toLowerCase();
}

function parseIso(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeUtcDate(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function resolveUnschedulableFixedEndDate(item: TimelineReadModel["unschedulable"][number]): Date | null {
  return parseIso(item.schedule?.endDate ?? null);
}

function resolveUnscheduledDropRange(startDate: Date, fixedEndDate: Date | null): { startDate: Date; endDate: Date } {
  let normalizedStart = normalizeUtcDate(startDate);
  const normalizedEnd = fixedEndDate
    ? normalizeUtcDate(fixedEndDate)
    : addDays(normalizedStart, DEFAULT_UNSCHEDULED_DURATION_DAYS - 1);

  if (normalizedStart.getTime() > normalizedEnd.getTime()) {
    normalizedStart = normalizedEnd;
  }

  return {
    startDate: normalizedStart,
    endDate: normalizedEnd
  };
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function startOfIsoWeekUtc(value: Date): Date {
  const normalized = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const day = normalized.getUTCDay();
  const isoWeekdayOffset = day === 0 ? 6 : day - 1;
  return addDays(normalized, -isoWeekdayOffset);
}

function startOfMonthUtc(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function addMonthsUtc(value: Date, months: number): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1));
}

function dayDiff(from: Date, to: Date): number {
  const fromUtc = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const toUtc = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.floor((toUtc - fromUtc) / 86_400_000);
}

function dayDiffInclusive(from: Date, to: Date): number {
  return dayDiff(from, to) + 1;
}

function buildWeeklyAxisMarkers(domainStart: Date, totalDays: number, dayWidthPx: number): { x: number; label: string }[] {
  const markers: { x: number; label: string }[] = [];
  const domainEnd = addDays(domainStart, totalDays);
  let cursor = startOfIsoWeekUtc(domainStart);
  if (cursor.getTime() < domainStart.getTime()) {
    cursor = addDays(cursor, 7);
  }
  while (cursor.getTime() <= domainEnd.getTime()) {
    const offset = dayDiff(domainStart, cursor);
    markers.push({
      x: offset * dayWidthPx,
      label: formatDayMonthLabel(cursor)
    });
    cursor = addDays(cursor, 7);
  }

  return markers.length ? markers : [{ x: 0, label: formatDayMonthLabel(domainStart) }];
}

function buildDailyGridLines(totalDays: number, dayWidthPx: number): number[] {
  const lines: number[] = [];
  for (let dayIndex = 0; dayIndex <= totalDays; dayIndex += 1) {
    lines.push(dayIndex * dayWidthPx);
  }
  return lines;
}

function buildWeekendBands(
  domainStart: Date,
  totalDays: number,
  dayWidthPx: number
): { x: number; width: number; date: string }[] {
  const bands: { x: number; width: number; date: string }[] = [];
  for (let dayIndex = 0; dayIndex < totalDays; dayIndex += 1) {
    const currentDay = addDays(domainStart, dayIndex);
    if (!isWeekendUtc(currentDay)) {
      continue;
    }

    bands.push({
      x: dayIndex * dayWidthPx,
      width: dayWidthPx,
      date: formatTickDate(currentDay)
    });
  }

  return bands;
}

function buildMonthAxisMarkers(
  domainStart: Date,
  totalDays: number,
  dayWidthPx: number
): { x: number; label: string }[] {
  const domainEndExclusive = addDays(domainStart, totalDays + 1);
  let cursor = startOfMonthUtc(domainStart);
  const markers: { x: number; label: string }[] = [];
  const seenX = new Set<number>();

  while (cursor.getTime() < domainEndExclusive.getTime()) {
    const monthStartOffset = dayDiff(domainStart, cursor);
    if (monthStartOffset <= totalDays) {
      const markerOffsetDays = clamp(monthStartOffset, 0, totalDays);
      const x = markerOffsetDays * dayWidthPx;
      if (!seenX.has(x)) {
        seenX.add(x);
        markers.push({
          x,
          label: formatMonthYearLabel(cursor)
        });
      }
    }

    cursor = addMonthsUtc(cursor, 1);
  }

  return markers;
}

function buildQuarterAxisMarkers(
  domainStart: Date,
  totalDays: number,
  dayWidthPx: number
): { x: number; label: string }[] {
  const domainEndExclusive = addDays(domainStart, totalDays + 1);
  const startMonth = domainStart.getUTCMonth();
  const quarterStartMonth = startMonth - (startMonth % 3);
  let cursor = new Date(Date.UTC(domainStart.getUTCFullYear(), quarterStartMonth, 1));
  const markers: { x: number; label: string }[] = [];
  const seenX = new Set<number>();

  while (cursor.getTime() < domainEndExclusive.getTime()) {
    const offset = dayDiff(domainStart, cursor);
    if (offset <= totalDays) {
      const markerOffsetDays = clamp(offset, 0, totalDays);
      const x = markerOffsetDays * dayWidthPx;
      if (!seenX.has(x)) {
        seenX.add(x);
        const quarter = Math.floor(cursor.getUTCMonth() / 3) + 1;
        markers.push({
          x,
          label: `Q${quarter} ${cursor.getUTCFullYear()}`
        });
      }
    }

    cursor = addMonthsUtc(cursor, 3);
  }

  return markers;
}

function buildYearAxisMarkers(
  domainStart: Date,
  totalDays: number,
  dayWidthPx: number
): { x: number; label: string }[] {
  const domainEndExclusive = addDays(domainStart, totalDays + 1);
  let cursor = new Date(Date.UTC(domainStart.getUTCFullYear(), 0, 1));
  const markers: { x: number; label: string }[] = [];
  const seenX = new Set<number>();

  while (cursor.getTime() < domainEndExclusive.getTime()) {
    const offset = dayDiff(domainStart, cursor);
    if (offset <= totalDays) {
      const markerOffsetDays = clamp(offset, 0, totalDays);
      const x = markerOffsetDays * dayWidthPx;
      if (!seenX.has(x)) {
        seenX.add(x);
        markers.push({
          x,
          label: String(cursor.getUTCFullYear())
        });
      }
    }

    cursor = new Date(Date.UTC(cursor.getUTCFullYear() + 1, 0, 1));
  }

  return markers;
}

function formatTickDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function formatDayMonthLabel(value: Date): string {
  const day = String(value.getUTCDate()).padStart(2, "0");
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const weekNumber = String(resolveIsoWeekNumberUtc(value)).padStart(2, "0");
  return `${day}.${month}. (KW${weekNumber})`;
}

function isWeekendUtc(value: Date): boolean {
  const weekday = value.getUTCDay();
  return weekday === 0 || weekday === 6;
}

function resolveIsoWeekNumberUtc(value: Date): number {
  const normalized = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const weekday = normalized.getUTCDay() || 7;
  normalized.setUTCDate(normalized.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(normalized.getUTCFullYear(), 0, 1));
  return Math.ceil(((normalized.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

function formatMonthYearLabel(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(value);
}

function clientDeltaToDays(deltaClientX: number, svg: SVGSVGElement | null, dayWidthPx: number): number {
  if (!svg) {
    return Math.round(deltaClientX / dayWidthPx);
  }

  const rect = svg.getBoundingClientRect();
  const horizontalScale = rect.width > 0 ? svg.viewBox.baseVal.width / rect.width : 1;
  const svgDeltaX = deltaClientX * horizontalScale;
  return Math.round(svgDeltaX / dayWidthPx);
}

function clientXToDate(clientX: number, svg: SVGSVGElement | null, domainStart: Date, dayWidthPx: number): Date {
  const safeClientX = Number.isFinite(clientX) ? clientX : CHART_LEFT_GUTTER;
  let svgX = safeClientX;
  if (svg) {
    const rect = svg.getBoundingClientRect();
    if (rect.width > 0) {
      const horizontalScale = svg.viewBox.baseVal.width / rect.width;
      svgX = (clientX - rect.left) * horizontalScale;
    }
  }

  const dayIndex = Math.max(0, Math.round((svgX - CHART_LEFT_GUTTER) / dayWidthPx));
  return addDays(domainStart, dayIndex);
}

function clientPointToSvg(clientX: number, clientY: number, svg: SVGSVGElement | null): { x: number; y: number } {
  if (!svg) {
    return {
      x: Number.isFinite(clientX) ? clientX : 0,
      y: Number.isFinite(clientY) ? clientY : 0
    };
  }

  const rect = svg.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return {
      x: Number.isFinite(clientX) ? clientX : 0,
      y: Number.isFinite(clientY) ? clientY : 0
    };
  }

  const horizontalScale = svg.viewBox.baseVal.width / rect.width;
  const verticalScale = svg.viewBox.baseVal.height / rect.height;
  return {
    x: (clientX - rect.left) * horizontalScale,
    y: (clientY - rect.top) * verticalScale
  };
}

function toIsoDateUtc(value: Date): string {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())).toISOString();
}

function resolveTimelineDetailsMaxWidthPx(container: HTMLElement | null, sidebarWidthPx: number): number {
  if (!container || container.clientWidth <= 0) {
    return DETAILS_PANEL_MAX_WIDTH_PX;
  }

  const normalizedSidebarWidth = clamp(
    Math.round(sidebarWidthPx),
    TIMELINE_SIDEBAR_COLLAPSED_WIDTH_PX,
    TIMELINE_SIDEBAR_MAX_WIDTH_PX
  );
  const available = Math.floor(
    container.clientWidth - normalizedSidebarWidth - DETAILS_PANEL_SPLITTER_WIDTH_PX - DETAILS_PANEL_MIN_CHART_WIDTH_PX
  );
  return clamp(available, DETAILS_PANEL_MIN_WIDTH_PX, DETAILS_PANEL_MAX_WIDTH_PX);
}

function resolveTimelineSidebarMaxWidthPx(container: HTMLElement | null, detailsWidthPx: number): number {
  if (!container || container.clientWidth <= 0) {
    return TIMELINE_SIDEBAR_MAX_WIDTH_PX;
  }

  const normalizedDetailsWidth = clamp(Math.round(detailsWidthPx), DETAILS_PANEL_MIN_WIDTH_PX, DETAILS_PANEL_MAX_WIDTH_PX);
  const available = Math.floor(
    container.clientWidth - normalizedDetailsWidth - DETAILS_PANEL_SPLITTER_WIDTH_PX - DETAILS_PANEL_MIN_CHART_WIDTH_PX
  );
  return clamp(available, TIMELINE_SIDEBAR_MIN_WIDTH_PX, TIMELINE_SIDEBAR_MAX_WIDTH_PX);
}

export function resolveTimelineVerticalLayoutMetrics(
  barCount: number,
  includeUnscheduledDropLane: boolean
): { contentRows: number; tailHeightPx: number } {
  const normalizedBarCount = Math.max(0, Math.trunc(barCount));
  return {
    contentRows: normalizedBarCount + (includeUnscheduledDropLane ? 1 : 0),
    tailHeightPx: CHART_BOTTOM_PADDING
  };
}

function resolveTimelineBarTopY(rowIndex: number): number {
  return CHART_TOP_PADDING + rowIndex * CHART_ROW_HEIGHT + BAR_ROW_TOP_INSET_PX;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function quantizeDayWidth(value: number): number {
  const step = value < 1 ? 0.01 : value < 4 ? 0.05 : value < 10 ? 0.1 : ZOOM_DAY_WIDTH_STEP_PX;
  return Math.round(value / step) * step;
}

function resolveZoomLevelWithoutHysteresis(dayWidthPx: number): TimelineZoomLevel {
  if (dayWidthPx >= DAY_WIDTH_WEEK_MONTH_SWITCH_PX) {
    return "week";
  }
  if (dayWidthPx >= DAY_WIDTH_MONTH_QUARTER_SWITCH_PX) {
    return "month";
  }
  if (dayWidthPx >= DAY_WIDTH_QUARTER_YEAR_SWITCH_PX) {
    return "quarter";
  }
  return "year";
}

function resolveZoomLevelWithHysteresis(
  dayWidthPx: number,
  previous: TimelineZoomLevel
): TimelineZoomLevel {
  const H = ZOOM_LEVEL_HYSTERESIS_PX;

  if (dayWidthPx >= DAY_WIDTH_WEEK_MONTH_SWITCH_PX + H) {
    return "week";
  }
  if (dayWidthPx <= DAY_WIDTH_QUARTER_YEAR_SWITCH_PX - H) {
    return "year";
  }

  if (dayWidthPx < DAY_WIDTH_MONTH_QUARTER_SWITCH_PX - H) {
    if (dayWidthPx >= DAY_WIDTH_QUARTER_YEAR_SWITCH_PX + H) {
      return "quarter";
    }
    return previous === "year" ? "year" : "quarter";
  }

  if (dayWidthPx < DAY_WIDTH_WEEK_MONTH_SWITCH_PX - H) {
    if (dayWidthPx >= DAY_WIDTH_MONTH_QUARTER_SWITCH_PX + H) {
      return "month";
    }
    return previous === "quarter" || previous === "year" ? "quarter" : "month";
  }

  return previous === "month" || previous === "quarter" || previous === "year" ? "month" : "week";
}

function normalizeWheelDelta(event: WheelEvent): number {
  if (event.deltaMode === 1) {
    return event.deltaY * 16;
  }

  if (event.deltaMode === 2) {
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 900;
    return event.deltaY * Math.max(200, viewportHeight);
  }

  return event.deltaY;
}

function calculateDraggedSchedule(
  mode: DragMode,
  sourceStart: Date,
  sourceEnd: Date,
  dayDelta: number
): { startDate: Date; endDate: Date } {
  if (mode === "move") {
    return {
      startDate: addDays(sourceStart, dayDelta),
      endDate: addDays(sourceEnd, dayDelta)
    };
  }

  if (mode === "resize-start") {
    const candidateStart = addDays(sourceStart, dayDelta);
    if (candidateStart.getTime() > sourceEnd.getTime()) {
      return { startDate: sourceEnd, endDate: sourceEnd };
    }

    return { startDate: candidateStart, endDate: sourceEnd };
  }

  const candidateEnd = addDays(sourceEnd, dayDelta);
  if (candidateEnd.getTime() < sourceStart.getTime()) {
    return { startDate: sourceStart, endDate: sourceStart };
  }

  return { startDate: sourceStart, endDate: candidateEnd };
}

const DEPENDENCY_BEND_STAGGER_PX = 5;

function resolveStemBendX(from: BarGeometry, targets: readonly BarGeometry[], laneSeed: number): number {
  const startX = from.x + from.width + DEPENDENCY_ENDPOINT_GAP_PX;
  const minEndX = Math.min(...targets.map((t) => t.x - DEPENDENCY_ENDPOINT_GAP_PX));
  const horizontalDistance = minEndX - startX;
  const stagger = (laneSeed % 4) * DEPENDENCY_BEND_STAGGER_PX;
  return startX + Math.max(6, Math.min(DEPENDENCY_LANE_ENTRY_MIN_PX, Math.abs(horizontalDistance) / 2)) + stagger;
}

function buildDependencyConnectorPathWithBendX(from: BarGeometry, to: BarGeometry, bendX: number): string {
  const startX = from.x + from.width + DEPENDENCY_ENDPOINT_GAP_PX;
  const endX = to.x - DEPENDENCY_ENDPOINT_GAP_PX;

  if (from.midY === to.midY) {
    return toDependencyPathString([
      { x: startX, y: from.midY },
      { x: endX, y: to.midY }
    ]);
  }

  if (endX < bendX) {
    const approachX = endX - DEPENDENCY_ENDPOINT_GAP_PX * 3;
    const verticalDirection = to.midY > from.midY ? 1 : -1;
    const approachY = to.midY - verticalDirection * (BAR_HEIGHT / 2 + DEPENDENCY_ENDPOINT_GAP_PX);
    return toDependencyPathString([
      { x: startX, y: from.midY },
      { x: bendX, y: from.midY },
      { x: bendX, y: approachY },
      { x: approachX, y: approachY },
      { x: approachX, y: to.midY },
      { x: endX, y: to.midY }
    ]);
  }

  return toDependencyPathString([
    { x: startX, y: from.midY },
    { x: bendX, y: from.midY },
    { x: bendX, y: to.midY },
    { x: endX, y: to.midY }
  ]);
}

function buildDependencyConnectorPath(
  from: BarGeometry,
  to: BarGeometry,
  laneSeed: number
): string {
  const startX = from.x + from.width + DEPENDENCY_ENDPOINT_GAP_PX;
  const endX = to.x - DEPENDENCY_ENDPOINT_GAP_PX;
  const horizontalDistance = endX - startX;
  const stagger = (laneSeed % 4) * DEPENDENCY_BEND_STAGGER_PX;
  const bendX = startX + Math.max(6, Math.min(DEPENDENCY_LANE_ENTRY_MIN_PX, Math.abs(horizontalDistance) / 2)) + stagger;

  if (from.midY === to.midY) {
    return toDependencyPathString([
      { x: startX, y: from.midY },
      { x: endX, y: to.midY }
    ]);
  }

  if (endX < bendX) {
    const approachX = endX - DEPENDENCY_ENDPOINT_GAP_PX * 3;
    const verticalDirection = to.midY > from.midY ? 1 : -1;
    const approachY = to.midY - verticalDirection * (BAR_HEIGHT / 2 + DEPENDENCY_ENDPOINT_GAP_PX);
    return toDependencyPathString([
      { x: startX, y: from.midY },
      { x: bendX, y: from.midY },
      { x: bendX, y: approachY },
      { x: approachX, y: approachY },
      { x: approachX, y: to.midY },
      { x: endX, y: to.midY }
    ]);
  }

  return toDependencyPathString([
    { x: startX, y: from.midY },
    { x: bendX, y: from.midY },
    { x: bendX, y: to.midY },
    { x: endX, y: to.midY }
  ]);
}

function buildDependencyConnectorToPointPath(
  from: BarGeometry,
  targetX: number,
  targetY: number,
  _laneSeed: number
): string {
  const startX = from.x + from.width + DEPENDENCY_ENDPOINT_GAP_PX;
  const safeTargetX = Number.isFinite(targetX) ? targetX : startX + DEPENDENCY_POINTER_SEGMENT_MIN_PX;
  const safeTargetY = Number.isFinite(targetY) ? targetY : from.midY;
  const horizontalDistance = safeTargetX - startX;
  const bendX = startX + Math.max(6, Math.min(DEPENDENCY_LANE_ENTRY_MIN_PX, Math.abs(horizontalDistance) / 2));

  if (from.midY === safeTargetY) {
    return toDependencyPathString([
      { x: startX, y: from.midY },
      { x: safeTargetX, y: safeTargetY }
    ]);
  }

  return toDependencyPathString([
    { x: startX, y: from.midY },
    { x: bendX, y: from.midY },
    { x: bendX, y: safeTargetY },
    { x: safeTargetX, y: safeTargetY }
  ]);
}

const DEPENDENCY_CORNER_RADIUS_PX = 5;

function toDependencyPathString(points: readonly PathPoint[]): string {
  if (points.length === 0) {
    return "";
  }
  if (points.length <= 2) {
    const [first, ...rest] = points;
    return `M ${first.x} ${first.y}${rest.map((p) => ` L ${p.x} ${p.y}`).join("")}`;
  }
  const r = DEPENDENCY_CORNER_RADIUS_PX;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const next = points[i + 1];
    const dxIn = cur.x - prev.x;
    const dyIn = cur.y - prev.y;
    const lenIn = Math.sqrt(dxIn * dxIn + dyIn * dyIn);
    const dxOut = next.x - cur.x;
    const dyOut = next.y - cur.y;
    const lenOut = Math.sqrt(dxOut * dxOut + dyOut * dyOut);
    const clampedR = Math.min(r, lenIn / 2, lenOut / 2);
    if (clampedR < 1) {
      d += ` L ${cur.x} ${cur.y}`;
      continue;
    }
    const beforeX = cur.x - (dxIn / lenIn) * clampedR;
    const beforeY = cur.y - (dyIn / lenIn) * clampedR;
    const afterX = cur.x + (dxOut / lenOut) * clampedR;
    const afterY = cur.y + (dyOut / lenOut) * clampedR;
    d += ` L ${beforeX} ${beforeY} Q ${cur.x} ${cur.y} ${afterX} ${afterY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function deduplicateTimelineDependencies(
  dependencies: TimelineReadModel["dependencies"]
): TimelineReadModel["dependencies"] {
  const unique: TimelineReadModel["dependencies"] = [];
  const seen = new Set<string>();
  dependencies.forEach((dependency) => {
    const key = `${dependency.predecessorWorkItemId}-${dependency.successorWorkItemId}-${dependency.dependencyType}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    unique.push(dependency);
  });
  return unique;
}

function isDependencyViolated(
  predecessorBar: VisualTimelineBar | undefined,
  successorBar: VisualTimelineBar | undefined
): boolean {
  return predecessorBar !== undefined && successorBar !== undefined && predecessorBar.end.getTime() > successorBar.start.getTime();
}

function resolveHoveredDependencyTargetWorkItemId(
  geometryByWorkItemId: ReadonlyMap<number, BarGeometry>,
  svgX: number,
  svgY: number,
  sourceWorkItemId: number
): number | null {
  for (const [workItemId, geometry] of geometryByWorkItemId.entries()) {
    if (workItemId === sourceWorkItemId) {
      continue;
    }

    const withinX = svgX >= geometry.x && svgX <= geometry.x + geometry.width;
    const withinY = svgY >= geometry.y && svgY <= geometry.y + BAR_HEIGHT;
    if (withinX && withinY) {
      return workItemId;
    }
  }

  return null;
}

export function buildTimelinePaneLines(input: {
  timeline: TimelineReadModel | null;
  showDependencies: boolean;
  selectionStore: TimelineSelectionStore;
}): string[] {
  if (!input.timeline) {
    const details = buildTimelineDetailsLines({
      timeline: null,
      selectedWorkItemId: null
    });

    return [
      "Timeline bars (title + state):",
      "- none",
      "Timeline details (mapped ID):",
      "- none",
      "Unschedulable items (title + state):",
      "- none",
      "Unschedulable details (mapped ID):",
      "- none",
      "Dependency arrows: hidden",
      "Dependencies (FS arrows: predecessor end -> successor start):",
      "- hidden by toggle",
      "Suppressed dependencies (details only):",
      "- none",
      "Persistent details panel:",
      ...details
    ];
  }

  const selectableItems = [
    ...input.timeline.bars.map((bar) => ({ workItemId: bar.workItemId })),
    ...input.timeline.unschedulable.map((item) => ({ workItemId: item.workItemId }))
  ];
  const reconciledSelection = input.selectionStore.reconcile(selectableItems);
  if (reconciledSelection === null && selectableItems.length > 0) {
    input.selectionStore.select(selectableItems[0].workItemId);
  }

  const selectedWorkItemId = input.selectionStore.getSelectedWorkItemId();

  const bars = input.timeline.bars.length
    ? input.timeline.bars.map((bar) => {
        const title = truncateTitle(bar.title);
        const halfOpenMarker = bar.schedule.missingBoundary ? ` [half-open:${bar.schedule.missingBoundary}]` : "";
        const selectedMarker = selectedWorkItemId === bar.workItemId ? " [selected]" : "";

        return `- #${bar.details.mappedId} ${title} [${bar.state.badge}|${bar.state.color}]${halfOpenMarker}${selectedMarker}`;
      })
    : ["- none"];

  const barDetails = input.timeline.bars.length
    ? input.timeline.bars.map((bar) => `- #${bar.workItemId} mappedId=${bar.details.mappedId}`)
    : ["- none"];

  const unschedulable = input.timeline.unschedulable.length
    ? input.timeline.unschedulable.map((item) => {
        const title = truncateTitle(item.title);
        const selectedMarker = selectedWorkItemId === item.workItemId ? " [selected]" : "";

        return `- ${title} [${item.state.badge}|${item.state.color}]${selectedMarker}`;
      })
    : ["- none"];

  const unschedulableDetails = input.timeline.unschedulable.length
    ? input.timeline.unschedulable.map((item) => `- #${item.workItemId} mappedId=${item.details.mappedId}`)
    : ["- none"];

  const dependencyToggle = `Dependency arrows: ${input.showDependencies ? "shown" : "hidden"}`;
  const dependencyLines = input.showDependencies
    ? input.timeline.dependencies.length
      ? input.timeline.dependencies.map((arrow) => `- ${arrow.label}`)
      : ["- none"]
    : ["- hidden by toggle"];

  const suppressedDependencies = input.timeline.suppressedDependencies.length
    ? input.timeline.suppressedDependencies.map(
        (dependency) =>
          `- #${dependency.predecessorWorkItemId} -> #${dependency.successorWorkItemId} (${dependency.reason})`
      )
    : ["- none"];

  const detailLines = buildTimelineDetailsLines({
    timeline: input.timeline,
    selectedWorkItemId
  });

  return [
    "Timeline bars (title + state):",
    ...bars,
    "Timeline details (mapped ID):",
    ...barDetails,
    "Unschedulable items (title + state):",
    ...unschedulable,
    "Unschedulable details (mapped ID):",
    ...unschedulableDetails,
    dependencyToggle,
    "Dependencies (FS arrows: predecessor end -> successor start):",
    ...dependencyLines,
    "Suppressed dependencies (details only):",
    ...suppressedDependencies,
    "Persistent details panel:",
    ...detailLines
  ];
}

function truncateTitle(title: string): string {
  if (title.length <= MAX_PRIMARY_TITLE_LENGTH) {
    return title;
  }

  return `${title.slice(0, MAX_PRIMARY_TITLE_LENGTH - 1)}…`;
}

function truncateTitleToBarWidth(title: string, barWidth: number): string {
  const availableWidth = Math.max(0, barWidth - BAR_LABEL_HORIZONTAL_PADDING * 2);
  const maxCharacters = Math.floor(availableWidth / APPROX_BAR_LABEL_CHAR_WIDTH_PX);
  if (maxCharacters <= 0) {
    return "";
  }

  if (title.length <= maxCharacters) {
    return title;
  }

  if (maxCharacters === 1) {
    return title.slice(0, 1);
  }

  return `${title.slice(0, maxCharacters - 1)}…`;
}

export function applyAdoptedSchedules(
  timeline: TimelineReadModel | null,
  adoptedSchedulesByWorkItemId: Record<number, { startDate: string | null; endDate: string | null }>
): TimelineReadModel | null {
  if (!timeline) {
    return null;
  }

  const adoptedEntries = Object.entries(adoptedSchedulesByWorkItemId);
  if (adoptedEntries.length === 0) {
    return timeline;
  }

  const sourceUnschedulableById = new Map(timeline.unschedulable.map((item) => [item.workItemId, item]));
  const adoptedBars = adoptedEntries
    .map(([workItemIdText, schedule]) => {
      const workItemId = Number(workItemIdText);
      const source = sourceUnschedulableById.get(workItemId);
      if (!source) {
        return null;
      }

      return {
        workItemId: source.workItemId,
        title: source.title,
        state: source.state,
        schedule: {
          startDate: schedule.startDate,
          endDate: schedule.endDate,
          missingBoundary: schedule.startDate && schedule.endDate ? null : schedule.startDate ? "end" : "start"
        },
        details: source.details
      };
    })
    .filter((item): item is TimelineReadModel["bars"][number] => item !== null);

  if (adoptedBars.length === 0) {
    return timeline;
  }

  const adoptedIds = new Set(adoptedBars.map((bar) => bar.workItemId));
  return {
    ...timeline,
    bars: [...timeline.bars, ...adoptedBars],
    unschedulable: timeline.unschedulable.filter((item) => !adoptedIds.has(item.workItemId))
  };
}

function applyEditedBarSchedules(
  timeline: TimelineReadModel | null,
  editedBarSchedulesByWorkItemId: Record<number, { startDate: string; endDate: string }>
): TimelineReadModel | null {
  if (!timeline) {
    return null;
  }

  const entries = Object.entries(editedBarSchedulesByWorkItemId);
  if (entries.length === 0) {
    return timeline;
  }

  const overrides = new Map(entries.map(([workItemIdText, schedule]) => [Number(workItemIdText), schedule]));
  let changed = false;
  const bars = timeline.bars.map((bar) => {
    const override = overrides.get(bar.workItemId);
    if (!override) {
      return bar;
    }

    changed = true;
    return {
      ...bar,
      schedule: {
        startDate: override.startDate,
        endDate: override.endDate,
        missingBoundary: null
      }
    };
  });

  return changed ? { ...timeline, bars } : timeline;
}
