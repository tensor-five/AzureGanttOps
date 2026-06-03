export type ViewportConstrainedMenuPlacement = {
  leftPx: number;
  topPx: number;
  maxHeightPx: number;
};

export const CONTEXT_MENU_VIEWPORT_INSET_PX = 8;
export const DEFAULT_CONTEXT_MENU_WIDTH_PX = 260;
export const DEFAULT_CONTEXT_MENU_HEIGHT_PX = 320;

export function resolveViewportConstrainedMenuPlacement(input: {
  requestedLeftPx: number;
  requestedTopPx: number;
  menuWidthPx: number;
  menuHeightPx: number;
  viewportWidthPx: number;
  viewportHeightPx: number;
  viewportInsetPx?: number;
}): ViewportConstrainedMenuPlacement {
  const viewportInsetPx = input.viewportInsetPx ?? CONTEXT_MENU_VIEWPORT_INSET_PX;
  const availableWidthPx = Math.max(0, input.viewportWidthPx - viewportInsetPx * 2);
  const availableHeightPx = getViewportAvailableMenuHeightPx(input.viewportHeightPx, viewportInsetPx);
  const menuWidthPx = Math.min(Math.max(0, input.menuWidthPx), availableWidthPx);
  const menuHeightPx = Math.min(Math.max(0, input.menuHeightPx), availableHeightPx);
  const maxLeftPx = Math.max(viewportInsetPx, input.viewportWidthPx - menuWidthPx - viewportInsetPx);
  const maxTopPx = Math.max(viewportInsetPx, input.viewportHeightPx - menuHeightPx - viewportInsetPx);

  return {
    leftPx: clamp(input.requestedLeftPx, viewportInsetPx, maxLeftPx),
    topPx: clamp(input.requestedTopPx, viewportInsetPx, maxTopPx),
    maxHeightPx: availableHeightPx
  };
}

export function getViewportAvailableMenuHeightPx(
  viewportHeightPx: number,
  viewportInsetPx = CONTEXT_MENU_VIEWPORT_INSET_PX
): number {
  return Math.max(viewportInsetPx, viewportHeightPx - viewportInsetPx * 2);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(min, value), max);
}
