import { describe, expect, it } from "vitest";

import {
  getViewportAvailableMenuHeightPx,
  resolveViewportConstrainedMenuPlacement
} from "./viewport-constrained-menu.js";

describe("viewport-constrained menu placement", () => {
  it("keeps a menu at the requested position when it fits the viewport", () => {
    expect(
      resolveViewportConstrainedMenuPlacement({
        requestedLeftPx: 120,
        requestedTopPx: 80,
        menuWidthPx: 260,
        menuHeightPx: 320,
        viewportWidthPx: 900,
        viewportHeightPx: 700
      })
    ).toEqual({
      leftPx: 120,
      topPx: 80,
      maxHeightPx: 684
    });
  });

  it("moves a bottom-right menu inside the viewport based on its rendered size", () => {
    expect(
      resolveViewportConstrainedMenuPlacement({
        requestedLeftPx: 790,
        requestedTopPx: 590,
        menuWidthPx: 260,
        menuHeightPx: 500,
        viewportWidthPx: 800,
        viewportHeightPx: 600
      })
    ).toEqual({
      leftPx: 532,
      topPx: 92,
      maxHeightPx: 584
    });
  });

  it("caps menu height when the viewport is shorter than the menu", () => {
    expect(
      resolveViewportConstrainedMenuPlacement({
        requestedLeftPx: 40,
        requestedTopPx: 200,
        menuWidthPx: 260,
        menuHeightPx: 900,
        viewportWidthPx: 800,
        viewportHeightPx: 420
      })
    ).toEqual({
      leftPx: 40,
      topPx: 8,
      maxHeightPx: 404
    });
  });

  it("never returns less than the inset as available height", () => {
    expect(getViewportAvailableMenuHeightPx(12)).toBe(8);
  });
});
