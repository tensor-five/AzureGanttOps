import React from "react";

import type { HeaderQueryEditDraft } from "./use-header-query-flow.js";

export type HeaderQueryEditFormProps = {
  draft: HeaderQueryEditDraft;
  loading: boolean;
  message: string | null;
  onDraftChange: (draft: HeaderQueryEditDraft) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function HeaderQueryEditForm(props: HeaderQueryEditFormProps): React.ReactElement {
  const nameInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      props.onSave();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      props.onCancel();
    }
  };

  return React.createElement(
    "form",
    {
      className: "header-query-edit-form",
      "aria-label": "Edit saved query",
      onSubmit: (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        props.onSave();
      }
    },
    React.createElement(
      "label",
      { className: "header-query-edit-label" },
      "Name",
      React.createElement("input", {
        ref: nameInputRef,
        className: "header-query-edit-input",
        "aria-label": "Query name",
        value: props.draft.name,
        disabled: props.loading,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
          props.onDraftChange({ ...props.draft, name: event.target.value });
        },
        onKeyDown: handleKeyDown
      })
    ),
    React.createElement(
      "label",
      { className: "header-query-edit-label" },
      "Query URL or ID",
      React.createElement("input", {
        className: "header-query-edit-input",
        "aria-label": "Query URL or ID",
        value: props.draft.queryInput,
        disabled: props.loading,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
          props.onDraftChange({ ...props.draft, queryInput: event.target.value });
        },
        onKeyDown: handleKeyDown
      })
    ),
    props.message
      ? React.createElement("div", { className: "header-query-edit-message", role: "alert" }, props.message)
      : null,
    React.createElement(
      "div",
      { className: "header-query-edit-actions" },
      React.createElement(
        "button",
        {
          type: "button",
          className: "header-query-edit-cancel",
          disabled: props.loading,
          onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
            event.preventDefault();
            event.stopPropagation();
            props.onCancel();
          }
        },
        "Cancel"
      ),
      React.createElement(
        "button",
        {
          type: "submit",
          className: "header-query-edit-save",
          disabled: props.loading
        },
        "Save"
      )
    )
  );
}

export function HeaderQueryEditIcon(): React.ReactElement {
  return React.createElement(
    "svg",
    {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true"
    },
    React.createElement("path", { d: "M12 20h9" }),
    React.createElement("path", { d: "M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" })
  );
}
