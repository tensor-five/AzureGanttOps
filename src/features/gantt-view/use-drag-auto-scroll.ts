import React from "react";

const EDGE_ZONE_PX = 40;
const MAX_SCROLL_SPEED_PX = 15;

export function useDragAutoScroll(
  scrollRef: React.RefObject<HTMLElement | null>,
  isActive: boolean,
  onAutoScroll?: () => void
): (clientX: number, clientY: number) => void {
  const pointerRef = React.useRef<{ clientX: number; clientY: number } | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const onAutoScrollRef = React.useRef(onAutoScroll);
  onAutoScrollRef.current = onAutoScroll;

  React.useEffect(() => {
    if (!isActive) {
      pointerRef.current = null;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const tick = () => {
      const el = scrollRef.current;
      const pointer = pointerRef.current;
      if (!el || !pointer) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const rect = el.getBoundingClientRect();

      const distFromLeft = pointer.clientX - rect.left;
      const distFromRight = rect.right - pointer.clientX;
      const distFromTop = pointer.clientY - rect.top;
      const distFromBottom = rect.bottom - pointer.clientY;

      let dx = 0;
      let dy = 0;

      if (distFromLeft < EDGE_ZONE_PX && distFromLeft >= 0) {
        dx = -MAX_SCROLL_SPEED_PX * (1 - distFromLeft / EDGE_ZONE_PX);
      } else if (distFromRight < EDGE_ZONE_PX && distFromRight >= 0) {
        dx = MAX_SCROLL_SPEED_PX * (1 - distFromRight / EDGE_ZONE_PX);
      }

      if (distFromTop < EDGE_ZONE_PX && distFromTop >= 0) {
        dy = -MAX_SCROLL_SPEED_PX * (1 - distFromTop / EDGE_ZONE_PX);
      } else if (distFromBottom < EDGE_ZONE_PX && distFromBottom >= 0) {
        dy = MAX_SCROLL_SPEED_PX * (1 - distFromBottom / EDGE_ZONE_PX);
      }

      if (dx !== 0 || dy !== 0) {
        const prevScrollLeft = el.scrollLeft;
        const prevScrollTop = el.scrollTop;
        el.scrollLeft += dx;
        el.scrollTop += dy;

        if (el.scrollLeft !== prevScrollLeft || el.scrollTop !== prevScrollTop) {
          onAutoScrollRef.current?.();
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isActive, scrollRef]);

  return React.useCallback((clientX: number, clientY: number) => {
    pointerRef.current = { clientX, clientY };
  }, []);
}
