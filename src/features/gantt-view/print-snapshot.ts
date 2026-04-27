export const PRINT_CSS_VARS = {
  chartWidth: "--print-chart-width",
  chartHeight: "--print-chart-height",
  scrollLeft: "--print-scroll-left",
  scrollTop: "--print-scroll-top",
  scale: "--print-scale"
} as const;

const A4_LANDSCAPE_CONTENT_WIDTH_MM = 277;
const A4_LANDSCAPE_CONTENT_HEIGHT_MM = 190;
const MM_TO_PX_AT_96_DPI = 96 / 25.4;
// Must mirror the rendered height of `.timeline-print-header` and `.timeline-print-footer`
// in `local-ui-shell.css` (@media print). Bump these when the print chrome layout changes.
const PRINT_HEADER_RESERVED_PX = 56;
const PRINT_FOOTER_RESERVED_PX = 24;

export type PrintSnapshotInput = {
  visibleWidthPx: number;
  visibleHeightPx: number;
  scrollHeightPx: number;
  scrollLeftPx: number;
  scrollTopPx: number;
};

export type PrintSnapshot = {
  chartWidthPx: number;
  chartHeightPx: number;
  scrollLeftPx: number;
  scrollTopPx: number;
  scale: number;
};

export function computePrintSnapshot(input: PrintSnapshotInput): PrintSnapshot | null {
  if (input.visibleWidthPx <= 0 || input.visibleHeightPx <= 0) {
    return null;
  }

  const pageWidthPx = A4_LANDSCAPE_CONTENT_WIDTH_MM * MM_TO_PX_AT_96_DPI;
  const pageHeightPx = A4_LANDSCAPE_CONTENT_HEIGHT_MM * MM_TO_PX_AT_96_DPI;
  const usableHeightPx = Math.max(pageHeightPx - PRINT_HEADER_RESERVED_PX - PRINT_FOOTER_RESERVED_PX, 1);
  const scale = Math.min(pageWidthPx / input.visibleWidthPx, 1);
  const remainingContentHeightPx = Math.max(
    input.scrollHeightPx - input.scrollTopPx,
    input.visibleHeightPx
  );
  const maxRenderHeightAtScalePx = usableHeightPx / scale;
  const chartHeightPx = Math.min(remainingContentHeightPx, maxRenderHeightAtScalePx);

  return {
    chartWidthPx: input.visibleWidthPx,
    chartHeightPx,
    scrollLeftPx: input.scrollLeftPx,
    scrollTopPx: input.scrollTopPx,
    scale
  };
}
