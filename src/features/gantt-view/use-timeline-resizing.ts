import React from "react";

type ActiveDetailsResize = {
  pointerId: number;
  originClientX: number;
  originWidthPx: number;
};

type ActiveSidebarResize = {
  pointerId: number;
  originClientX: number;
  originWidthPx: number;
};

export function useTimelineResizing(input: {
  timelineMainGridRef: React.RefObject<HTMLDivElement | null>;
  detailsWidthPx: number;
  setDetailsWidthPx: React.Dispatch<React.SetStateAction<number>>;
  sidebarWidthPx: number;
  setSidebarWidthPx: React.Dispatch<React.SetStateAction<number>>;
  sidebarFieldsCount: number;
  detailsPanelMinWidthPx: number;
  detailsPanelContentMinWidthPx: number;
  timelineSidebarMinWidthPx: number;
  timelineSidebarCollapsedWidthPx: number;
  clamp: (value: number, min: number, max: number) => number;
  resolveTimelineDetailsMaxWidthPx: (container: HTMLElement | null, sidebarWidthPx: number) => number;
  resolveTimelineSidebarMaxWidthPx: (container: HTMLElement | null, detailsWidthPx: number) => number;
  persistDetailsWidthPx: (widthPx: number) => void;
  persistSidebarWidthPx: (widthPx: number) => void;
}): {
  isSidebarResizing: boolean;
  isDetailsResizing: boolean;
  detailsContentHidden: boolean;
  sidebarCollapsed: boolean;
  effectiveSidebarWidthPx: number;
  detailsResizeMovedRef: React.MutableRefObject<boolean>;
  sidebarResizeMovedRef: React.MutableRefObject<boolean>;
  sidebarEffectiveWidthLiveRef: React.MutableRefObject<number>;
  beginSidebarResize: (event: React.PointerEvent<HTMLButtonElement>) => void;
  beginDetailsResize: (event: React.PointerEvent<HTMLButtonElement>) => void;
  toggleDetailsPanelFromSplitter: () => void;
} {
  const [activeDetailsResize, setActiveDetailsResize] = React.useState<ActiveDetailsResize | null>(null);
  const [activeSidebarResize, setActiveSidebarResize] = React.useState<ActiveSidebarResize | null>(null);
  const detailsWidthLiveRef = React.useRef(input.detailsWidthPx);
  const sidebarWidthLiveRef = React.useRef(input.sidebarWidthPx);
  const detailsResizeMovedRef = React.useRef(false);
  const sidebarResizeMovedRef = React.useRef(false);
  const lastExpandedDetailsWidthRef = React.useRef(
    Math.max(input.detailsWidthPx, input.detailsPanelContentMinWidthPx)
  );

  const sidebarCollapsed = input.sidebarFieldsCount === 0;
  const effectiveSidebarWidthPx = sidebarCollapsed
    ? input.timelineSidebarCollapsedWidthPx
    : input.sidebarWidthPx;
  const detailsContentHidden = input.detailsWidthPx < input.detailsPanelContentMinWidthPx;
  const sidebarEffectiveWidthLiveRef = React.useRef(effectiveSidebarWidthPx);

  React.useEffect(() => {
    detailsWidthLiveRef.current = input.detailsWidthPx;
    if (input.detailsWidthPx >= input.detailsPanelContentMinWidthPx) {
      lastExpandedDetailsWidthRef.current = input.detailsWidthPx;
    }
  }, [input.detailsPanelContentMinWidthPx, input.detailsWidthPx]);

  React.useEffect(() => {
    sidebarWidthLiveRef.current = input.sidebarWidthPx;
    sidebarEffectiveWidthLiveRef.current = effectiveSidebarWidthPx;
  }, [effectiveSidebarWidthPx, input.sidebarWidthPx]);

  React.useEffect(() => {
    const clampWidthToAvailableSpace = (): void => {
      input.setSidebarWidthPx((current) => {
        const maxWidth = input.resolveTimelineSidebarMaxWidthPx(input.timelineMainGridRef.current, detailsWidthLiveRef.current);
        const next = input.clamp(current, input.timelineSidebarMinWidthPx, maxWidth);
        return Math.abs(current - next) < 1 ? current : next;
      });

      input.setDetailsWidthPx((current) => {
        const maxWidth = input.resolveTimelineDetailsMaxWidthPx(
          input.timelineMainGridRef.current,
          sidebarEffectiveWidthLiveRef.current
        );
        const next = input.clamp(current, input.detailsPanelMinWidthPx, maxWidth);
        return Math.abs(current - next) < 1 ? current : next;
      });
    };

    clampWidthToAvailableSpace();
    window.addEventListener("resize", clampWidthToAvailableSpace);
    return () => {
      window.removeEventListener("resize", clampWidthToAvailableSpace);
    };
  }, [
    input.clamp,
    input.detailsPanelMinWidthPx,
    input.resolveTimelineDetailsMaxWidthPx,
    input.resolveTimelineSidebarMaxWidthPx,
    input.setDetailsWidthPx,
    input.setSidebarWidthPx,
    input.timelineMainGridRef,
    input.timelineSidebarMinWidthPx
  ]);

  React.useEffect(() => {
    if (!activeDetailsResize) {
      return;
    }

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== activeDetailsResize.pointerId) {
        return;
      }

      const deltaX = event.clientX - activeDetailsResize.originClientX;
      if (Math.abs(deltaX) >= 2) {
        detailsResizeMovedRef.current = true;
      }
      const maxWidth = input.resolveTimelineDetailsMaxWidthPx(
        input.timelineMainGridRef.current,
        sidebarEffectiveWidthLiveRef.current
      );
      const nextWidth = input.clamp(activeDetailsResize.originWidthPx - deltaX, input.detailsPanelMinWidthPx, maxWidth);
      input.setDetailsWidthPx(nextWidth);
      event.preventDefault();
    };

    const finishResize = (event: PointerEvent) => {
      if (event.pointerId !== activeDetailsResize.pointerId) {
        return;
      }

      setActiveDetailsResize(null);
      input.persistDetailsWidthPx(detailsWidthLiveRef.current);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", finishResize);
    window.addEventListener("pointercancel", finishResize);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", finishResize);
      window.removeEventListener("pointercancel", finishResize);
    };
  }, [
    activeDetailsResize,
    input.clamp,
    input.detailsPanelMinWidthPx,
    input.persistDetailsWidthPx,
    input.resolveTimelineDetailsMaxWidthPx,
    input.setDetailsWidthPx,
    input.timelineMainGridRef
  ]);

  React.useEffect(() => {
    if (!activeSidebarResize) {
      return;
    }

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== activeSidebarResize.pointerId) {
        return;
      }

      const deltaX = event.clientX - activeSidebarResize.originClientX;
      if (Math.abs(deltaX) >= 2) {
        sidebarResizeMovedRef.current = true;
      }
      const maxWidth = input.resolveTimelineSidebarMaxWidthPx(input.timelineMainGridRef.current, detailsWidthLiveRef.current);
      const nextWidth = input.clamp(activeSidebarResize.originWidthPx + deltaX, input.timelineSidebarMinWidthPx, maxWidth);
      input.setSidebarWidthPx(nextWidth);
      event.preventDefault();
    };

    const finishResize = (event: PointerEvent) => {
      if (event.pointerId !== activeSidebarResize.pointerId) {
        return;
      }

      setActiveSidebarResize(null);
      input.persistSidebarWidthPx(sidebarWidthLiveRef.current);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", finishResize);
    window.addEventListener("pointercancel", finishResize);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", finishResize);
      window.removeEventListener("pointercancel", finishResize);
    };
  }, [
    activeSidebarResize,
    input.clamp,
    input.persistSidebarWidthPx,
    input.resolveTimelineSidebarMaxWidthPx,
    input.setSidebarWidthPx,
    input.timelineMainGridRef,
    input.timelineSidebarMinWidthPx
  ]);

  const beginSidebarResize = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      if ("setPointerCapture" in event.currentTarget) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      sidebarResizeMovedRef.current = false;

      setActiveSidebarResize({
        pointerId: event.pointerId,
        originClientX: event.clientX,
        originWidthPx: input.sidebarWidthPx
      });
    },
    [input.sidebarWidthPx]
  );

  const beginDetailsResize = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      if ("setPointerCapture" in event.currentTarget) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      detailsResizeMovedRef.current = false;

      setActiveDetailsResize({
        pointerId: event.pointerId,
        originClientX: event.clientX,
        originWidthPx: input.detailsWidthPx
      });
    },
    [input.detailsWidthPx]
  );

  const toggleDetailsPanelFromSplitter = React.useCallback(() => {
    if (detailsResizeMovedRef.current) {
      return;
    }

    if (!detailsContentHidden) {
      input.setDetailsWidthPx(input.detailsPanelMinWidthPx);
      input.persistDetailsWidthPx(input.detailsPanelMinWidthPx);
      return;
    }

    const maxWidth = input.resolveTimelineDetailsMaxWidthPx(
      input.timelineMainGridRef.current,
      sidebarEffectiveWidthLiveRef.current
    );
    const restoredWidth = input.clamp(lastExpandedDetailsWidthRef.current, input.detailsPanelContentMinWidthPx, maxWidth);
    input.setDetailsWidthPx(restoredWidth);
    input.persistDetailsWidthPx(restoredWidth);
  }, [
    detailsContentHidden,
    input.clamp,
    input.detailsPanelMinWidthPx,
    input.detailsPanelContentMinWidthPx,
    input.persistDetailsWidthPx,
    input.resolveTimelineDetailsMaxWidthPx,
    input.setDetailsWidthPx,
    input.timelineMainGridRef
  ]);

  return {
    isSidebarResizing: activeSidebarResize !== null,
    isDetailsResizing: activeDetailsResize !== null,
    detailsContentHidden,
    sidebarCollapsed,
    effectiveSidebarWidthPx,
    detailsResizeMovedRef,
    sidebarResizeMovedRef,
    sidebarEffectiveWidthLiveRef,
    beginSidebarResize,
    beginDetailsResize,
    toggleDetailsPanelFromSplitter
  };
}
