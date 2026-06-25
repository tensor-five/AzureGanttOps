import React from "react";

export type InitialQueryOnboardingDialogProps = {
  queryInput: string;
  organization: string;
  project: string;
  loading: boolean;
  statusMessage: string | null;
  errorMessage: string | null;
  onQueryInputChange: (value: string) => void;
  onOrganizationChange: (value: string) => void;
  onProjectChange: (value: string) => void;
  onSubmit: () => void;
};

export function InitialQueryOnboardingDialog(props: InitialQueryOnboardingDialogProps): React.ReactElement {
  const dialogRef = React.useRef<HTMLFormElement | null>(null);
  const queryInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    const previouslyFocusedElement =
      typeof document !== "undefined" && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    queryInputRef.current?.focus();

    return () => {
      if (previouslyFocusedElement && document.contains(previouslyFocusedElement)) {
        previouslyFocusedElement.focus();
      }
    };
  }, []);

  return React.createElement(
    "div",
    {
      className: "initial-query-onboarding-backdrop",
      "data-testid": "initial-query-onboarding-backdrop"
    },
    React.createElement(
      "form",
      {
        ref: dialogRef,
        className: "initial-query-onboarding-dialog",
        role: "dialog",
        tabIndex: -1,
        "aria-modal": true,
        "aria-labelledby": "initial-query-onboarding-title",
        "aria-describedby": "initial-query-onboarding-desc",
        "aria-busy": props.loading,
        onClick: (event: React.MouseEvent) => event.stopPropagation(),
        onKeyDown: (event: React.KeyboardEvent<HTMLFormElement>) => {
          trapDialogFocus(event, dialogRef.current);
        },
        onSubmit: (event: React.FormEvent) => {
          event.preventDefault();
          props.onSubmit();
        }
      },
      React.createElement(
        "header",
        { className: "initial-query-onboarding-header" },
        React.createElement("h2", { id: "initial-query-onboarding-title" }, "Erste Query verbinden"),
        React.createElement(
          "p",
          { id: "initial-query-onboarding-desc", className: "query-selector-hint" },
          "Füge eine Azure DevOps Query-URL ein oder nutze eine Query-ID mit Organisation und Projekt."
        )
      ),
      React.createElement(
        "div",
        { className: "query-selector-form" },
        React.createElement(
          "label",
          { className: "query-selector-field" },
          "Query URL oder Query ID",
          React.createElement("input", {
            ref: queryInputRef,
            className: "query-selector-input",
            "aria-label": "Erststart Query URL oder Query ID",
            autoComplete: "off",
            disabled: props.loading,
            value: props.queryInput,
            onChange: (event) => {
              props.onQueryInputChange((event.target as HTMLInputElement).value);
            }
          })
        ),
        React.createElement(
          "div",
          { className: "query-selector-grid" },
          React.createElement(
            "label",
            { className: "query-selector-field" },
            "Organisation",
            React.createElement("input", {
              className: "query-selector-input",
              "aria-label": "Erststart Organisation",
              autoComplete: "off",
              disabled: props.loading,
              value: props.organization,
              onChange: (event) => {
                props.onOrganizationChange((event.target as HTMLInputElement).value);
              }
            })
          ),
          React.createElement(
            "label",
            { className: "query-selector-field" },
            "Projekt",
            React.createElement("input", {
              className: "query-selector-input",
              "aria-label": "Erststart Projekt",
              autoComplete: "off",
              disabled: props.loading,
              value: props.project,
              onChange: (event) => {
                props.onProjectChange((event.target as HTMLInputElement).value);
              }
            })
          )
        )
      ),
      props.errorMessage
        ? React.createElement(
            "div",
            {
              role: "alert",
              className: "query-selector-error initial-query-onboarding-error"
            },
            props.errorMessage
          )
        : null,
      props.loading || props.statusMessage
        ? React.createElement(
            "div",
            {
              role: "status",
              "aria-live": "polite",
              className: "initial-query-onboarding-status"
            },
            props.loading ? "Query wird geladen..." : props.statusMessage
          )
        : null,
      React.createElement(
        "div",
        { className: "initial-query-onboarding-actions" },
        React.createElement(
          "button",
          {
            type: "submit",
            className: "query-selector-primary initial-query-onboarding-submit",
            disabled: props.loading
          },
          props.loading ? "Laden..." : "Query laden"
        )
      )
    )
  );
}

function trapDialogFocus(event: React.KeyboardEvent, dialogElement: HTMLElement | null): void {
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
