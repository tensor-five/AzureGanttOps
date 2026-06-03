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
  const childTypeOptionRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
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

  if (!menuState) {
    return null;
  }

  const stateOptions =
    props.onFetchWorkItemStateOptions && statusLoadState.status === "loaded"
      ? normalizeWorkItemStateOptions(statusLoadState.options)
      : [];
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

  const handleChildMenuButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " " || event.key === "ArrowRight") {
      event.preventDefault();
      childTypeMenu.openMenu();
    }
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
      childTypeMenu.closeMenu();
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      childTypeMenu.closeMenu();
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
          ref: firstActionRef,
          type: "button",
          role: "menuitem",
          className: "timeline-work-item-context-menu-action",
          disabled: duplicateDisabled,
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
            type: "button",
            role: "menuitem",
            className: "timeline-work-item-context-menu-action timeline-work-item-context-menu-action-submenu",
            "aria-haspopup": "menu",
            "aria-expanded": statusMenuOpen ? "true" : "false",
            disabled: statusControlsDisabled,
            onClick: () => {
              setStatusMenuOpen((current) => !current);
            }
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
              ...stateOptions.map((option) =>
                React.createElement(
                  "button",
                  {
                    key: option.name,
                    type: "button",
                    role: "menuitem",
                    className:
                      option.name.trim().toLowerCase() === currentState.trim().toLowerCase()
                        ? "timeline-work-item-context-menu-action timeline-work-item-context-menu-action-current"
                        : "timeline-work-item-context-menu-action",
                    disabled: busyAction !== null || !props.onUpdateWorkItemState,
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
          type: "button",
          role: "menuitem",
          className: "timeline-work-item-context-menu-action",
          disabled: linkControlsDisabled,
          onClick: openInAzureDevOps
        },
        "In Azure DevOps öffnen"
      ),
      React.createElement(
        "button",
        {
          type: "button",
          role: "menuitem",
          className: "timeline-work-item-context-menu-action",
          disabled: linkControlsDisabled,
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
