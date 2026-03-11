import React from "react";

import type { TimelineColorCoding, TimelineFieldColorCodingConfig } from "./timeline-color-coding-preference.js";

type ValueColorStat = {
  key: string;
  label: string;
  count: number;
  defaultColor: string;
};

export type TimelineColorCodingPanelProps = {
  open: boolean;
  colorCoding: TimelineColorCoding;
  selectedFieldRef: string | null;
  fieldColorCoding: TimelineFieldColorCodingConfig;
  selectedFieldValueStats: ValueColorStat[];
  selectedModeValueStats: ValueColorStat[];
  isFieldColorCodingMode: boolean;
  isReadOnlyStatusColorCodingMode: boolean;
  onClose: () => void;
  onUpdateFieldValueColor: (valueKey: string, color: string | null) => void;
  resolveSelectedColorCodingLabel: (mode: TimelineColorCoding, fieldRef: string | null) => string;
  toScopedFieldValueColorKey: (fieldRef: string | null, valueKey: string) => string | null;
};

export function TimelineColorCodingPanel(props: TimelineColorCodingPanelProps): React.ReactElement | null {
  if (!props.open) {
    return null;
  }

  return React.createElement(
    "div",
    {
      className: "timeline-color-coding-modal-backdrop",
      role: "presentation",
      onClick: props.onClose
    },
    React.createElement(
      "section",
      {
        className: "timeline-color-coding-modal",
        role: "dialog",
        "aria-modal": "true",
        "aria-label": "Color coding settings",
        onClick: (event) => {
          event.stopPropagation();
        }
      },
      React.createElement(
        "header",
        { className: "timeline-color-coding-modal-header" },
        React.createElement("h4", null, "Color coding settings"),
        React.createElement(
          "button",
          {
            type: "button",
            className: "timeline-color-coding-settings-button",
            onClick: props.onClose
          },
          "Close"
        )
      ),
      React.createElement(
        "p",
        { className: "timeline-color-coding-active-selection" },
        `Active selection: ${props.resolveSelectedColorCodingLabel(props.colorCoding, props.selectedFieldRef)}`
      ),
      React.createElement(
        "p",
        { className: "timeline-color-coding-modal-field" },
        props.isFieldColorCodingMode
          ? props.selectedFieldRef
            ? `Field: ${props.selectedFieldRef}`
            : "Field: Select a field from the Color coding dropdown first."
          : `Mode: ${props.resolveSelectedColorCodingLabel(props.colorCoding, props.selectedFieldRef)}`
      ),
      props.isFieldColorCodingMode && props.selectedFieldRef
        ? React.createElement(
            "div",
            { className: "timeline-color-coding-value-grid", key: `field-values-${props.selectedFieldRef}` },
            props.selectedFieldValueStats.length === 0
              ? React.createElement("p", { className: "timeline-details-muted" }, "No values found for selected field.")
              : props.selectedFieldValueStats.map((entry) => {
                  const scopedKey = props.toScopedFieldValueColorKey(props.selectedFieldRef, entry.key);
                  const customColor =
                    (scopedKey ? props.fieldColorCoding.valueColors[scopedKey] : null) ??
                    props.fieldColorCoding.valueColors[entry.key] ??
                    null;
                  const effectiveColor = customColor ?? entry.defaultColor;
                  return React.createElement(
                    "div",
                    { key: entry.key, className: "timeline-color-coding-value-row" },
                    React.createElement(
                      "div",
                      { className: "timeline-color-coding-value-meta" },
                      React.createElement("strong", null, entry.label),
                      React.createElement("span", null, `${entry.count} item(s)`)
                    ),
                    React.createElement("input", {
                      type: "color",
                      value: effectiveColor,
                      "aria-label": `Color for ${entry.label}`,
                      onChange: (event) => {
                        props.onUpdateFieldValueColor(entry.key, (event.target as HTMLInputElement).value);
                      }
                    }),
                    React.createElement(
                      "button",
                      {
                        type: "button",
                        className: "timeline-color-coding-value-reset",
                        onClick: () => {
                          props.onUpdateFieldValueColor(entry.key, null);
                        }
                      },
                      "Auto"
                    )
                  );
                })
          )
        : props.isReadOnlyStatusColorCodingMode
          ? React.createElement(
              "div",
              { className: "timeline-color-coding-value-grid", key: `mode-values-${props.colorCoding}` },
              React.createElement(
                "p",
                { className: "timeline-details-muted" },
                "Status colors are read from the system and cannot be changed here."
              ),
              props.selectedModeValueStats.length === 0
                ? React.createElement("p", { className: "timeline-details-muted" }, "No values found for selected mode.")
                : props.selectedModeValueStats.map((entry) => {
                    return React.createElement(
                      "div",
                      { key: entry.key, className: "timeline-color-coding-value-row" },
                      React.createElement(
                        "div",
                        { className: "timeline-color-coding-value-meta" },
                        React.createElement("strong", null, entry.label),
                        React.createElement("span", null, `${entry.count} item(s)`)
                      )
                    );
                  })
            )
          : React.createElement(
              "p",
              { className: "timeline-details-muted" },
              props.isFieldColorCodingMode
                ? "Select a field to configure value-to-color mapping."
                : "This mode does not require field selection."
            )
    )
  );
}
