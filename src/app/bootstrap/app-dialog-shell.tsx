import React from "react";

export type AppDialogShellProps = {
  open: boolean;
  title: React.ReactNode;
  titleId: string;
  closeLabel: string;
  onClose: () => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  busy?: boolean;
  backdropClassName?: string;
  dialogClassName?: string;
  headerClassName?: string;
  closeButtonClassName?: string;
  contentClassName?: string;
  children?: React.ReactNode;
};

export const APP_DIALOG_SHELL_SHORTCUT_CONTRACTS = ["overlays.close-active"] as const;

export function AppDialogShell(props: AppDialogShellProps): React.ReactElement | null {
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);

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
      className: joinClassNames("app-dialog-backdrop", props.backdropClassName),
      "data-testid": "app-dialog-backdrop",
      onClick: props.onClose
    },
    React.createElement(
      "div",
      {
        ref: dialogRef,
        className: joinClassNames("app-dialog", props.dialogClassName),
        role: "dialog",
        tabIndex: -1,
        "aria-modal": "true",
        "aria-labelledby": props.titleId,
        "aria-busy": props.busy === true,
        onClick: (event: React.MouseEvent) => event.stopPropagation(),
        onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
          trapAppDialogFocus(event, dialogRef.current);
        }
      },
      React.createElement(
        "header",
        { className: joinClassNames("app-dialog-header", props.headerClassName) },
        React.createElement("h2", { id: props.titleId }, props.title),
        React.createElement(
          "button",
          {
            ref: closeButtonRef,
            type: "button",
            className: joinClassNames("app-dialog-close", props.closeButtonClassName),
            "aria-label": props.closeLabel,
            onClick: props.onClose
          },
          "×"
        )
      ),
      React.createElement(
        "div",
        { className: joinClassNames("app-dialog-content", props.contentClassName) },
        props.children
      )
    )
  );
}

function joinClassNames(...classNames: Array<string | undefined>): string {
  return classNames.filter((className) => className && className.trim().length > 0).join(" ");
}

function trapAppDialogFocus(event: React.KeyboardEvent, dialogElement: HTMLElement | null): void {
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
