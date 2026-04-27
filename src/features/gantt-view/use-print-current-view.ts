import React from "react";

import { computePrintSnapshot, PRINT_CSS_VARS, type PrintSnapshot } from "./print-snapshot.js";

export type UsePrintCurrentViewParams = {
  chartScrollRef: React.RefObject<HTMLElement | null>;
};

export type UsePrintCurrentViewResult = {
  isPrintMode: boolean;
  triggerPrint: () => void;
};

export function usePrintCurrentView(params: UsePrintCurrentViewParams): UsePrintCurrentViewResult {
  const [isPrintMode, setIsPrintMode] = React.useState(false);
  const ownsPrintRequestRef = React.useRef(false);
  const pendingFrameRef = React.useRef<number | null>(null);
  const activeSnapshotRef = React.useRef<PrintSnapshot | null>(null);
  const chartScrollRef = params.chartScrollRef;

  const resetPrintLayout = React.useCallback(() => {
    const root = document.documentElement;
    Object.values(PRINT_CSS_VARS).forEach((cssVar) => root.style.removeProperty(cssVar));
    delete document.body.dataset.printMode;
    activeSnapshotRef.current = null;
    ownsPrintRequestRef.current = false;
    setIsPrintMode(false);
  }, []);

  const triggerPrint = React.useCallback(() => {
    const scrollElement = chartScrollRef.current;
    if (!scrollElement) {
      window.print();
      return;
    }

    const snapshot = computePrintSnapshot({
      visibleWidthPx: scrollElement.clientWidth,
      visibleHeightPx: scrollElement.clientHeight,
      scrollHeightPx: scrollElement.scrollHeight,
      scrollLeftPx: scrollElement.scrollLeft,
      scrollTopPx: scrollElement.scrollTop
    });

    if (!snapshot) {
      window.print();
      return;
    }

    const root = document.documentElement;
    root.style.setProperty(PRINT_CSS_VARS.chartWidth, `${snapshot.chartWidthPx}px`);
    root.style.setProperty(PRINT_CSS_VARS.chartHeight, `${snapshot.chartHeightPx}px`);
    root.style.setProperty(PRINT_CSS_VARS.scrollLeft, `${snapshot.scrollLeftPx}px`);
    root.style.setProperty(PRINT_CSS_VARS.scrollTop, `${snapshot.scrollTopPx}px`);
    root.style.setProperty(PRINT_CSS_VARS.scale, `${snapshot.scale}`);
    document.body.dataset.printMode = "active";

    activeSnapshotRef.current = snapshot;
    ownsPrintRequestRef.current = true;
    setIsPrintMode(true);
  }, [chartScrollRef]);

  React.useEffect(() => {
    if (!isPrintMode) {
      return;
    }
    const scrollElement = chartScrollRef.current;
    const snapshot = activeSnapshotRef.current;
    const restoreScroll = () => {
      if (!scrollElement || !snapshot) {
        return;
      }
      scrollElement.scrollLeft = snapshot.scrollLeftPx;
      scrollElement.scrollTop = snapshot.scrollTopPx;
    };

    const firstFrame = window.requestAnimationFrame(() => {
      restoreScroll();
      const secondFrame = window.requestAnimationFrame(() => {
        restoreScroll();
        window.print();
      });
      pendingFrameRef.current = secondFrame;
    });
    pendingFrameRef.current = firstFrame;

    return () => {
      if (pendingFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingFrameRef.current);
        pendingFrameRef.current = null;
      }
    };
  }, [isPrintMode, chartScrollRef]);

  React.useEffect(() => {
    const onAfterPrint = () => {
      if (ownsPrintRequestRef.current) {
        resetPrintLayout();
      }
    };
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, [resetPrintLayout]);

  return { isPrintMode, triggerPrint };
}
