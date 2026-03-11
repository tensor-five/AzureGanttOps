// @vitest-environment jsdom

import React from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useTimelineResizing } from "./use-timeline-resizing.js";

describe("useTimelineResizing", () => {
  it("derives collapsed sidebar width and hidden details state", () => {
    const timelineMainGridRef = { current: document.createElement("div") } as React.RefObject<HTMLDivElement>;
    const { result } = renderHook(() => {
      const [detailsWidthPx, setDetailsWidthPx] = React.useState(120);
      const [sidebarWidthPx, setSidebarWidthPx] = React.useState(260);
      return useTimelineResizing({
        timelineMainGridRef,
        detailsWidthPx,
        setDetailsWidthPx,
        sidebarWidthPx,
        setSidebarWidthPx,
        sidebarFieldsCount: 0,
        detailsPanelMinWidthPx: 16,
        detailsPanelContentMinWidthPx: 180,
        timelineSidebarMinWidthPx: 120,
        timelineSidebarCollapsedWidthPx: 56,
        clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
        resolveTimelineDetailsMaxWidthPx: () => 400,
        resolveTimelineSidebarMaxWidthPx: () => 400,
        persistDetailsWidthPx: () => {},
        persistSidebarWidthPx: () => {}
      });
    });

    expect(result.current.sidebarCollapsed).toBe(true);
    expect(result.current.effectiveSidebarWidthPx).toBe(56);
    expect(result.current.detailsContentHidden).toBe(true);
  });

  it("starts and ends details resize through pointer events", () => {
    const timelineMainGridRef = { current: document.createElement("div") } as React.RefObject<HTMLDivElement>;
    const persistDetailsWidthPx = vi.fn();
    const { result } = renderHook(() => {
      const [detailsWidthPx, setDetailsWidthPx] = React.useState(280);
      const [sidebarWidthPx, setSidebarWidthPx] = React.useState(240);
      return useTimelineResizing({
        timelineMainGridRef,
        detailsWidthPx,
        setDetailsWidthPx,
        sidebarWidthPx,
        setSidebarWidthPx,
        sidebarFieldsCount: 2,
        detailsPanelMinWidthPx: 16,
        detailsPanelContentMinWidthPx: 180,
        timelineSidebarMinWidthPx: 120,
        timelineSidebarCollapsedWidthPx: 56,
        clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
        resolveTimelineDetailsMaxWidthPx: () => 400,
        resolveTimelineSidebarMaxWidthPx: () => 400,
        persistDetailsWidthPx,
        persistSidebarWidthPx: () => {}
      });
    });

    act(() => {
      result.current.beginDetailsResize({
        button: 0,
        pointerId: 17,
        clientX: 200,
        preventDefault: () => {},
        currentTarget: {
          setPointerCapture: () => {}
        }
      } as unknown as React.PointerEvent<HTMLButtonElement>);
    });

    expect(result.current.isDetailsResizing).toBe(true);

    act(() => {
      window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 17 }));
    });

    expect(persistDetailsWidthPx).toHaveBeenCalledTimes(1);
  });
});
