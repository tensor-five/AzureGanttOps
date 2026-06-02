import React from "react";
import { createPortal } from "react-dom";

import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";
import { buildAzureWorkItemUrl } from "../../shared/azure-devops/azure-work-item-url.js";
import { normalizeWorkItemStateOptions, type WorkItemStateOption } from "./work-item-state-options.js";
import type { WorkItemContextMenuState } from "./use-work-item-context-menu.js";

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
  onUpdateWorkItemState?: (input: { targetWorkItemId: number; state: string; stateColor: string | null }) => Promise<void>;
  onFetchWorkItemStateOptions?: (input: { targetWorkItemId: number }) => Promise<WorkItemStateOption[]>;
};

type StatusLoadState =
  | { status: "idle"; options: WorkItemStateOption[]; error: null }
  | { status: "loading"; options: WorkItemStateOption[]; error: null }
  | { status: "loaded"; options: WorkItemStateOption[]; error: null }
  | { status: "error"; options: WorkItemStateOption[]; error: string };

export function TimelineWorkItemContextMenu(props: TimelineWorkItemContextMenuProps): React.ReactElement | null {
  const firstActionRef = React.useRef<HTMLButtonElement | null>(null);
  const [statusMenuOpen, setStatusMenuOpen] = React.useState(false);
  const [statusLoadState, setStatusLoadState] = React.useState<StatusLoadState>({
    status: "idle",
    options: [],
    error: null
  });
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [busyAction, setBusyAction] = React.useState<"duplicate" | "state" | "copy" | null>(null);

  const menuState = props.menuState;
  const workItemId = menuState?.item.workItemId ?? null;
  const currentState = menuState?.item.state ?? "";
  const azureUrl = menuState
    ? buildAzureWorkItemUrl(props.organization, props.project, menuState.item.workItemId)
    : null;

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

  if (!menuState) {
    return null;
  }

  const stateOptions =
    props.onFetchWorkItemStateOptions && statusLoadState.status === "loaded"
      ? normalizeWorkItemStateOptions(statusLoadState.options)
      : [];
  const statusControlsDisabled = busyAction !== null || !props.onUpdateWorkItemState || !props.onFetchWorkItemStateOptions;
  const duplicateDisabled = busyAction !== null || !props.onDuplicateWorkItem;
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
          left: `${menuState.position.x}px`,
          top: `${menuState.position.y}px`
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
