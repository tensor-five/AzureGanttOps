import React from "react";

import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";
import type { TimelineDensity } from "./timeline-density-preference.js";
import {
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
import { createTimelineSelectionStore, type TimelineSelectionStore } from "./selection-store.js";

const MAX_PRIMARY_TITLE_LENGTH = 42;

export type TimelinePaneProps = {
  timeline: TimelineReadModel | null;
  showDependencies: boolean;
  isRefreshing?: boolean;
  workItemSyncState?: "up_to_date" | "syncing" | "error";
  workItemSyncError?: string | null;
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
  onFetchWorkItemStateOptions?: (input: { targetWorkItemId: number }) => Promise<Array<{ name: string; color: string | null }>>;
  onDensityChange?: (density: TimelineDensity) => void;
  onRetryRefresh?: () => void;
};

type DragMode = "move" | "resize-start" | "resize-end";

type ActiveScheduleDrag = {
  mode: DragMode;
  pointerId: number;
  workItemId: number;
  originClientX: number;
  startDate: Date;
  endDate: Date;
  lastDayDelta: number;
};

type ActiveUnschedulableDrag = {
  workItemId: number;
  fixedEndDate: Date | null;
};

type UnscheduledDropPreview = {
  startDate: Date;
  endDate: Date;
};

type ActiveDependencyDrag = {
  pointerId: number;
  sourceWorkItemId: number;
  pointerX: number;
  pointerY: number;
  hoveredTargetWorkItemId: number | null;
};

type DependencyViewMode = "edit" | "show" | "none";

type SelectedDependency = {
  predecessorWorkItemId: number;
  successorWorkItemId: number;
  dependencyType: "FS";
};

type TimelineZoomLevel = "week" | "month";

export function TimelinePane(props: TimelinePaneProps): React.ReactElement {
  const internalSelectionStoreRef = React.useRef<TimelineSelectionStore | null>(null);
  if (internalSelectionStoreRef.current === null) {
    internalSelectionStoreRef.current = createTimelineSelectionStore();
  }

  const selectionStore = props.selectionStore ?? internalSelectionStoreRef.current;
  const [adoptedSchedulesByWorkItemId, setAdoptedSchedulesByWorkItemId] = React.useState<
    Record<number, { startDate: string | null; endDate: string | null }>
  >({});
  const [editedBarSchedulesByWorkItemId, setEditedBarSchedulesByWorkItemId] = React.useState<
    Record<number, { startDate: string; endDate: string }>
  >({});
  const effectiveTimeline = React.useMemo(() => {
    const withAdopted = applyAdoptedSchedules(props.timeline, adoptedSchedulesByWorkItemId);
    return applyEditedBarSchedules(withAdopted, editedBarSchedulesByWorkItemId);
  }, [props.timeline, adoptedSchedulesByWorkItemId, editedBarSchedulesByWorkItemId]);
  const [selectedWorkItemId, setSelectedWorkItemId] = React.useState<number | null>(() =>
    selectionStore.getSelectedWorkItemId()
  );
  const [adoptScheduleError, setAdoptScheduleError] = React.useState<string | null>(null);
  const [dayWidthPx, setDayWidthPx] = React.useState<number>(DAY_WIDTH_WEEK_PX);
  const [activeScheduleDrag, setActiveScheduleDrag] = React.useState<ActiveScheduleDrag | null>(null);
  const [activeUnschedulableDrag, setActiveUnschedulableDrag] = React.useState<ActiveUnschedulableDrag | null>(null);
  const [activeDependencyDrag, setActiveDependencyDrag] = React.useState<ActiveDependencyDrag | null>(null);
  const [unscheduledDropPreview, setUnscheduledDropPreview] = React.useState<UnscheduledDropPreview | null>(null);
  const [dependencyViewMode, setDependencyViewMode] = React.useState<DependencyViewMode>("show");
  const [selectedDependency, setSelectedDependency] = React.useState<SelectedDependency | null>(null);
  const [detailsCollapsed, setDetailsCollapsed] = React.useState(false);
  const [colorCoding, setColorCoding] = React.useState<TimelineColorCoding>(() => loadLastTimelineColorCoding() ?? "none");
  const [fieldColorCoding, setFieldColorCoding] = React.useState<TimelineFieldColorCodingConfig>(() =>
    loadTimelineFieldColorCodingConfig()
  );
  const [lastSelectedFieldRef, setLastSelectedFieldRef] = React.useState<string | null>(() =>
    loadTimelineFieldColorCodingConfig().fieldRef
  );
  const [colorSettingsOpen, setColorSettingsOpen] = React.useState(false);
  const [colorCodingDropdownOpen, setColorCodingDropdownOpen] = React.useState(false);
  const [colorCodingSearchDraft, setColorCodingSearchDraft] = React.useState("");
  const [chartViewportWidthPx, setChartViewportWidthPx] = React.useState<number>(0);

  const chartScrollRef = React.useRef<HTMLDivElement | null>(null);
  const chartSvgRef = React.useRef<SVGSVGElement | null>(null);
  const colorCodingControlRef = React.useRef<HTMLDivElement | null>(null);
  const zoomAnchorRef = React.useRef<{ dayOffset: number; pointerOffsetX: number } | null>(null);
  const initialViewportAppliedRef = React.useRef(false);
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

  React.useEffect(() => {
    hydrateTimelineColorCodingPreference((mode) => {
      setColorCoding(mode);
      const config = loadTimelineFieldColorCodingConfig();
      setFieldColorCoding(config);
      if (config.fieldRef) {
        setLastSelectedFieldRef(config.fieldRef);
      }
    });
  }, []);

  React.useEffect(() => {
    if (!colorCodingDropdownOpen) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }

      const control = colorCodingControlRef.current;
      if (control && control.contains(target)) {
        return;
      }

      setColorCodingDropdownOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setColorCodingDropdownOpen(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [colorCodingDropdownOpen]);

  React.useEffect(() => {
    setAdoptedSchedulesByWorkItemId({});
    setEditedBarSchedulesByWorkItemId({});
    setActiveScheduleDrag(null);
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
    if (!selectedDependency || !effectiveTimeline) {
      return;
    }

    const stillPresent = effectiveTimeline.dependencies.some(
      (dependency) =>
        dependency.predecessorWorkItemId === selectedDependency.predecessorWorkItemId &&
        dependency.successorWorkItemId === selectedDependency.successorWorkItemId &&
        dependency.dependencyType === selectedDependency.dependencyType
    );
    if (!stillPresent) {
      setSelectedDependency(null);
    }
  }, [effectiveTimeline, selectedDependency]);

  React.useEffect(() => {
    const selectableItems = [
      ...(effectiveTimeline?.bars.map((bar) => ({ workItemId: bar.workItemId })) ?? []),
      ...(effectiveTimeline?.unschedulable.map((item) => ({ workItemId: item.workItemId })) ?? [])
    ];
    const reconciled = selectionStore.reconcile(selectableItems);
    setSelectedWorkItemId(reconciled);
  }, [effectiveTimeline, selectionStore]);

  const selectWorkItem = React.useCallback(
    (workItemId: number | null) => {
      selectionStore.select(workItemId);
      setSelectedWorkItemId(workItemId);
    },
    [selectionStore]
  );

  const adoptUnschedulableSchedule = React.useCallback(
    async (targetWorkItemId: number, sourceWorkItemId: number) => {
      const sourceBar = effectiveTimeline?.bars.find((bar) => bar.workItemId === sourceWorkItemId) ?? null;
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
    [effectiveTimeline, props]
  );

  const zoomLevel: TimelineZoomLevel = dayWidthPx >= DAY_WIDTH_MODE_SWITCH_PX ? "week" : "month";
  const availableFieldRefs = React.useMemo(() => listAvailableColorCodingFields(effectiveTimeline), [effectiveTimeline]);
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
  const colorByWorkItemId = React.useMemo(
    () => buildColorByWorkItemId(effectiveTimeline, colorCoding, fieldColorCoding),
    [effectiveTimeline, colorCoding, fieldColorCoding]
  );
  const chartModel = React.useMemo(
    () => buildVisualChartModel(effectiveTimeline, dayWidthPx, zoomLevel, colorByWorkItemId, chartViewportWidthPx),
    [effectiveTimeline, dayWidthPx, zoomLevel, colorByWorkItemId, chartViewportWidthPx]
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

      const todayTargetX = clientWidth * TODAY_INITIAL_VIEWPORT_RATIO;
      const absoluteTodayX = chartModel.todayX === null ? 0 : CHART_LEFT_GUTTER + chartModel.todayX;
      const maxScrollLeft = Math.max(0, scrollElement.scrollWidth - clientWidth);
      const maxScrollTop = Math.max(0, scrollElement.scrollHeight - clientHeight);
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
  }, [chartModel.bars.length, chartModel.todayX, chartModel.width]);

  React.useEffect(() => {
    const scrollElement = chartScrollRef.current;
    if (!scrollElement || chartModel.bars.length === 0) {
      setChartViewportWidthPx(0);
      return;
    }

    const updateViewportWidth = (): void => {
      setChartViewportWidthPx(scrollElement.clientWidth);
    };

    updateViewportWidth();

    if (typeof ResizeObserver !== "undefined") {
      const resizeObserver = new ResizeObserver(() => {
        updateViewportWidth();
      });
      resizeObserver.observe(scrollElement);
      return () => {
        resizeObserver.disconnect();
      };
    }

    window.addEventListener("resize", updateViewportWidth);
    return () => {
      window.removeEventListener("resize", updateViewportWidth);
    };
  }, [chartModel.bars.length]);

  React.useEffect(() => {
    const anchor = zoomAnchorRef.current;
    const scrollElement = chartScrollRef.current;
    if (!anchor || !scrollElement) {
      return;
    }

    const absoluteTargetX = CHART_LEFT_GUTTER + anchor.dayOffset * chartModel.dayWidthPx;
    const desiredScrollLeft = absoluteTargetX - anchor.pointerOffsetX;
    scrollElement.scrollLeft = Math.max(0, desiredScrollLeft);
    zoomAnchorRef.current = null;
  }, [chartModel.dayWidthPx]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && selectedDependency && props.onRemoveDependency) {
        event.preventDefault();
        void props
          .onRemoveDependency({
            predecessorWorkItemId: selectedDependency.predecessorWorkItemId,
            successorWorkItemId: selectedDependency.successorWorkItemId
          })
          .catch((error) => {
            const message = error instanceof Error ? error.message : "Unknown error";
            setAdoptScheduleError(message);
          });
        setSelectedDependency(null);
        return;
      }

      if (event.key.toLowerCase() !== "r") {
        return;
      }

      if (props.isRefreshing === true) {
        return;
      }

      props.onRetryRefresh?.();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [props.isRefreshing, props.onRemoveDependency, props.onRetryRefresh, selectedDependency]);

  const handleChartWheel = React.useCallback(
    (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }

      const svg = chartSvgRef.current;
      const scrollElement = chartScrollRef.current;
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
      const zoomMultiplier = Math.exp(-event.deltaY * 0.0025);
      const nextDayWidth = clamp(dayWidthPx * zoomMultiplier, DAY_WIDTH_MONTH_PX, DAY_WIDTH_WEEK_PX);

      if (Math.abs(nextDayWidth - dayWidthPx) < 0.01) {
        return;
      }

      zoomAnchorRef.current = { dayOffset, pointerOffsetX };
      setDayWidthPx(nextDayWidth);
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

  const geometryByWorkItemId = React.useMemo(() => {
    const byId = new Map<number, BarGeometry>();
    chartModel.bars.forEach((bar, index) => {
      const y = CHART_TOP_PADDING + index * CHART_ROW_HEIGHT;
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
  const dependencyConnectors = React.useMemo(() => {
    if (!dependencyVisible || !effectiveTimeline) {
      return [] as VisualDependencyConnector[];
    }

    return effectiveTimeline.dependencies.flatMap((dependency, index) => {
      const from = geometryByWorkItemId.get(dependency.predecessorWorkItemId);
      const to = geometryByWorkItemId.get(dependency.successorWorkItemId);
      if (!from || !to) {
        return [];
      }
      const predecessorBar = chartBarByWorkItemId.get(dependency.predecessorWorkItemId);
      const successorBar = chartBarByWorkItemId.get(dependency.successorWorkItemId);
      const isViolated =
        predecessorBar !== undefined &&
        successorBar !== undefined &&
        predecessorBar.end.getTime() > successorBar.start.getTime();
      const predecessorToSuccessorGapDays =
        predecessorBar !== undefined && successorBar !== undefined ? dayDiff(predecessorBar.end, successorBar.start) : null;
      const forceNearGapDetour =
        predecessorToSuccessorGapDays !== null &&
        predecessorToSuccessorGapDays >= 1 &&
        predecessorToSuccessorGapDays <= DEPENDENCY_NEAR_GAP_DAYS_FOR_DETOUR;

      return [
        {
          key: `${dependency.predecessorWorkItemId}-${dependency.successorWorkItemId}-${index}`,
          path: buildDependencyConnectorPath(from, to, index, { forceNearGapDetour }),
          markerEnd: `url(#${isViolated ? dependencyAlertMarkerId : dependencyMarkerId})`,
          predecessorWorkItemId: dependency.predecessorWorkItemId,
          successorWorkItemId: dependency.successorWorkItemId,
          dependencyType: dependency.dependencyType,
          isViolated
        }
      ];
    });
  }, [chartBarByWorkItemId, dependencyAlertMarkerId, dependencyMarkerId, dependencyVisible, effectiveTimeline, geometryByWorkItemId]);
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
        startDate: input.bar.start,
        endDate: input.bar.end,
        lastDayDelta: 0
      });
    },
    [canEditSchedule, selectWorkItem]
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

  const handleChartPointerMove = React.useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const activeDependency = activeDependencyDrag;
      if (activeDependency && event.pointerId === activeDependency.pointerId) {
        const svgPoint = clientPointToSvg(event.clientX, event.clientY, chartSvgRef.current);
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

      const deltaDays = clientDeltaToDays(event.clientX - active.originClientX, chartSvgRef.current, chartModel.dayWidthPx);
      if (deltaDays === active.lastDayDelta) {
        return;
      }

      const next = calculateDraggedSchedule(active.mode, active.startDate, active.endDate, deltaDays);
      setActiveScheduleDrag((current) => (current ? { ...current, lastDayDelta: deltaDays } : current));
      updateEditedSchedule(active.workItemId, next.startDate, next.endDate);
    },
    [activeDependencyDrag, activeScheduleDrag, chartModel.dayWidthPx, geometryByWorkItemId, updateEditedSchedule]
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
      saveTimelineFieldColorCodingConfig(next);
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
        valueColors: normalizedFieldRef ? fieldColorCoding.valueColors : {}
      });
    },
    [fieldColorCoding.valueColors, updateFieldColorCoding]
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
        valueColors: nextValueColors
      });
    },
    [fieldColorCoding.fieldRef, fieldColorCoding.valueColors, updateFieldColorCoding]
  );

  const updateModeValueColor = React.useCallback(
    (mode: TimelineColorCoding, valueKey: string, color: string | null) => {
      const scopedKey = toScopedModeValueColorKey(mode, valueKey);
      if (!scopedKey) {
        return;
      }

      const nextValueColors = { ...fieldColorCoding.valueColors };
      if (!color) {
        delete nextValueColors[scopedKey];
        delete nextValueColors[valueKey];
      } else {
        nextValueColors[scopedKey] = color;
      }

      updateFieldColorCoding({
        fieldRef: fieldColorCoding.fieldRef,
        valueColors: nextValueColors
      });
    },
    [fieldColorCoding.fieldRef, fieldColorCoding.valueColors, updateFieldColorCoding]
  );

  const selectColorCodingOption = React.useCallback(
    (option: ColorCodingOption) => {
      setColorCoding(option.mode);
      saveLastTimelineColorCoding(option.mode);
      if (option.mode === "field") {
        selectFieldForColorCoding(option.fieldRef);
      } else {
        updateFieldColorCoding({
          fieldRef: null,
          valueColors: fieldColorCoding.valueColors
        });
      }
      setColorCodingDropdownOpen(false);
      setColorCodingSearchDraft("");
    },
    [fieldColorCoding.valueColors, selectFieldForColorCoding, updateFieldColorCoding]
  );

  const applyFirstFilteredColorCodingOption = React.useCallback((): boolean => {
    const preferredOption = pickPreferredColorCodingOption(filteredColorCodingOptions, colorCodingSearchDraft);
    if (!preferredOption) {
      return false;
    }

    selectColorCodingOption(preferredOption);
    return true;
  }, [colorCodingSearchDraft, filteredColorCodingOptions, selectColorCodingOption]);

  const detailProps: TimelineDetailsPanelProps = {
    timeline: effectiveTimeline,
    selectedWorkItemId,
    collapsed: detailsCollapsed,
    onToggleCollapsed: () => {
      setDetailsCollapsed((current) => !current);
    },
    organization: props.organization,
    project: props.project,
    onUpdateSelectedWorkItemDetails: props.onUpdateSelectedWorkItemDetails,
    onFetchWorkItemStateOptions: props.onFetchWorkItemStateOptions
  };

  const barCount = chartModel.bars.length;
  const unscheduledCount = effectiveTimeline?.unschedulable.length ?? 0;
  const selectedColorCodingLabel = resolveSelectedColorCodingLabel(colorCoding, fieldColorCoding.fieldRef);
  const isFieldColorCodingMode = colorCoding === "field";
  const isConfigurableModeColorCoding = colorCoding === "person" || colorCoding === "status";

  return React.createElement(
    "section",
    {
      "aria-label": "timeline-pane",
      className: "timeline-pane"
    },
    React.createElement(
      "div",
      {
        className: "timeline-pane-actions"
      },
      React.createElement(
        "div",
        { className: "timeline-pane-actions-group" },
        React.createElement(
          "button",
          {
            type: "button",
            className: "timeline-action-button timeline-action-button-primary",
            disabled: props.isRefreshing === true,
            "aria-busy": props.isRefreshing === true ? "true" : undefined,
            onClick: () => {
              props.onRetryRefresh?.();
            }
          },
          props.isRefreshing
            ? React.createElement(
                "span",
                { className: "timeline-action-button-content" },
                React.createElement("span", {
                  className: "timeline-action-button-spinner",
                  "aria-hidden": "true"
                }),
                React.createElement("span", null, "Updating...")
              )
            : "Refresh"
        ),
        React.createElement(
          "div",
          {
            className:
              "timeline-density-controls timeline-density-controls-harmonized timeline-density-controls-zoom timeline-control-cluster",
            role: "group",
            "aria-label": "Timeline zoom"
          },
          React.createElement(
            "button",
            {
              type: "button",
              className: zoomLevel === "week" ? "timeline-density-button timeline-density-button-active" : "timeline-density-button",
              "aria-pressed": zoomLevel === "week",
              "aria-label": "Zoom in to week view",
              onClick: () => {
                setDayWidthPx(DAY_WIDTH_WEEK_PX);
              }
            },
            "Week"
          ),
          React.createElement(
            "button",
            {
              type: "button",
              className: zoomLevel === "month" ? "timeline-density-button timeline-density-button-active" : "timeline-density-button",
              "aria-pressed": zoomLevel === "month",
              "aria-label": "Zoom out to month view",
              onClick: () => {
                setDayWidthPx(DAY_WIDTH_MONTH_PX);
              }
            },
            "Month"
          )
        ),
        React.createElement(
          "div",
          {
            className: "timeline-density-controls timeline-density-controls-harmonized timeline-density-controls-dependency",
            role: "group",
            "aria-label": "Dependency mode"
          },
          React.createElement(
            "button",
            {
              type: "button",
              className: dependencyViewMode === "edit" ? "timeline-density-button timeline-density-button-active" : "timeline-density-button",
              "aria-pressed": dependencyViewMode === "edit",
              "aria-label": "Cycle dependency mode",
              onClick: () => {
                setDependencyViewMode((current) =>
                  current === "show" ? "edit" : current === "edit" ? "none" : "show"
                );
                setActiveDependencyDrag(null);
                setActiveScheduleDrag(null);
                setActiveUnschedulableDrag(null);
                setUnscheduledDropPreview(null);
                setSelectedDependency(null);
              }
            },
            dependencyViewMode === "edit"
              ? "Edit Dependency"
              : dependencyViewMode === "show"
                ? "Show Dependency"
                : "No Dependency"
          )
        ),
        React.createElement(
          "div",
          { className: "timeline-color-coding-control timeline-control-cluster", ref: colorCodingControlRef },
          React.createElement("span", { className: "timeline-color-coding-label" }, "Color coding"),
          React.createElement(
            "button",
            {
              type: "button",
              className: "timeline-color-coding-select timeline-color-coding-select-trigger",
              "aria-label": "Color coding",
              "aria-haspopup": "listbox",
              "aria-expanded": colorCodingDropdownOpen ? "true" : "false",
              onClick: () => {
                setColorCodingDropdownOpen((current) => !current);
                setColorCodingSearchDraft("");
              }
            },
            selectedColorCodingLabel
          ),
          colorCodingDropdownOpen
            ? React.createElement(
                "div",
                { className: "timeline-color-coding-dropdown", role: "listbox", "aria-label": "Color coding options" },
                React.createElement("input", {
                  type: "search",
                  className: "timeline-color-coding-dropdown-search",
                  "aria-label": "Search color coding",
                  placeholder: "Search mode or field",
                  value: colorCodingSearchDraft,
                  onChange: (event) => {
                    setColorCodingSearchDraft((event.target as HTMLInputElement).value);
                  },
                  onKeyDown: (event) => {
                    if (event.key !== "Enter") {
                      return;
                    }

                    event.preventDefault();
                    applyFirstFilteredColorCodingOption();
                  }
                }),
                React.createElement(
                  "div",
                  { className: "timeline-color-coding-dropdown-options" },
                  filteredColorCodingOptions.length === 0
                    ? React.createElement("p", { className: "timeline-details-muted" }, "No matching option.")
                    : filteredColorCodingOptions.map((option) =>
                        React.createElement(
                          "button",
                          {
                            key: option.key,
                            type: "button",
                            className:
                              option.mode === colorCoding &&
                              ((option.mode !== "field" && colorCoding !== "field") || option.fieldRef === fieldColorCoding.fieldRef)
                                ? "timeline-color-coding-option timeline-color-coding-option-active"
                                : "timeline-color-coding-option",
                            onClick: () => {
                              selectColorCodingOption(option);
                            }
                          },
                          React.createElement("span", { className: "timeline-color-coding-option-label" }, option.label),
                          option.subtitle
                            ? React.createElement("span", { className: "timeline-color-coding-option-subtitle" }, option.subtitle)
                            : null
                        )
                      )
                )
              )
            : null,
          React.createElement(
            "button",
            {
              type: "button",
              className: "timeline-color-coding-settings-button",
              "aria-label": "Open color coding settings",
              onClick: () => {
                if (colorCodingDropdownOpen && colorCodingSearchDraft.trim().length > 0) {
                  applyFirstFilteredColorCodingOption();
                }
                setColorSettingsOpen(true);
              }
            },
            "Settings"
          )
        )
      ),
      React.createElement(
        "div",
        { className: "timeline-pane-actions-status" },
        React.createElement(
          "div",
          {
            className: "gantt-sync-status",
            "data-state": props.workItemSyncState ?? "up_to_date",
            role: "status",
            "aria-live": "polite",
            title: props.workItemSyncState === "error" ? props.workItemSyncError ?? undefined : undefined
          },
          React.createElement("span", { className: "gantt-sync-status-dot", "aria-hidden": "true" }),
          React.createElement(
            "span",
            null,
            props.workItemSyncState === "syncing"
              ? "Updating work items..."
              : props.workItemSyncState === "error"
                ? "Work item update failed"
                : "Work items up to date"
          )
        )
      ),
    ),
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
    colorSettingsOpen
      ? React.createElement(
          "div",
          {
            className: "timeline-color-coding-modal-backdrop",
            role: "presentation",
            onClick: () => {
              setColorSettingsOpen(false);
            }
          },
          React.createElement(
            "section",
            {
              className: "timeline-color-coding-modal",
              role: "dialog",
              "aria-modal": "true",
              "aria-label": "Color coding settings",
              onClick: (event) => {
                event.stopPropagation();
              }
            },
            React.createElement(
              "header",
              { className: "timeline-color-coding-modal-header" },
              React.createElement("h4", null, "Color coding settings"),
              React.createElement(
                "button",
                {
                  type: "button",
                  className: "timeline-color-coding-settings-button",
                  onClick: () => {
                    setColorSettingsOpen(false);
                  }
                },
                "Close"
              )
            ),
            React.createElement(
              "p",
              { className: "timeline-color-coding-active-selection" },
              `Active selection: ${resolveSelectedColorCodingLabel(colorCoding, selectedFieldRef)}`
            ),
            React.createElement(
              "p",
              { className: "timeline-color-coding-modal-field" },
              isFieldColorCodingMode
                ? selectedFieldRef
                  ? `Field: ${selectedFieldRef}`
                  : "Field: Select a field from the Color coding dropdown first."
                : `Mode: ${resolveSelectedColorCodingLabel(colorCoding, selectedFieldRef)}`
            ),
            isFieldColorCodingMode && selectedFieldRef
              ? React.createElement(
                  "div",
                  { className: "timeline-color-coding-value-grid", key: `field-values-${selectedFieldRef}` },
                  selectedFieldValueStats.length === 0
                    ? React.createElement("p", { className: "timeline-details-muted" }, "No values found for selected field.")
                    : selectedFieldValueStats.map((entry) => {
                        const scopedKey = toScopedFieldValueColorKey(selectedFieldRef, entry.key);
                        const customColor =
                          (scopedKey ? fieldColorCoding.valueColors[scopedKey] : null) ?? fieldColorCoding.valueColors[entry.key] ?? null;
                        const effectiveColor = customColor ?? entry.defaultColor;
                        return React.createElement(
                          "div",
                          { key: entry.key, className: "timeline-color-coding-value-row" },
                          React.createElement(
                            "div",
                            { className: "timeline-color-coding-value-meta" },
                            React.createElement("strong", null, entry.label),
                            React.createElement("span", null, `${entry.count} item(s)`)
                          ),
                          React.createElement("input", {
                            type: "color",
                            value: effectiveColor,
                            "aria-label": `Color for ${entry.label}`,
                            onChange: (event) => {
                              updateFieldValueColor(entry.key, (event.target as HTMLInputElement).value);
                            }
                          }),
                          React.createElement(
                            "button",
                            {
                              type: "button",
                              className: "timeline-color-coding-value-reset",
                              onClick: () => {
                                updateFieldValueColor(entry.key, null);
                              }
                            },
                            "Auto"
                          )
                        );
                      })
                )
              : isConfigurableModeColorCoding
                ? React.createElement(
                    "div",
                    { className: "timeline-color-coding-value-grid", key: `mode-values-${colorCoding}` },
                    selectedModeValueStats.length === 0
                      ? React.createElement("p", { className: "timeline-details-muted" }, "No values found for selected mode.")
                      : selectedModeValueStats.map((entry) => {
                          const scopedKey = toScopedModeValueColorKey(colorCoding, entry.key);
                          const customColor =
                            (scopedKey ? fieldColorCoding.valueColors[scopedKey] : null) ??
                            fieldColorCoding.valueColors[entry.key] ??
                            null;
                          const effectiveColor = customColor ?? entry.defaultColor;

                          return React.createElement(
                            "div",
                            { key: entry.key, className: "timeline-color-coding-value-row" },
                            React.createElement(
                              "div",
                              { className: "timeline-color-coding-value-meta" },
                              React.createElement("strong", null, entry.label),
                              React.createElement("span", null, `${entry.count} item(s)`)
                            ),
                            React.createElement("input", {
                              type: "color",
                              value: effectiveColor,
                              "aria-label": `Color for ${entry.label}`,
                              onChange: (event) => {
                                updateModeValueColor(colorCoding, entry.key, (event.target as HTMLInputElement).value);
                              }
                            }),
                            React.createElement(
                              "button",
                              {
                                type: "button",
                                className: "timeline-color-coding-value-reset",
                                onClick: () => {
                                  updateModeValueColor(colorCoding, entry.key, null);
                                }
                              },
                              "Auto"
                            )
                          );
                        })
                  )
              : React.createElement(
                  "p",
                  { className: "timeline-details-muted" },
                  isFieldColorCodingMode
                    ? "Select a field to configure value-to-color mapping."
                    : "This mode does not require field selection."
                )
          )
        )
      : null,
    React.createElement(
      "div",
      { className: detailsCollapsed ? "timeline-main-grid timeline-main-grid-details-collapsed" : "timeline-main-grid" },
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
              {
                className: activeScheduleDrag ? "timeline-chart-scroll timeline-chart-scroll-dragging" : "timeline-chart-scroll",
                ref: chartScrollRef
              },
              React.createElement(
                "svg",
                {
                  className:
                    activeUnschedulableDrag && !activeScheduleDrag
                      ? "timeline-chart timeline-chart-unscheduled-drop-active"
                      : "timeline-chart",
                  viewBox: `0 0 ${chartModel.width} ${chartModel.height}`,
                  role: "img",
                  "aria-label": "gantt-chart",
                  style: { width: `${chartModel.width}px` },
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
                chartModel.currentPeriod
                  ? React.createElement("rect", {
                      x: CHART_LEFT_GUTTER + chartModel.currentPeriod.x,
                      y: CHART_GRID_START_Y,
                      width: chartModel.currentPeriod.width,
                      height: chartModel.height - CHART_BOTTOM_PADDING - CHART_GRID_START_Y,
                      className: "timeline-current-period-highlight"
                    })
                  : null,
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
                chartModel.monthBoundaries.map((boundaryX) =>
                  React.createElement("line", {
                    key: `month-boundary-${boundaryX}`,
                    x1: CHART_LEFT_GUTTER + boundaryX,
                    y1: CHART_GRID_START_Y,
                    x2: CHART_LEFT_GUTTER + boundaryX,
                    y2: chartModel.height - CHART_BOTTOM_PADDING,
                    className: "timeline-month-boundary-line"
                  })
                ),
                chartModel.monthLabels.map((month) =>
                  React.createElement(
                    "text",
                    {
                      key: `month-label-${month.x}-${month.label}`,
                      x: CHART_LEFT_GUTTER + month.x,
                      y: CHART_AXIS_MONTH_LABEL_Y,
                      className: "timeline-axis-month-label"
                    },
                    month.label
                  )
                ),
                chartModel.ticks.map((tick) =>
                  React.createElement(
                    "g",
                    { key: `${tick.x}-${tick.label}` },
                    React.createElement("line", {
                      x1: CHART_LEFT_GUTTER + tick.x,
                      y1: CHART_GRID_START_Y,
                      x2: CHART_LEFT_GUTTER + tick.x,
                      y2: chartModel.height - CHART_BOTTOM_PADDING,
                      className: "timeline-grid-line"
                    }),
                    React.createElement(
                      "text",
                      {
                        x: CHART_LEFT_GUTTER + tick.x + 4,
                        y: CHART_AXIS_TICK_LABEL_Y,
                        className: "timeline-axis-label"
                      },
                      tick.label
                    )
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
                      }),
                      React.createElement(
                        "text",
                        {
                          x: CHART_LEFT_GUTTER + chartModel.todayX,
                          y: CHART_AXIS_TODAY_LABEL_Y,
                          className: "timeline-today-label"
                        },
                        "Today"
                      )
                    )
                  : null,
                chartModel.bars.map((bar, index) => {
                  const y = CHART_TOP_PADDING + index * CHART_ROW_HEIGHT;
                  const isSelected = selectedWorkItemId === bar.workItemId;
                  const barClassName = ["timeline-bar", isSelected ? "timeline-bar-selected" : "", canEditSchedule ? "timeline-bar-editable" : ""]
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
                        selectWorkItem(bar.workItemId);
                      },
                      onKeyDown: (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          selectWorkItem(bar.workItemId);
                        }
                      },
                      onPointerDown: (event) => {
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
                            void beginBarDrag({ event, mode: "resize-end", bar });
                          }
                        })
                      : null,
                    React.createElement(
                      "text",
                      {
                        x: CHART_LEFT_GUTTER + bar.x + 18,
                        y: y + 16,
                        className: ["timeline-bar-label", isSelected ? "timeline-bar-label-selected" : ""].filter(Boolean).join(" ")
                      },
                      truncateTitleToBarWidth(bar.title, bar.width)
                    ),
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
                  const className = [
                    "timeline-dependency-line",
                    connector.isViolated ? "timeline-dependency-line-violated" : "",
                    isSelected ? "timeline-dependency-line-selected" : ""
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return React.createElement("path", {
                    key: connector.key,
                    d: connector.path,
                    className,
                    markerEnd: connector.markerEnd,
                    "aria-label": `dependency-${connector.predecessorWorkItemId}-${connector.successorWorkItemId}`,
                    onClick: () => {
                      setSelectedDependency({
                        predecessorWorkItemId: connector.predecessorWorkItemId,
                        successorWorkItemId: connector.successorWorkItemId,
                        dependencyType: connector.dependencyType
                      });
                    }
                  });
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
            ),
        React.createElement(
          "div",
          { className: "timeline-unschedulable-list" },
          React.createElement(
            "div",
            { className: "timeline-unschedulable-header" },
            React.createElement("h4", null, "Unscheduled")
          ),
          effectiveTimeline?.unschedulable.length
            ? React.createElement(
                "ul",
                null,
                ...effectiveTimeline.unschedulable.map((item) =>
                  React.createElement(
                    "li",
                    { key: item.workItemId },
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
                            selectWorkItem(item.workItemId);
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
            : React.createElement("div", null, "None")
        )
      ),
      React.createElement(TimelineDetailsPanel, detailProps)
    )
  );
}

