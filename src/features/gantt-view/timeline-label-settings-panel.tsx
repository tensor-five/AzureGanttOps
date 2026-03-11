import React from "react";

type TimelineLabelFieldOption = {
  fieldRef: string;
  label: string;
  subtitle: string;
};

export type TimelineLabelSettingsPanelProps = {
  open: boolean;
  panelRef: React.RefObject<HTMLDivElement | null>;
  sidebarFieldSearchDraft: string;
  labelFieldSearchDraft: string;
  filteredTimelineSidebarFieldOptions: TimelineLabelFieldOption[];
  filteredTimelineLabelFieldOptions: TimelineLabelFieldOption[];
  timelineSidebarFields: string[];
  timelineLabelFields: string[];
  labelMenuSidebarOptionsRef: React.RefObject<HTMLDivElement | null>;
  labelMenuBarOptionsRef: React.RefObject<HTMLDivElement | null>;
  onChangeSidebarFieldSearchDraft: (value: string) => void;
  onChangeLabelFieldSearchDraft: (value: string) => void;
  onClearTimelineSidebarFields: () => void;
  onClearTimelineLabelFields: () => void;
  onSyncLabelMenuScrollFromSidebar: () => void;
  onSyncLabelMenuScrollFromBar: () => void;
  onToggleTimelineSidebarField: (fieldRef: string) => void;
  onToggleTimelineLabelField: (fieldRef: string) => void;
};

export function TimelineLabelSettingsPanel(props: TimelineLabelSettingsPanelProps): React.ReactElement | null {
  if (!props.open) {
    return null;
  }

  return React.createElement(
    "div",
    {
      className: "timeline-label-menu",
      role: "group",
      "aria-label": "Timeline label fields",
      ref: props.panelRef
    },
    React.createElement(
      "div",
      { className: "timeline-label-menu-grid" },
      React.createElement(
        "section",
        { className: "timeline-label-menu-column" },
        React.createElement("h4", { className: "timeline-label-menu-title" }, "Left sidebar fields"),
        React.createElement(
          "p",
          { className: "timeline-details-muted" },
          "Selected fields are shown per row in the sticky sidebar."
        ),
        React.createElement(
          "button",
          {
            type: "button",
            className: "timeline-color-coding-value-reset",
            onClick: props.onClearTimelineSidebarFields
          },
          "Nothing in sidebar"
        ),
        React.createElement("input", {
          type: "search",
          className: "timeline-color-coding-dropdown-search",
          "aria-label": "Search timeline sidebar fields",
          placeholder: "Search field",
          value: props.sidebarFieldSearchDraft,
          onChange: (event) => {
            props.onChangeSidebarFieldSearchDraft((event.target as HTMLInputElement).value);
          }
        }),
        React.createElement(
          "div",
          {
            className: "timeline-label-menu-options",
            ref: props.labelMenuSidebarOptionsRef,
            onScroll: props.onSyncLabelMenuScrollFromSidebar
          },
          props.filteredTimelineSidebarFieldOptions.length === 0
            ? React.createElement("p", { className: "timeline-details-muted" }, "No matching field.")
            : props.filteredTimelineSidebarFieldOptions.map((option) =>
                React.createElement(
                  "label",
                  {
                    key: `timeline-sidebar-field-${option.fieldRef}`,
                    className: "timeline-label-menu-option"
                  },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: props.timelineSidebarFields.includes(option.fieldRef),
                    "aria-label": `Show ${option.label} in timeline sidebar`,
                    onChange: () => {
                      props.onToggleTimelineSidebarField(option.fieldRef);
                    }
                  }),
                  React.createElement(
                    "span",
                    { className: "timeline-label-menu-option-meta" },
                    React.createElement("strong", null, option.label),
                    React.createElement("span", null, option.subtitle)
                  )
                )
              )
        )
      ),
      React.createElement("div", { className: "timeline-label-menu-divider", "aria-hidden": "true" }),
      React.createElement(
        "section",
        { className: "timeline-label-menu-column" },
        React.createElement("h4", { className: "timeline-label-menu-title" }, "Bar label fields"),
        React.createElement("p", { className: "timeline-details-muted" }, 'Selected fields are shown as " - " joined text.'),
        React.createElement(
          "button",
          {
            type: "button",
            className: "timeline-color-coding-value-reset",
            onClick: props.onClearTimelineLabelFields
          },
          "Nothing in bars"
        ),
        React.createElement("input", {
          type: "search",
          className: "timeline-color-coding-dropdown-search",
          "aria-label": "Search timeline label fields",
          placeholder: "Search field",
          value: props.labelFieldSearchDraft,
          onChange: (event) => {
            props.onChangeLabelFieldSearchDraft((event.target as HTMLInputElement).value);
          }
        }),
        React.createElement(
          "div",
          {
            className: "timeline-label-menu-options",
            ref: props.labelMenuBarOptionsRef,
            onScroll: props.onSyncLabelMenuScrollFromBar
          },
          props.filteredTimelineLabelFieldOptions.length === 0
            ? React.createElement("p", { className: "timeline-details-muted" }, "No matching field.")
            : props.filteredTimelineLabelFieldOptions.map((option) =>
                React.createElement(
                  "label",
                  {
                    key: `timeline-label-field-${option.fieldRef}`,
                    className: "timeline-label-menu-option"
                  },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: props.timelineLabelFields.includes(option.fieldRef),
                    "aria-label": `Show ${option.label} in timeline bars`,
                    onChange: () => {
                      props.onToggleTimelineLabelField(option.fieldRef);
                    }
                  }),
                  React.createElement(
                    "span",
                    { className: "timeline-label-menu-option-meta" },
                    React.createElement("strong", null, option.label),
                    React.createElement("span", null, option.subtitle)
                  )
                )
              )
        )
      )
    )
  );
}
