import React from "react";
import { createPortal } from "react-dom";

import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";
import type { WorkItemTypeOption } from "../../domain/work-items/child-work-item-type.js";
import { buildAzureWorkItemUrl } from "../../shared/azure-devops/azure-work-item-url.js";
import { useChildWorkItemTypeMenu } from "./use-child-work-item-type-menu.js";
import { normalizeWorkItemStateOptions, type WorkItemStateOption } from "./work-item-state-options.js";
import type { WorkItemContextMenuState } from "./use-work-item-context-menu.js";
import {
  getViewportAvailableMenuHeightPx,
  resolveViewportConstrainedMenuPlacement,
  type ViewportConstrainedMenuPlacement
} from "./viewport-constrained-menu.js";

export type TimelineWorkItemContextMenuProps = {
  menuState: WorkItemContextMenuState | null;
  menuRef: React.RefObject<HTMLDivElement | null>;
  timeline: TimelineReadModel | null;
  organization?: string;
  project?: string;
  onClose: () => void;
  onDuplicateWorkItem?: (input: {
    sourceWorkItemId: number;
    scheduleFieldRefs?: {
      start: string;
      endOrTarget: string;
    };
  }) => Promise<void>;
  canCreateChildWorkItem?: boolean;
  onCreateChildWorkItem?: (input: {
    parentWorkItemId: number;
    childWorkItemType: string;
    title?: string;
    scheduleFieldRefs?: {
      start: string;
      endOrTarget: string;
    };
  }) => Promise<void>;
  onFetchWorkItemTypes?: () => Promise<WorkItemTypeOption[]>;
  onUpdateWorkItemState?: (input: { targetWorkItemId: number; state: string; stateColor: string | null }) => Promise<void>;
  onFetchWorkItemStateOptions?: (input: { targetWorkItemId: number }) => Promise<WorkItemStateOption[]>;
};

type StatusLoadState =
  | { status: "idle"; options: WorkItemStateOption[]; error: null }
  | { status: "loading"; options: WorkItemStateOption[]; error: null }
  | { status: "loaded"; options: WorkItemStateOption[]; error: null }
  | { status: "error"; options: WorkItemStateOption[]; error: string };

type ViewportConstrainedMenuStyle = ViewportConstrainedMenuPlacement & {
  key: string;
};

