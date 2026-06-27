import React from "react";

import { APP_VERSION } from "../../shared/project-meta/project-meta.js";
import { type ChangelogLoadState, useAppChangelogLoader } from "./use-app-changelog-loader.js";

export type AppChangelogDialogProps = {
  open: boolean;
  onClose: () => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
};

const LazyAppChangelogMarkdown = React.lazy(async () => {
  const module = await import("./app-changelog-markdown.js");
  return { default: module.AppChangelogMarkdown };
});

export function AppChangelogDialog(props: AppChangelogDialogProps): React.ReactElement | null {
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const loadState = useAppChangelogLoader(props.open);

  React.useEffect(() => {
    if (!props.open) {
      return;
    }

    closeButtonRef.current?.focus();

    return () => {
      const returnFocusElement = props.returnFocusRef?.current;
      if (returnFocusElement && document.contains(returnFocusElement)) {
        returnFocusElement.focus();
      }
    };
  }, [props.open, props.returnFocusRef]);

  React.useEffect(() => {
    if (!props.open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        props.onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [props.open, props.onClose]);

  if (!props.open) {
    return null;
  }

  return React.createElement(
    "div",
    {
      className: "app-changelog-backdrop",
      "data-testid": "app-changelog-backdrop",
      onClick: props.onClose
    },
    React.createElement(
      "div",
      {
        ref: dialogRef,
        className: "app-changelog-dialog",
        role: "dialog",
        tabIndex: -1,
        "aria-modal": "true",
        "aria-labelledby": "app-changelog-title",
        "aria-busy": loadState.status === "loading",
        onClick: (event: React.MouseEvent) => event.stopPropagation(),
        onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
          trapChangelogDialogFocus(event, dialogRef.current);
        }
      },
      React.createElement(
        "header",
        { className: "app-changelog-header" },
        React.createElement("h2", { id: "app-changelog-title" }, `Changelog v${APP_VERSION}`),
        React.createElement(
          "button",
          {
            ref: closeButtonRef,
            type: "button",
            className: "app-changelog-close",
            "aria-label": "Changelog schließen",
            onClick: props.onClose
          },
          "×"
        )
      ),
      React.createElement(
        "div",
        { className: "app-changelog-content" },
        renderChangelogContent(loadState)
      )
    )
  );
}

function renderChangelogContent(loadState: ChangelogLoadState): React.ReactNode {
  if (loadState.status === "loading" || loadState.status === "idle") {
    return renderChangelogLoadingState();
  }

  if (loadState.status === "error") {
    return React.createElement(
      "div",
      { className: "app-changelog-error", role: "alert" },
      `Changelog konnte nicht geladen werden. ${loadState.error}`
    );
  }

  return React.createElement(
    React.Suspense,
    { fallback: renderChangelogLoadingState() },
    React.createElement(LazyAppChangelogMarkdown, {
      content: loadState.content
    })
  );
}

function renderChangelogLoadingState(): React.ReactElement {
  return React.createElement(
    "div",
    { className: "app-changelog-state", role: "status", "aria-live": "polite" },
    "Changelog wird geladen..."
  );
}

function trapChangelogDialogFocus(event: React.KeyboardEvent, dialogElement: HTMLElement | null): void {
  if (event.key !== "Tab" || !dialogElement) {
    return;
  }

  const focusableElements = findFocusableElements(dialogElement);
  if (focusableElements.length === 0) {
    event.preventDefault();
    dialogElement.focus();
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
    return;
  }

  if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
}

function findFocusableElements(dialogElement: HTMLElement): HTMLElement[] {
  return Array.from(
    dialogElement.querySelectorAll<HTMLElement>(
      [
        "a[href]",
        "button:not([disabled])",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        "[tabindex]:not([tabindex='-1'])"
      ].join(",")
    )
  ).filter((element) => element.getAttribute("aria-hidden") !== "true");
}