const BAR_HEIGHT = 24;
const BAR_ROW_GAP = 2;
const CHART_ROW_HEIGHT = BAR_HEIGHT + BAR_ROW_GAP;
const CHART_TOP_PADDING = 56;
const CHART_BOTTOM_PADDING = 18;
const CHART_LEFT_GUTTER = 24;
const CHART_AXIS_TODAY_LABEL_Y = CHART_TOP_PADDING - 46;
const CHART_AXIS_MONTH_LABEL_Y = CHART_TOP_PADDING - 32;
const CHART_AXIS_TICK_LABEL_Y = CHART_TOP_PADDING - 16;
const CHART_GRID_START_Y = CHART_TOP_PADDING - 10;
const TODAY_INITIAL_VIEWPORT_RATIO = 0.38;
const DAY_WIDTH_WEEK_PX = 22;
const DAY_WIDTH_MONTH_PX = 8;
const DAY_WIDTH_MODE_SWITCH_PX = (DAY_WIDTH_WEEK_PX + DAY_WIDTH_MONTH_PX) / 2;
const MIN_BAR_WIDTH_PX = 10;
const HANDLE_WIDTH = 8;
const DEFAULT_UNSCHEDULED_DURATION_DAYS = 14;
const BAR_LABEL_HORIZONTAL_PADDING = 8;
const APPROX_BAR_LABEL_CHAR_WIDTH_PX = 6.5;
const DEFAULT_NEUTRAL_TIMELINE_COLOR = "#374151";
const OVERDUE_TIMELINE_COLOR = "#b91c1c";
const OVERDUE_OK_TIMELINE_COLOR = "#475569";
const DEPENDENCY_ENDPOINT_GAP_PX = 6;
const DEPENDENCY_LEFT_APPROACH_PX = 16;
const DEPENDENCY_POINTER_SEGMENT_MIN_PX = 14;
const DEPENDENCY_LANE_COUNT = 3;
const DEPENDENCY_LANE_GAP_PX = 6;
const DEPENDENCY_LANE_TOP_OFFSET_PX = 6;
const DEPENDENCY_LANE_ENTRY_MIN_PX = 12;
const DEPENDENCY_LANE_MIN_Y_OFFSET_FROM_GRID_START_PX = 4;
const DEPENDENCY_NEAR_GAP_DAYS_FOR_DETOUR = 2;
const DEPENDENCY_TIGHT_GAP_DETOUR_MIN_PX = 9;
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

