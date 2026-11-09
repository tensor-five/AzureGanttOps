import React from "react";

import { sanitizeHtmlFragment } from "../../shared/security/sanitize-html-fragment.js";

export type DetailsPanelRichTextFieldProps = {
  label: string;
  value: string;
  disabled: boolean;
  editable: boolean;
  onChange: (nextHtml: string) => void;
};

const TOOLBAR_COMMANDS: Array<{ label: string; command: string; value?: string }> = [
  { label: "B", command: "bold" },
  { label: "I", command: "italic" },
  { label: "U", command: "underline" },
  { label: "1.", command: "insertOrderedList" },
  { label: "•", command: "insertUnorderedList" },
  { label: "H2", command: "formatBlock", value: "<h2>" },
  { label: "Quote", command: "formatBlock", value: "<blockquote>" }
];

/** Rich-text editor used for HTML fields (Description and other HTML fields). */
export function DetailsPanelRichTextField(props: DetailsPanelRichTextFieldProps): React.ReactElement {
  const [isEditing, setIsEditing] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const fieldRef = React.useRef<HTMLDivElement | null>(null);
  const editorRef = React.useRef<HTMLDivElement | null>(null);
  const hasContent = stripHtmlToText(props.value).length > 0;

  React.useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !isEditing) {
      return;
    }
    if (editor.innerHTML !== props.value) {
      editor.innerHTML = props.value;
    }
  }, [isEditing, props.value]);

  React.useEffect(() => {
    if (props.disabled) {
      setIsEditing(false);
    }
  }, [props.disabled]);

  const emitFromEditor = () => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    const sanitized = sanitizeHtmlFragment(editor.innerHTML);
    if (sanitized !== editor.innerHTML) {
      editor.innerHTML = sanitized;
    }
    props.onChange(sanitized);
  };

  const applyCommand = (command: string, value?: string) => {
    if (!editorRef.current || props.disabled) {
      return;
    }
    editorRef.current.focus();
    document.execCommand(command, false, value);
    emitFromEditor();
  };

  const startEditing = () => {
    if (!props.editable || props.disabled || isEditing) {
      return;
    }
    setIsEditing(true);
    requestAnimationFrame(() => {
      editorRef.current?.focus();
    });
  };

  return React.createElement(
    "div",
    { className: "timeline-details-richtext-field", ref: fieldRef },
    isEditing
      ? React.createElement(
          "div",
          { className: "timeline-richtext-toolbar", role: "group", "aria-label": `${props.label} formatting` },
          ...TOOLBAR_COMMANDS.map((entry) =>
            React.createElement(
              "button",
              {
                key: entry.label,
                type: "button",
                className: "timeline-richtext-button",
                onClick: () => applyCommand(entry.command, entry.value)
              },
              entry.label
            )
          ),
          React.createElement(
            "button",
            {
              type: "button",
              className: "timeline-richtext-button",
              onClick: () => {
                const url = window.prompt("Link URL", "https://");
                if (url && url.trim().length > 0) {
                  applyCommand("createLink", url.trim());
                }
              }
            },
            "Link"
          ),
          React.createElement(
            "button",
            { type: "button", className: "timeline-richtext-button", onClick: () => applyCommand("removeFormat") },
            "Clear"
          )
        )
      : null,
    isEditing
      ? React.createElement("div", {
          ref: editorRef,
          className: "timeline-details-richtext timeline-details-richtext-editing",
          contentEditable: !props.disabled,
          suppressContentEditableWarning: true,
          role: "textbox",
          "aria-multiline": true,
          "aria-label": props.label,
          onInput: emitFromEditor,
          onBlur: () => {
            requestAnimationFrame(() => {
              const active = document.activeElement;
              if (fieldRef.current && active && fieldRef.current.contains(active)) {
                return;
              }
              setIsEditing(false);
            });
          }
        })
      : React.createElement(
          "div",
          {
            className: [
              "timeline-details-richtext",
              "timeline-details-richtext-readonly",
              props.editable ? "timeline-details-richtext-clickable" : "",
              isExpanded ? "" : "timeline-details-richtext-collapsed"
            ]
              .filter(Boolean)
              .join(" "),
            title: props.editable ? `Click to edit ${props.label}` : undefined,
            onClick: startEditing
          },
          hasContent
            ? React.createElement("div", { dangerouslySetInnerHTML: { __html: sanitizeHtmlFragment(props.value) } })
            : React.createElement("span", { className: "timeline-details-value-empty" }, "—")
        ),
    !isEditing && hasContent
      ? React.createElement(
          "button",
          {
            type: "button",
            className: "timeline-description-toggle",
            "aria-expanded": isExpanded,
            onClick: (event: React.MouseEvent) => {
              event.stopPropagation();
              setIsExpanded((current) => !current);
            }
          },
          isExpanded ? "Show less" : "Show more"
        )
      : null
  );
}

function stripHtmlToText(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
