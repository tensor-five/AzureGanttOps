import React from "react";

import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";
import type { TimelineDensity } from "./timeline-density-preference.js";
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
  organization?: string;
  project?: string;
  density?: TimelineDensity;
  selectionStore?: TimelineSelectionStore;
  onAdoptUnschedulableSchedule?: (input: {
    targetWorkItemId: number;
    startDate: string;
    endDate: string;
  }) => Promise<void>;
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
  const [unscheduledDropPreview, setUnscheduledDropPreview] = React.useState<UnscheduledDropPreview | null>(null);
  const [detailsCollapsed, setDetailsCollapsed] = React.useState(false);

  const chartScrollRef = React.useRef<HTMLDivElement | null>(null);
  const chartSvgRef = React.useRef<SVGSVGElement | null>(null);
  const zoomAnchorRef = React.useRef<{ dayOffset: number; pointerOffsetX: number } | null>(null);
  const initialViewportAppliedRef = React.useRef(false);

  const canEditSchedule = Boolean(props.onUpdateWorkItemSchedule);

  React.useEffect(() => {
    setAdoptedSchedulesByWorkItemId({});
    setEditedBarSchedulesByWorkItemId({});
    setActiveScheduleDrag(null);
    setActiveUnschedulableDrag(null);
    setUnscheduledDropPreview(null);
    initialViewportAppliedRef.current = false;
  }, [props.timeline]);

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
  const chartModel = React.useMemo(() => buildVisualChartModel(effectiveTimeline, dayWidthPx, zoomLevel), [effectiveTimeline, dayWidthPx, zoomLevel]);

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
    const byId = new Map<number, { x: number; y: number; width: number; midY: number }>();
    chartModel.bars.forEach((bar, index) => {
      const y = CHART_TOP_PADDING + index * CHART_ROW_HEIGHT;
      const x = CHART_LEFT_GUTTER + bar.x;
      byId.set(bar.workItemId, { x, y, width: bar.width, midY: y + BAR_HEIGHT / 2 });
    });
    return byId;
  }, [chartModel.bars]);

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

  const handleChartPointerMove = React.useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
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
    [activeScheduleDrag, chartModel.dayWidthPx, updateEditedSchedule]
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
      const active = activeScheduleDrag;
      if (!active || event.pointerId !== active.pointerId) {
        return;
      }

      setActiveScheduleDrag(null);
      void persistDraggedSchedule(active);
    },
    [activeScheduleDrag, persistDraggedSchedule]
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
      event.dataTransfer.setData("text/plain", String(workItemId));
      event.dataTransfer.effectAllowed = "move";
      setActiveUnschedulableDrag({ workItemId, fixedEndDate });
    },
    []
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
            onClick: () => {
              props.onRetryRefresh?.();
            }
          },
          "Refresh"
        ),
        React.createElement(
          "div",
          {
            className: "timeline-density-controls timeline-density-controls-harmonized timeline-density-controls-zoom",
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
                          x: CHART_LEFT_GUTTER + chartModel.todayX + 6,
                          y: CHART_AXIS_TODAY_LABEL_Y,
                          className: "timeline-today-label"
                        },
                        "Today"
                      )
                    )
                  : null,
                props.showDependencies
                  ? effectiveTimeline?.dependencies.map((dependency, index) => {
                      const from = geometryByWorkItemId.get(dependency.predecessorWorkItemId);
                      const to = geometryByWorkItemId.get(dependency.successorWorkItemId);
                      if (!from || !to) {
                        return null;
                      }

                      const startX = from.x + from.width;
                      const endX = to.x;
                      const bendX = startX + Math.max(10, (endX - startX) / 2);
                      const path = `M ${startX} ${from.midY} L ${bendX} ${from.midY} L ${bendX} ${to.midY} L ${endX} ${to.midY}`;

                      return React.createElement("path", {
                        key: `${dependency.predecessorWorkItemId}-${dependency.successorWorkItemId}-${index}`,
                        d: path,
                        className: "timeline-dependency-line"
                      });
                    })
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
                      r: 3.5,
                      className: "timeline-bar-state-dot",
                      style: { fill: bar.color }
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
                  : null
              )
            ),
        React.createElement(
          "div",
          { className: "timeline-unschedulable-list" },
          React.createElement(
            "div",
            { className: "timeline-unschedulable-header" },
            React.createElement("h4", null, "Unscheduled"),
            React.createElement("p", null, "Select one item and assign a schedule from chart or selected bar.")
          ),
          effectiveTimeline?.unschedulable.length
            ? React.createElement(
                "ul",
                null,
                ...effectiveTimeline.unschedulable.map((item) =>
                  React.createElement(
                    "li",
                    { key: item.workItemId },
                    React.createElement(
                      "button",
                      {
                        type: "button",
                        className: "timeline-unschedulable-button",
                        "aria-label": `#${item.details.mappedId} ${item.title} (${item.reason})`,
                        "aria-pressed": selectedWorkItemId === item.workItemId,
                        draggable: true,
                        onDragStart: (event) => {
                          startUnscheduledDrag(event, item.workItemId, resolveUnschedulableFixedEndDate(item));
                        },
                        onDragEnd: () => {
                          clearUnscheduledDrag();
                        },
                        onClick: () => {
                          setAdoptScheduleError(null);
                          if (selectedWorkItemId !== null) {
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
                          { className: "timeline-unschedulable-item-title" },
                          `#${item.details.mappedId} ${truncateTitleToBarWidth(item.title, 220)}`
                        ),
                        React.createElement(
                          "span",
                          { className: "timeline-unschedulable-item-reason" },
                          item.reason
                        )
                      ),
                      React.createElement(
                        "span",
                        { className: "timeline-unschedulable-button-state" },
                        React.createElement("span", {
                          className: "timeline-unschedulable-state-dot",
                          style: { backgroundColor: item.state.color }
                        }),
                        React.createElement(
                          "span",
                          { className: "timeline-unschedulable-button-badge" },
                          item.state.badge
                        )
                      )
                    )
                  )
                )
              )
            : React.createElement("div", null, "None")
        ),
        React.createElement(
          "p",
          { className: "timeline-unschedulable-fyi" },
          `${barCount} bars`,
          " · ",
          `${unscheduledCount} unscheduled`
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
const CHART_AXIS_TODAY_LABEL_Y = CHART_TOP_PADDING - 42;
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

type VisualTimelineBar = {
  workItemId: number;
  mappedId: string;
  title: string;
  color: string;
  stateBadge: string;
  x: number;
  width: number;
  start: Date;
  end: Date;
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
  zoomLevel: TimelineZoomLevel
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
  const totalDays = Math.max(1, dayDiffInclusive(domainStart, domainEnd));
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
      color: bar.source.state.color,
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

function toIsoDateUtc(value: Date): string {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())).toISOString();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