type VisualTimelineBar = {
  workItemId: number;
  mappedId: string;
  title: string;
  color: string;
  stateColor: string;
  stateBadge: string;
  x: number;
  width: number;
  start: Date;
  end: Date;
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
  dayWidthPx: number;
  bars: VisualTimelineBar[];
  ticks: { x: number; label: string }[];
  dailyGridLines: number[];
  monthBoundaries: number[];
  monthLabels: { x: number; label: string }[];
  domainStart: Date;
  currentPeriod: { x: number; width: number } | null;
  todayX: number | null;
};

function buildVisualChartModel(
  timeline: TimelineReadModel | null,
  dayWidthPx: number,
  zoomLevel: TimelineZoomLevel,
  colorByWorkItemId: ReadonlyMap<number, string>,
  viewportWidthPx: number
): VisualChartModel {
  if (!timeline || timeline.bars.length === 0) {
    const todayUtc = new Date();
    const normalizedTodayUtc = new Date(
      Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate())
    );
    return {
      width: 900,
      height: 180,
      dayWidthPx,
      bars: [],
      ticks: [],
      dailyGridLines: [],
      monthBoundaries: [],
      monthLabels: [],
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
      dayWidthPx,
      bars: [],
      ticks: [],
      dailyGridLines: [],
      monthBoundaries: [],
      monthLabels: [],
      domainStart: addDays(normalizedTodayUtc, -1),
      currentPeriod: null,
      todayX: null
    };
  }

  const minStart = new Date(Math.min(...normalizedBars.map((bar) => bar.start.getTime())));
  const maxEnd = new Date(Math.max(...normalizedBars.map((bar) => bar.end.getTime())));
  const domainStart = addDays(minStart, -1);
  const domainEnd = addDays(maxEnd, 1);
  const timelineCanvasMinWidthPx = Math.max(0, viewportWidthPx - CHART_LEFT_GUTTER - 80);
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

  const bars = normalizedBars.map((bar) => {
    const startOffset = dayDiff(domainStart, bar.start);
    const spanDays = Math.max(1, dayDiffInclusive(bar.start, bar.end));
    return {
      workItemId: bar.source.workItemId,
      mappedId: bar.source.details.mappedId,
      title: bar.source.title,
      color: colorByWorkItemId.get(bar.source.workItemId) ?? bar.source.state.color,
      stateColor: bar.source.state.color,
      stateBadge: bar.source.state.badge,
      start: bar.start,
      end: bar.end,
      x: startOffset * dayWidthPx,
      width: Math.max(MIN_BAR_WIDTH_PX, spanDays * dayWidthPx)
    };
  });

  const ticks = buildAdaptiveTicks(domainStart, totalDays, zoomLevel, dayWidthPx);
  const dailyGridLines = zoomLevel === "week" ? buildDailyGridLines(totalDays, dayWidthPx) : [];
  const { monthBoundaries, monthLabels } = buildMonthAxisMarkers(domainStart, totalDays, dayWidthPx);

  const timelineWidth = totalDays * dayWidthPx;

  return {
    width: Math.max(900, CHART_LEFT_GUTTER + timelineWidth + 80),
    height: CHART_TOP_PADDING + (bars.length + 1) * CHART_ROW_HEIGHT + CHART_BOTTOM_PADDING,
    dayWidthPx,
    bars,
    ticks,
    dailyGridLines,
    monthBoundaries,
    monthLabels,
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
      assignedTo: bar.details.assignedTo ?? null,
      parentWorkItemId: bar.details.parentWorkItemId ?? null,
      fieldValues: bar.details.fieldValues ?? {},
      fallbackColor: bar.state.color
    })),
    ...timeline.unschedulable.map((item) => ({
      workItemId: item.workItemId,
      stateCode: item.state.code,
      endDate: item.schedule?.endDate ?? null,
      assignedTo: item.details.assignedTo ?? null,
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
    items.forEach((item) => {
      map.set(item.workItemId, isOverdueTimelineItem(item.endDate, item.stateCode) ? OVERDUE_TIMELINE_COLOR : OVERDUE_OK_TIMELINE_COLOR);
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
    let category = "Unknown";

    if (mode === "person") {
      category = item.assignedTo?.trim() || "Unassigned";
    } else if (mode === "parent") {
      category = item.parentWorkItemId === null ? "No parent" : `Parent #${item.parentWorkItemId}`;
    }

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

type ColorCodingOption = {
  key: string;
  mode: TimelineColorCoding;
  fieldRef: string | null;
  label: string;
  subtitle?: string;
  searchText: string;
};

function buildColorCodingOptions(fieldRefs: string[]): ColorCodingOption[] {
  const modeOptions: ColorCodingOption[] = [
    { key: "mode:none", mode: "none", fieldRef: null, label: "None", subtitle: "Mode", searchText: "none mode" },
    { key: "mode:person", mode: "person", fieldRef: null, label: "Person", subtitle: "Mode", searchText: "person mode assignee assignedto" },
    { key: "mode:status", mode: "status", fieldRef: null, label: "Status", subtitle: "Mode", searchText: "status mode state" },
    { key: "mode:parent", mode: "parent", fieldRef: null, label: "Parent", subtitle: "Mode", searchText: "parent mode hierarchy" },
    { key: "mode:overdue", mode: "overdue", fieldRef: null, label: "Overdue", subtitle: "Mode", searchText: "overdue mode late due date" }
  ];

  const fieldOptions = fieldRefs.map((fieldRef) => {
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

  return [...modeOptions, ...fieldOptions];
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
  if (mode === "person") {
    return "Person";
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

function listAvailableColorCodingFields(timeline: TimelineReadModel | null): string[] {
  if (!timeline) {
    return [];
  }

  const set = new Set<string>();
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
    const key = fieldValueToStorageKey(value);
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }

    counts.set(key, {
      label: fieldValueToCategoryLabel(value),
      count: 1
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
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.label.localeCompare(right.label);
    });
}

function listModeValueStats(timeline: TimelineReadModel | null, mode: TimelineColorCoding): FieldValueStat[] {
  if (!timeline || (mode !== "person" && mode !== "status")) {
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

  if (mode === "person") {
    timeline.bars.forEach((bar) => register(bar.details.assignedTo?.trim() || "Unassigned"));
    timeline.unschedulable.forEach((item) => register(item.details.assignedTo?.trim() || "Unassigned"));
  } else if (mode === "status") {
    timeline.bars.forEach((bar) => register(bar.state.code));
    timeline.unschedulable.forEach((item) => register(item.state.code));
  }

  const categoryColorMap = buildCategoricalColorMap([...counts.values()].map((entry) => entry.label));
  return [...counts.entries()]
    .map(([key, entry]) => ({
      key,
      label: entry.label,
      count: entry.count,
      defaultColor: categoryColorMap.get(entry.label) ?? DEFAULT_NEUTRAL_TIMELINE_COLOR
    }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.label.localeCompare(right.label);
    });
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
  if (mode !== "person" && mode !== "parent" && mode !== "status") {
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

function isOverdueTimelineItem(endDateIso: string | null, stateCode: string): boolean {
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

  const normalizedState = stateCode.trim().toLowerCase();
  return !["closed", "done", "resolved", "removed", "completed"].includes(normalizedState);
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

function buildAdaptiveTicks(
  domainStart: Date,
  totalDays: number,
  zoomLevel: TimelineZoomLevel,
  dayWidthPx: number
): { x: number; label: string }[] {
  const ticks: { x: number; label: string }[] = [];
  const domainEnd = addDays(domainStart, totalDays);
  if (zoomLevel === "week") {
    let cursor = startOfIsoWeekUtc(domainStart);
    if (cursor.getTime() < domainStart.getTime()) {
      cursor = addDays(cursor, 7);
    }
    while (cursor.getTime() <= domainEnd.getTime()) {
      const offset = dayDiff(domainStart, cursor);
      ticks.push({
        x: offset * dayWidthPx,
        label: cursor.toISOString().slice(0, 10)
      });
      cursor = addDays(cursor, 7);
    }
  } else {
    let cursor = startOfMonthUtc(domainStart);
    if (cursor.getTime() < domainStart.getTime()) {
      cursor = addMonthsUtc(cursor, 1);
    }
    while (cursor.getTime() <= domainEnd.getTime()) {
      const offset = dayDiff(domainStart, cursor);
      ticks.push({
        x: offset * dayWidthPx,
        label: cursor.toISOString().slice(0, 7)
      });
      cursor = addMonthsUtc(cursor, 1);
    }
  }

  return ticks.length ? ticks : [{ x: 0, label: zoomLevel === "week" ? domainStart.toISOString().slice(0, 10) : domainStart.toISOString().slice(0, 7) }];
}

function buildDailyGridLines(totalDays: number, dayWidthPx: number): number[] {
  const lines: number[] = [];
  for (let dayIndex = 0; dayIndex <= totalDays; dayIndex += 1) {
    lines.push(dayIndex * dayWidthPx);
  }
  return lines;
}

function buildMonthAxisMarkers(
  domainStart: Date,
  totalDays: number,
  dayWidthPx: number
): { monthBoundaries: number[]; monthLabels: { x: number; label: string }[] } {
  const domainEndExclusive = addDays(domainStart, totalDays + 1);
  let cursor = startOfMonthUtc(domainStart);

  const monthBoundaries: number[] = [];
  const monthLabels: { x: number; label: string }[] = [];

  while (cursor.getTime() < domainEndExclusive.getTime()) {
    const monthStartOffset = dayDiff(domainStart, cursor);
    const nextMonth = addMonthsUtc(cursor, 1);
    const monthEndOffsetExclusive = dayDiff(domainStart, nextMonth);

    if (monthStartOffset >= 0 && monthStartOffset <= totalDays) {
      monthBoundaries.push(monthStartOffset * dayWidthPx);
    }

    const visibleStartOffset = Math.max(0, monthStartOffset);
    const visibleEndOffsetExclusive = Math.min(totalDays + 1, monthEndOffsetExclusive);
    if (visibleEndOffsetExclusive > visibleStartOffset) {
      const centerOffset = visibleStartOffset + (visibleEndOffsetExclusive - visibleStartOffset) / 2;
      monthLabels.push({
        x: centerOffset * dayWidthPx,
        label: cursor.toISOString().slice(0, 7)
      });
    }

    cursor = nextMonth;
  }

  return { monthBoundaries, monthLabels };
}

function formatTickDate(value: Date): string {
  return value.toISOString().slice(0, 10);
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }

  if (target.isContentEditable) {
    return true;
  }

  return target.closest("[contenteditable='true']") !== null;
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

function buildDependencyConnectorPath(
  from: BarGeometry,
  to: BarGeometry,
  laneSeed: number,
  options?: { forceNearGapDetour?: boolean }
): string {
  const startX = from.x + from.width + DEPENDENCY_ENDPOINT_GAP_PX;
  const endX = to.x - DEPENDENCY_ENDPOINT_GAP_PX;
  const horizontalDistance = endX - startX;
  const minLaneEntryOffsetPx = options?.forceNearGapDetour ? 6 : 4;
  const laneEntryOffset =
    horizontalDistance > 0
      ? Math.min(DEPENDENCY_LANE_ENTRY_MIN_PX, Math.max(minLaneEntryOffsetPx, horizontalDistance / 2))
      : minLaneEntryOffsetPx;
  const minApproachDistancePx = options?.forceNearGapDetour ? DEPENDENCY_TIGHT_GAP_DETOUR_MIN_PX : 4;
  const leftApproachDistance = Math.min(
    DEPENDENCY_LEFT_APPROACH_PX,
    Math.max(minApproachDistancePx, Math.abs(horizontalDistance) / 2)
  );
  const laneY = resolveDependencyLaneY(laneSeed, {
    fromTopY: from.y,
    fromMidY: from.midY,
    fromBottomY: from.y + BAR_HEIGHT,
    toTopY: to.y,
    toMidY: to.midY
  });
  const laneEntryX = startX + laneEntryOffset;
  const approachX = endX - leftApproachDistance;
  const laneTravelX = approachX;
  return `M ${startX} ${from.midY} L ${laneEntryX} ${from.midY} L ${laneEntryX} ${laneY} L ${laneTravelX} ${laneY} L ${approachX} ${laneY} L ${approachX} ${to.midY} L ${endX} ${to.midY}`;
}

function buildDependencyConnectorToPointPath(
  from: BarGeometry,
  targetX: number,
  targetY: number,
  laneSeed: number
): string {
  const startX = from.x + from.width + DEPENDENCY_ENDPOINT_GAP_PX;
  const safeTargetX = Number.isFinite(targetX) ? targetX : startX + DEPENDENCY_POINTER_SEGMENT_MIN_PX;
  const safeTargetY = Number.isFinite(targetY) ? targetY : from.midY;
  const horizontalDistance = safeTargetX - startX;
  const laneEntryOffset =
    horizontalDistance > 0
      ? Math.min(DEPENDENCY_LANE_ENTRY_MIN_PX, Math.max(4, horizontalDistance / 2))
      : 4;
  const estimatedTargetTopY = safeTargetY - BAR_HEIGHT / 2;
  const laneY = resolveDependencyLaneY(laneSeed, {
    fromTopY: from.y,
    fromMidY: from.midY,
    fromBottomY: from.y + BAR_HEIGHT,
    toTopY: estimatedTargetTopY,
    toMidY: safeTargetY
  });
  const laneEntryX = startX + laneEntryOffset;
  const laneTravelX = safeTargetX;

  return `M ${startX} ${from.midY} L ${laneEntryX} ${from.midY} L ${laneEntryX} ${laneY} L ${laneTravelX} ${laneY} L ${safeTargetX} ${safeTargetY}`;
}

function resolveDependencyLaneY(
  seed: number,
  input: {
    fromTopY: number;
    fromMidY: number;
    fromBottomY: number;
    toTopY: number;
    toMidY: number;
  }
): number {
  const normalizedSeed = Number.isFinite(seed) ? Math.abs(Math.trunc(seed)) : 0;
  const laneIndex = normalizedSeed % DEPENDENCY_LANE_COUNT;

  if (input.toMidY > input.fromMidY) {
    const lowerLaneY = input.fromBottomY + DEPENDENCY_LANE_TOP_OFFSET_PX;
    const upperLaneY = input.toTopY - DEPENDENCY_LANE_TOP_OFFSET_PX;
    if (upperLaneY > lowerLaneY) {
      const preferredLaneY = lowerLaneY + laneIndex * DEPENDENCY_LANE_GAP_PX;
      return Math.min(upperLaneY, Math.max(lowerLaneY, preferredLaneY));
    }
    return input.fromMidY + (input.toMidY - input.fromMidY) / 2;
  }

  const upperBarTopY = Math.min(input.fromTopY, input.toTopY);
  const topLaneY = upperBarTopY - DEPENDENCY_LANE_TOP_OFFSET_PX;
  const minLaneY = CHART_GRID_START_Y + DEPENDENCY_LANE_MIN_Y_OFFSET_FROM_GRID_START_PX;
  return Math.max(minLaneY, topLaneY - laneIndex * DEPENDENCY_LANE_GAP_PX);
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
