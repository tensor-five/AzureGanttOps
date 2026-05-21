import React from "react";

export type WorkItemContextMenuItem = {
  workItemId: number;
  title: string;
  state: string;
};

export type WorkItemContextMenuState = {
  item: WorkItemContextMenuItem;
  position: {
    x: number;
    y: number;
  };
};

const MENU_WIDTH_PX = 260;
const MENU_HEIGHT_PX = 320;
const VIEWPORT_INSET_PX = 8;

export function useWorkItemContextMenu(): {
  menuState: WorkItemContextMenuState | null;
  menuRef: React.RefObject<HTMLDivElement | null>;
  closeMenu: () => void;
  openMenuFromContextMenu: (event: React.MouseEvent<HTMLElement | SVGElement>, item: WorkItemContextMenuItem) => void;
  openMenuFromKeyboard: (event: React.KeyboardEvent<HTMLElement | SVGElement>, item: WorkItemContextMenuItem) => void;
} {
  const [menuState, setMenuState] = React.useState<WorkItemContextMenuState | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  const closeMenu = React.useCallback(() => {
    setMenuState(null);
  }, []);

  const openAt = React.useCallback((item: WorkItemContextMenuItem, x: number, y: number) => {
    setMenuState({
      item,
      position: resolveMenuPosition(x, y)
    });
  }, []);

  const openMenuFromContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLElement | SVGElement>, item: WorkItemContextMenuItem) => {
      event.preventDefault();
      event.stopPropagation();
      openAt(item, event.clientX, event.clientY);
    },
    [openAt]
  );

  const openMenuFromKeyboard = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement | SVGElement>, item: WorkItemContextMenuItem) => {
      if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const rect = event.currentTarget.getBoundingClientRect();
      openAt(item, rect.left + 8, rect.bottom + 4);
    },
    [openAt]
  );

  React.useEffect(() => {
    if (!menuState) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && menuRef.current?.contains(target)) {
        return;
      }
      closeMenu();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
    };
  }, [closeMenu, menuState]);

  return {
    menuState,
    menuRef,
    closeMenu,
    openMenuFromContextMenu,
    openMenuFromKeyboard
  };
}

function resolveMenuPosition(x: number, y: number): { x: number; y: number } {
  if (typeof window === "undefined") {
    return { x, y };
  }

  const maxX = Math.max(VIEWPORT_INSET_PX, window.innerWidth - MENU_WIDTH_PX - VIEWPORT_INSET_PX);
  const maxY = Math.max(VIEWPORT_INSET_PX, window.innerHeight - MENU_HEIGHT_PX - VIEWPORT_INSET_PX);

  return {
    x: Math.min(Math.max(VIEWPORT_INSET_PX, x), maxX),
    y: Math.min(Math.max(VIEWPORT_INSET_PX, y), maxY)
  };
}