export function TimelineWorkItemContextMenu(props: TimelineWorkItemContextMenuProps): React.ReactElement | null {
  const firstActionRef = React.useRef<HTMLButtonElement | null>(null);
  const rootMenuItemRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const childMenuButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const childTypeOptionRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const statusMenuButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const statusOptionRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const [statusMenuOpen, setStatusMenuOpen] = React.useState(false);
  const [statusLoadState, setStatusLoadState] = React.useState<StatusLoadState>({
    status: "idle",
    options: [],
    error: null
  });
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [busyAction, setBusyAction] = React.useState<"duplicate" | "child" | "state" | "copy" | null>(null);
  const [constrainedMenuStyle, setConstrainedMenuStyle] = React.useState<ViewportConstrainedMenuStyle | null>(null);

  const menuState = props.menuState;
  const workItemId = menuState?.item.workItemId ?? null;
  const menuPositionKey = menuState
    ? `${menuState.item.workItemId}:${menuState.position.x}:${menuState.position.y}`
    : null;
  const currentState = menuState?.item.state ?? "";
  const azureUrl = menuState
    ? buildAzureWorkItemUrl(props.organization, props.project, menuState.item.workItemId)
    : null;
  const childTypeMenu = useChildWorkItemTypeMenu({
    menuKey: workItemId,
    parentWorkItemType: menuState?.item.workItemType,
    onFetchWorkItemTypes: props.onFetchWorkItemTypes
  });
  const stateOptions =
    props.onFetchWorkItemStateOptions && statusLoadState.status === "loaded"
      ? normalizeWorkItemStateOptions(statusLoadState.options)
      : [];

  React.useEffect(() => {
    setStatusMenuOpen(false);
    setStatusLoadState({
      status: "idle",
      options: [],
      error: null
    });
    setActionError(null);
    setBusyAction(null);
  }, [workItemId]);

  React.useLayoutEffect(() => {
    if (!menuState || !menuPositionKey) {
      setConstrainedMenuStyle(null);
      return;
    }

    const menuElement = props.menuRef.current;
    if (!menuElement || typeof window === "undefined") {
      return;
    }

    const bounds = menuElement.getBoundingClientRect();
    const nextPlacement = resolveViewportConstrainedMenuPlacement({
      requestedLeftPx: menuState.position.x,
      requestedTopPx: menuState.position.y,
      menuWidthPx: bounds.width,
      menuHeightPx: bounds.height,
      viewportWidthPx: window.innerWidth,
      viewportHeightPx: window.innerHeight
    });
    const nextStyle = {
      key: menuPositionKey,
      ...nextPlacement
    };

    setConstrainedMenuStyle((current) =>
      current?.key === nextStyle.key &&
      current.leftPx === nextStyle.leftPx &&
      current.topPx === nextStyle.topPx &&
      current.maxHeightPx === nextStyle.maxHeightPx
        ? current
        : nextStyle
    );
  }, [
    actionError,
    busyAction,
    childTypeMenu.isOpen,
    childTypeMenu.loadState.status,
    childTypeMenu.options.length,
    menuPositionKey,
    menuState,
    props.menuRef,
    statusLoadState.options.length,
    statusLoadState.status,
    statusMenuOpen
  ]);

  React.useEffect(() => {
    if (!menuState) {
      return;
    }

    const focusFirstAction = () => {
      firstActionRef.current?.focus();
    };
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(focusFirstAction);
    } else {
      window.setTimeout(focusFirstAction, 0);
    }
  }, [menuState]);

  React.useEffect(() => {
    if (!statusMenuOpen || !menuState) {
      return;
    }

    if (!props.onFetchWorkItemStateOptions) {
      setStatusLoadState({
        status: "loaded",
        options: [],
        error: null
      });
      return;
    }

    let cancelled = false;
    setStatusLoadState((current) => ({
      status: "loading",
      options: current.options,
      error: null
    }));

    void props
      .onFetchWorkItemStateOptions({ targetWorkItemId: menuState.item.workItemId })
      .then((options) => {
        if (cancelled) {
          return;
        }
        setStatusLoadState({
          status: "loaded",
          options,
          error: null
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setStatusLoadState({
          status: "error",
          options: [],
          error: error instanceof Error ? error.message : "Status konnten nicht geladen werden."
        });
      });

    return () => {
      cancelled = true;
    };
  }, [menuState, props.onFetchWorkItemStateOptions, statusMenuOpen]);

  React.useEffect(() => {
    if (!childTypeMenu.isOpen || childTypeMenu.loadState.status !== "loaded" || childTypeMenu.activeIndex < 0) {
      return;
    }

    const focusActiveChildType = () => {
      childTypeOptionRefs.current[childTypeMenu.activeIndex]?.focus();
    };
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(focusActiveChildType);
    } else {
      window.setTimeout(focusActiveChildType, 0);
    }
  }, [childTypeMenu.activeIndex, childTypeMenu.isOpen, childTypeMenu.loadState.status]);

  React.useEffect(() => {
    if (!statusMenuOpen || statusLoadState.status !== "loaded" || stateOptions.length === 0) {
      return;
    }

    const currentIndex = stateOptions.findIndex(
      (option) => option.name.trim().toLowerCase() === currentState.trim().toLowerCase()
    );
    const focusStatusOption = () => {
      statusOptionRefs.current[currentIndex >= 0 ? currentIndex : 0]?.focus();
    };
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(focusStatusOption);
    } else {
      window.setTimeout(focusStatusOption, 0);
    }
  }, [currentState, stateOptions.length, statusLoadState.status, statusMenuOpen]);

  if (!menuState) {
    return null;
  }

  const statusControlsDisabled = busyAction !== null || !props.onUpdateWorkItemState || !props.onFetchWorkItemStateOptions;
  const duplicateDisabled = busyAction !== null || !props.onDuplicateWorkItem;
  const canCreateChild = Boolean(props.canCreateChildWorkItem && props.onCreateChildWorkItem && props.onFetchWorkItemTypes);
  const childCreateDisabled = busyAction !== null || !props.onCreateChildWorkItem || !props.onFetchWorkItemTypes;
  const linkControlsDisabled = busyAction !== null || !azureUrl;

  const performDuplicate = async () => {
    if (!props.onDuplicateWorkItem || busyAction !== null) {
      return;
    }

    setActionError(null);
    setBusyAction("duplicate");
    try {
      const scheduleFieldRefs = menuState.item.scheduleFieldRefs ?? props.timeline?.scheduleFieldRefs;
      await props.onDuplicateWorkItem({
        sourceWorkItemId: menuState.item.workItemId,
        ...(scheduleFieldRefs ? { scheduleFieldRefs } : {})
      });
      props.onClose();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Duplizieren fehlgeschlagen.");
    } finally {
      setBusyAction(null);
    }
  };

  const performCreateChild = async (childWorkItemType: string) => {
    if (!props.onCreateChildWorkItem || busyAction !== null) {
      return;
    }

    setActionError(null);
    setBusyAction("child");
    try {
      const scheduleFieldRefs = menuState.item.scheduleFieldRefs ?? props.timeline?.scheduleFieldRefs;
      await props.onCreateChildWorkItem({
        parentWorkItemId: menuState.item.workItemId,
        childWorkItemType,
        ...(scheduleFieldRefs ? { scheduleFieldRefs } : {})
      });
      props.onClose();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : `${childWorkItemType} konnte nicht erstellt werden.`);
    } finally {
      setBusyAction(null);
    }
  };

  const performStateUpdate = async (option: WorkItemStateOption) => {
    if (
      !props.onUpdateWorkItemState ||
      !props.onFetchWorkItemStateOptions ||
      busyAction !== null ||
      statusLoadState.status !== "loaded"
    ) {
      return;
    }

    setActionError(null);
    setBusyAction("state");
    try {
      await props.onUpdateWorkItemState({
        targetWorkItemId: menuState.item.workItemId,
        state: option.name,
        stateColor: option.color
      });
      props.onClose();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Statuswechsel fehlgeschlagen.");
    } finally {
      setBusyAction(null);
    }
  };

  const openInAzureDevOps = () => {
    if (!azureUrl || busyAction !== null) {
      return;
    }

    const opened = window.open(azureUrl, "_blank", "noopener,noreferrer");
    if (opened) {
      opened.opener = null;
    }
    props.onClose();
  };

  const copyLink = async () => {
    if (!azureUrl || busyAction !== null) {
      return;
    }

    setActionError(null);
    setBusyAction("copy");
    try {
      await copyTextToClipboard(azureUrl);
      props.onClose();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Link konnte nicht kopiert werden.");
    } finally {
      setBusyAction(null);
    }
  };

  const setRootMenuItemRef = (index: number, element: HTMLButtonElement | null) => {
    rootMenuItemRefs.current[index] = element;
  };

  const focusRootMenuItem = (index: number) => {
    const item = rootMenuItemRefs.current[index];
    if (item && !item.disabled) {
      item.focus();
    }
  };

  const focusRootMenuItemByDelta = (currentIndex: number, delta: number) => {
    const focusableIndexes = rootMenuItemRefs.current
      .map((element, index) => ({ element, index }))
      .filter((entry): entry is { element: HTMLButtonElement; index: number } => Boolean(entry.element && !entry.element.disabled))
      .map((entry) => entry.index);

    if (focusableIndexes.length === 0) {
      return;
    }

    const currentFocusableIndex = focusableIndexes.indexOf(currentIndex);
    const currentPosition = currentFocusableIndex >= 0 ? currentFocusableIndex : 0;
    const nextPosition = (currentPosition + delta + focusableIndexes.length) % focusableIndexes.length;
    focusRootMenuItem(focusableIndexes[nextPosition] ?? focusableIndexes[0]!);
  };

  const focusFirstRootMenuItem = () => {
    const firstFocusableIndex = rootMenuItemRefs.current.findIndex((element) => element && !element.disabled);
    if (firstFocusableIndex >= 0) {
      focusRootMenuItem(firstFocusableIndex);
    }
  };

  const focusLastRootMenuItem = () => {
    for (let index = rootMenuItemRefs.current.length - 1; index >= 0; index -= 1) {
      const item = rootMenuItemRefs.current[index];
      if (item && !item.disabled) {
        item.focus();
        return;
      }
    }
  };

  const handleRootMenuItemKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
    input?: {
      onArrowRight?: () => void;
      onArrowLeft?: () => void;
    }
  ) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusRootMenuItemByDelta(index, 1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusRootMenuItemByDelta(index, -1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusFirstRootMenuItem();
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      focusLastRootMenuItem();
      return;
    }

    if (event.key === "ArrowRight" && input?.onArrowRight) {
      event.preventDefault();
      input.onArrowRight();
      return;
    }

    if (event.key === "ArrowLeft" && input?.onArrowLeft) {
      event.preventDefault();
      input.onArrowLeft();
    }
  };

  const closeChildTypeMenuAndFocusButton = () => {
    childTypeMenu.closeMenu();
    childMenuButtonRef.current?.focus();
  };

  const closeStatusMenuAndFocusButton = () => {
    setStatusMenuOpen(false);
    statusMenuButtonRef.current?.focus();
  };

  const focusStatusOption = (index: number) => {
    const option = statusOptionRefs.current[index];
    if (option && !option.disabled) {
      option.focus();
    }
  };

  const focusStatusOptionByDelta = (currentIndex: number, delta: number) => {
    const focusableIndexes = statusOptionRefs.current
      .map((element, index) => ({ element, index }))
      .filter((entry): entry is { element: HTMLButtonElement; index: number } => Boolean(entry.element && !entry.element.disabled))
      .map((entry) => entry.index);

    if (focusableIndexes.length === 0) {
      return;
    }

    const currentFocusableIndex = focusableIndexes.indexOf(currentIndex);
    const currentPosition = currentFocusableIndex >= 0 ? currentFocusableIndex : 0;
    const nextPosition = (currentPosition + delta + focusableIndexes.length) % focusableIndexes.length;
    focusStatusOption(focusableIndexes[nextPosition] ?? focusableIndexes[0]!);
  };

  const handleChildMenuButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      childTypeMenu.openMenu();
      return;
    }

    handleRootMenuItemKeyDown(event, 1, {
      onArrowRight: childTypeMenu.openMenu,
      onArrowLeft: closeChildTypeMenuAndFocusButton
    });
  };

  const handleStatusMenuButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    handleRootMenuItemKeyDown(event, 2, {
      onArrowRight: () => {
        setStatusMenuOpen(true);
      },
      onArrowLeft: closeStatusMenuAndFocusButton
    });
  };

  const handleChildTypeOptionKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
    option: WorkItemTypeOption
  ) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      childTypeMenu.moveActive(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      childTypeMenu.moveActive(-1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      childTypeMenu.setActiveByIndex(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      childTypeMenu.setActiveByIndex(childTypeMenu.options.length - 1);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void performCreateChild(option.name);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeChildTypeMenuAndFocusButton();
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      closeChildTypeMenuAndFocusButton();
    }
  };

  const handleStatusOptionKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
    option: WorkItemStateOption
  ) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusStatusOptionByDelta(index, 1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusStatusOptionByDelta(index, -1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusStatusOption(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      focusStatusOption(stateOptions.length - 1);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void performStateUpdate(option);
      return;
    }

    if (event.key === "Escape" || event.key === "ArrowLeft") {
      event.preventDefault();
      closeStatusMenuAndFocusButton();
    }
  };
  const renderedMenuStyle =
    menuState && constrainedMenuStyle?.key === menuPositionKey
      ? constrainedMenuStyle
      : {
          leftPx: menuState.position.x,
          topPx: menuState.position.y,
          maxHeightPx: getViewportMaxMenuHeightPx()
        };

  return createPortal(
    React.createElement(
      "div",
      {
        ref: props.menuRef,
        className: "timeline-work-item-context-menu",
        role: "menu",
        "aria-label": `Work item #${menuState.item.workItemId} context menu`,
        style: {
          position: "fixed",
          left: `${renderedMenuStyle.leftPx}px`,
          top: `${renderedMenuStyle.topPx}px`,
          maxHeight: `${renderedMenuStyle.maxHeightPx}px`
        },
        onContextMenu: (event: React.MouseEvent) => {
          event.preventDefault();
        }
      },
      React.createElement(
        "div",
        { className: "timeline-work-item-context-menu-title" },
        React.createElement("span", null, `#${menuState.item.workItemId}`),
        React.createElement("strong", null, menuState.item.title)
      ),
      React.createElement(
        "button",
        {
          ref: (element: HTMLButtonElement | null) => {
            firstActionRef.current = element;
            setRootMenuItemRef(0, element);
          },
          type: "button",
          role: "menuitem",
          className: "timeline-work-item-context-menu-action",
          disabled: duplicateDisabled,
          onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
            handleRootMenuItemKeyDown(event, 0);
          },
          onClick: () => {
            void performDuplicate();
          }
        },
        "Duplizieren"
      ),
      canCreateChild
        ? React.createElement(
            "div",
            { className: "timeline-work-item-context-menu-status" },
            React.createElement(
              "button",
              {
                ref: (element: HTMLButtonElement | null) => {
                  childMenuButtonRef.current = element;
                  setRootMenuItemRef(1, element);
                },
                type: "button",
                role: "menuitem",
                className: "timeline-work-item-context-menu-action timeline-work-item-context-menu-action-submenu",
                "aria-haspopup": "menu",
                "aria-expanded": childTypeMenu.isOpen ? "true" : "false",
                disabled: childCreateDisabled,
                onClick: () => {
                  childTypeMenu.toggleMenu();
                },
                onKeyDown: handleChildMenuButtonKeyDown
              },
              "Child hinzufügen"
            ),
            childTypeMenu.isOpen
              ? React.createElement(
                  "div",
                  {
                    className: "timeline-work-item-context-submenu",
                    role: "menu",
                    "aria-label": "Child Work Item Type auswählen"
                  },
                  childTypeMenu.loadState.status === "loading"
                    ? React.createElement(
                        "p",
                        { className: "timeline-work-item-context-menu-note" },
                        "Work Item Types werden geladen..."
                      )
                    : null,
                  childTypeMenu.loadState.status === "error"
                    ? React.createElement(
                        "p",
                        { className: "timeline-work-item-context-menu-note timeline-work-item-context-menu-error" },
                        childTypeMenu.loadState.error
                      )
                    : null,
                  childTypeMenu.loadState.status === "loaded" && childTypeMenu.options.length === 0
                    ? React.createElement(
                        "p",
                        { className: "timeline-work-item-context-menu-note" },
                        "Keine Work Item Types verfügbar."
                      )
                    : null,
                  ...childTypeMenu.options.map((option, index) =>
                    React.createElement(
                      "button",
                      {
                        key: option.name,
                        ref: (element: HTMLButtonElement | null) => {
                          childTypeOptionRefs.current[index] = element;
                        },
                        type: "button",
                        role: "menuitem",
                        className:
                          index === childTypeMenu.activeIndex
                            ? "timeline-work-item-context-menu-action timeline-work-item-context-menu-action-current"
                            : "timeline-work-item-context-menu-action",
                        disabled: busyAction !== null || !props.onCreateChildWorkItem,
                        onMouseEnter: () => {
                          childTypeMenu.setActiveByIndex(index);
                        },
                        onFocus: () => {
                          childTypeMenu.setActiveByIndex(index);
                        },
                        onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
                          handleChildTypeOptionKeyDown(event, index, option);
                        },
                        onClick: () => {
                          void performCreateChild(option.name);
                        }
                      },
                      option.name
                    )
                  )
                )
              : null
          )
        : null,
      React.createElement(
        "div",
        { className: "timeline-work-item-context-menu-status" },
        React.createElement(
          "button",
          {
            ref: (element: HTMLButtonElement | null) => {
              statusMenuButtonRef.current = element;
              setRootMenuItemRef(2, element);
            },
            type: "button",
            role: "menuitem",
            className: "timeline-work-item-context-menu-action timeline-work-item-context-menu-action-submenu",
            "aria-haspopup": "menu",
            "aria-expanded": statusMenuOpen ? "true" : "false",
            disabled: statusControlsDisabled,
            onClick: () => {
              setStatusMenuOpen((current) => !current);
            },
            onKeyDown: handleStatusMenuButtonKeyDown
          },
          "Status ändern"
        ),
        statusMenuOpen
          ? React.createElement(
              "div",
              {
                className: "timeline-work-item-context-submenu",
                role: "menu",
                "aria-label": "Status ändern"
              },
              statusLoadState.status === "loading"
                ? React.createElement("p", { className: "timeline-work-item-context-menu-note" }, "Status werden geladen...")
                : null,
              statusLoadState.status === "error"
                ? React.createElement(
                    "p",
                    { className: "timeline-work-item-context-menu-note timeline-work-item-context-menu-error" },
                    statusLoadState.error
                  )
                : null,
              statusLoadState.status === "loaded" && stateOptions.length === 0
                ? React.createElement(
                    "p",
                    { className: "timeline-work-item-context-menu-note" },
                    "Keine Statusoptionen verfügbar."
                  )
                : null,
              ...stateOptions.map((option, index) =>
                React.createElement(
                  "button",
                  {
                    key: option.name,
                    ref: (element: HTMLButtonElement | null) => {
                      statusOptionRefs.current[index] = element;
                    },
                    type: "button",
                    role: "menuitem",
                    className:
                      option.name.trim().toLowerCase() === currentState.trim().toLowerCase()
                        ? "timeline-work-item-context-menu-action timeline-work-item-context-menu-action-current"
                        : "timeline-work-item-context-menu-action",
                    disabled: busyAction !== null || !props.onUpdateWorkItemState,
                    onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
                      handleStatusOptionKeyDown(event, index, option);
                    },
                    onClick: () => {
                      void performStateUpdate(option);
                    }
                  },
                  React.createElement("span", {
                    className: "timeline-work-item-context-menu-swatch",
                    style: option.color ? { backgroundColor: normalizeStateColor(option.color) } : undefined,
                    "aria-hidden": "true"
                  }),
                  option.name
                )
              )
            )
          : null
      ),
      React.createElement(
        "button",
        {
          ref: (element: HTMLButtonElement | null) => {
            setRootMenuItemRef(3, element);
          },
          type: "button",
          role: "menuitem",
          className: "timeline-work-item-context-menu-action",
          disabled: linkControlsDisabled,
          onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
            handleRootMenuItemKeyDown(event, 3);
          },
          onClick: openInAzureDevOps
        },
        "In Azure DevOps öffnen"
      ),
      React.createElement(
        "button",
        {
          ref: (element: HTMLButtonElement | null) => {
            setRootMenuItemRef(4, element);
          },
          type: "button",
          role: "menuitem",
          className: "timeline-work-item-context-menu-action",
          disabled: linkControlsDisabled,
          onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
            handleRootMenuItemKeyDown(event, 4);
          },
          onClick: () => {
            void copyLink();
          }
        },
        "Link kopieren"
      ),
      actionError
        ? React.createElement(
            "p",
            {
              className: "timeline-work-item-context-menu-note timeline-work-item-context-menu-error",
              role: "status"
            },
            actionError
          )
        : null
    ),
    document.body
  );
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the DOM selection fallback below.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    if (!document.execCommand("copy")) {
      throw new Error("COPY_UNAVAILABLE");
    }
  } finally {
    document.body.removeChild(textarea);
  }
}

function normalizeStateColor(color: string): string {
  const trimmed = color.trim();
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

function getViewportMaxMenuHeightPx(): number {
  if (typeof window === "undefined") {
    return 320;
  }

  return getViewportAvailableMenuHeightPx(window.innerHeight);
}
