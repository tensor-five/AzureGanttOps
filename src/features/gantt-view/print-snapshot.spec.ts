import { describe, expect, it } from "vitest";

import { computePrintSnapshot } from "./print-snapshot.js";

const A4_LANDSCAPE_USABLE_WIDTH_PX = (277 * 96) / 25.4;
const A4_LANDSCAPE_USABLE_HEIGHT_PX = (190 * 96) / 25.4 - 56 - 24;

describe("computePrintSnapshot", () => {
  it("returns null for non-positive viewport dimensions", () => {
    expect(
      computePrintSnapshot({
        visibleWidthPx: 0,
        visibleHeightPx: 500,
        scrollHeightPx: 1000,
        scrollLeftPx: 0,
        scrollTopPx: 0
      })
    ).toBeNull();

    expect(
      computePrintSnapshot({
        visibleWidthPx: 800,
        visibleHeightPx: -1,
        scrollHeightPx: 1000,
        scrollLeftPx: 0,
        scrollTopPx: 0
      })
    ).toBeNull();
  });

  it("caps scale at 1.0 when chart fits horizontally on the page", () => {
    const snapshot = computePrintSnapshot({
      visibleWidthPx: 600,
      visibleHeightPx: 400,
      scrollHeightPx: 400,
      scrollLeftPx: 0,
      scrollTopPx: 0
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot!.scale).toBe(1);
  });

  it("scales down to fit the page width when chart is wider than the page", () => {
    const snapshot = computePrintSnapshot({
      visibleWidthPx: 2000,
      visibleHeightPx: 400,
      scrollHeightPx: 400,
      scrollLeftPx: 0,
      scrollTopPx: 0
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot!.scale).toBeCloseTo(A4_LANDSCAPE_USABLE_WIDTH_PX / 2000, 5);
  });

  it("expands height to remaining content so the page is filled", () => {
    const snapshot = computePrintSnapshot({
      visibleWidthPx: 800,
      visibleHeightPx: 200,
      scrollHeightPx: 1000,
      scrollLeftPx: 0,
      scrollTopPx: 0
    });

    expect(snapshot).not.toBeNull();
    // remaining = scrollHeight - scrollTop = 1000, max-at-scale = usableHeight/scale
    // scale=1 here (visibleWidth fits), so cap is usableHeightPx
    const expected = Math.min(1000, A4_LANDSCAPE_USABLE_HEIGHT_PX);
    expect(snapshot!.chartHeightPx).toBeCloseTo(expected, 3);
  });

  it("respects current scroll position when computing remaining content height", () => {
    const snapshot = computePrintSnapshot({
      visibleWidthPx: 800,
      visibleHeightPx: 200,
      scrollHeightPx: 1000,
      scrollLeftPx: 0,
      scrollTopPx: 900
    });

    expect(snapshot).not.toBeNull();
    // scrollHeight - scrollTop = 100, but min must be visibleHeight (200)
    expect(snapshot!.chartHeightPx).toBe(200);
    expect(snapshot!.scrollTopPx).toBe(900);
  });

  it("propagates scroll offsets unchanged", () => {
    const snapshot = computePrintSnapshot({
      visibleWidthPx: 800,
      visibleHeightPx: 200,
      scrollHeightPx: 1000,
      scrollLeftPx: 123,
      scrollTopPx: 45
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot!.scrollLeftPx).toBe(123);
    expect(snapshot!.scrollTopPx).toBe(45);
    expect(snapshot!.chartWidthPx).toBe(800);
  });
});
