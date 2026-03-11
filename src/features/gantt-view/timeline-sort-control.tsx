import React from "react";

import { buildTimelineSortOptions, resolveTimelineSortFieldLabel } from "./timeline-sorting.js";
import type { TimelineSortField, TimelineSortPreference } from "./timeline-sort-preference.js";

type TimelineSortControlProps = {
  availableFieldRefs: string[];
  controlRef: React.RefObject<HTMLDivElement | null>;
  panelRef: React.RefObject<HTMLDivElement | null>;
  sortSettingsOpen: boolean;
  timelineSortPreference: TimelineSortPreference;
  onToggleSortSettings: () => void;
  onSelectPrimarySortField: (field: TimelineSortField) => void;
  onSelectSecondarySortField: (field: TimelineSortField | null) => void;
};

export function TimelineSortControl(props: TimelineSortControlProps): React.ReactElement {
  const options = React.useMemo(() => buildTimelineSortOptions(props.availableFieldRefs), [props.availableFieldRefs]);
  const [openDropdown, setOpenDropdown] = React.useState<"primary" | "secondary" | null>(null);
  const [searchDraft, setSearchDraft] = React.useState("");
  const secondaryOptions = React.useMemo(
    () => options.filter((option) => option.value !== props.timelineSortPreference.primary),
    [options, props.timelineSortPreference.primary]
  );
  const selectedSummary = React.useMemo(() => {
    const primaryLabel = resolveTimelineSortFieldLabel(props.timelineSortPreference.primary);
    const secondaryLabel = props.timelineSortPreference.secondary
      ? resolveTimelineSortFieldLabel(props.timelineSortPreference.secondary)
      : "None";
    return `${primaryLabel} / ${secondaryLabel}`;
  }, [props.timelineSortPreference.primary, props.timelineSortPreference.secondary]);
  const filteredPrimaryOptions = React.useMemo(
    () => filterSortOptionsBySearch(options, searchDraft),
    [options, searchDraft]
  );
  const filteredSecondaryOptions = React.useMemo(
    () => filterSortOptionsBySearch(secondaryOptions, searchDraft),
    [secondaryOptions, searchDraft]
  );
  const primaryLabel = resolveTimelineSortFieldLabel(props.timelineSortPreference.primary);
  const secondaryLabel = props.timelineSortPreference.secondary
    ? resolveTimelineSortFieldLabel(props.timelineSortPreference.secondary)
    : "None";

  React.useEffect(() => {
    if (!props.sortSettingsOpen) {
      setOpenDropdown(null);
      setSearchDraft("");
    }
  }, [props.sortSettingsOpen]);

  return React.createElement(
    "div",
    { className: "timeline-sort-control", ref: props.controlRef },
    React.createElement(
      "button",
      {
        type: "button",
        className: props.sortSettingsOpen ? "timeline-label-toggle timeline-label-toggle-active" : "timeline-label-toggle",
        "aria-label": "Toggle timeline sorting",
        "aria-expanded": props.sortSettingsOpen ? "true" : "false",
        "aria-haspopup": "dialog",
        onClick: props.onToggleSortSettings
      },
      React.createElement(
        "svg",
        {
          viewBox: "0 0 24 24",
          className: "timeline-label-toggle-icon",
          "aria-hidden": "true"
        },
        React.createElement("path", {
          d: "M7 4h14v2H7V4Zm4 7h10v2H11v-2Zm4 7h6v2h-6v-2ZM3 6l2.5 3L8 6H6v12H5V6H3Z"
        })
      ),
      React.createElement("span", { className: "timeline-label-toggle-count" }, "2")
    ),
    props.sortSettingsOpen
      ? React.createElement(
          "div",
          {
            className: "timeline-label-menu timeline-sort-menu",
            role: "group",
            "aria-label": "Timeline sorting",
            ref: props.panelRef
          },
          React.createElement("h4", { className: "timeline-label-menu-title" }, "Sort work items"),
          React.createElement("p", { className: "timeline-details-muted" }, `Current: ${selectedSummary}`),
          React.createElement(
            "div",
            { className: "timeline-sort-menu-grid" },
            React.createElement(
              "div",
              { className: "timeline-sort-menu-field" },
              React.createElement("span", null, "Primary"),
              React.createElement(
                "div",
                { className: "timeline-filter-dropdown-anchor" },
                React.createElement(
                  "button",
                  {
                    type: "button",
                    className: "timeline-color-coding-select timeline-color-coding-select-trigger timeline-sort-select",
                    "aria-label": "Timeline sort primary",
                    "aria-haspopup": "listbox",
                    "aria-expanded": openDropdown === "primary" ? "true" : "false",
                    onClick: () => {
                      setOpenDropdown((current) => (current === "primary" ? null : "primary"));
                      setSearchDraft("");
                    }
                  },
                  primaryLabel
                ),
                openDropdown === "primary"
                  ? React.createElement(
                      "div",
                      {
                        className: "timeline-color-coding-dropdown",
                        role: "listbox",
                        "aria-label": "Timeline sort primary options"
                      },
                      React.createElement("input", {
                        type: "search",
                        className: "timeline-color-coding-dropdown-search",
                        "aria-label": "Search timeline sort primary",
                        placeholder: "Search field",
                        value: searchDraft,
                        onChange: (event) => {
                          setSearchDraft((event.target as HTMLInputElement).value);
                        }
                      }),
                      React.createElement(
                        "div",
                        { className: "timeline-color-coding-dropdown-options" },
                        filteredPrimaryOptions.length === 0
                          ? React.createElement("p", { className: "timeline-details-muted" }, "No matching field.")
                          : filteredPrimaryOptions.map((option) =>
                              React.createElement(
                                "button",
                                {
                                  key: `timeline-sort-primary-${option.value}`,
                                  type: "button",
                                  className:
                                    option.value === props.timelineSortPreference.primary
                                      ? "timeline-color-coding-option timeline-color-coding-option-active"
                                      : "timeline-color-coding-option",
                                  onClick: () => {
                                    props.onSelectPrimarySortField(option.value);
                                    setOpenDropdown(null);
                                  }
                                },
                                React.createElement("span", { className: "timeline-color-coding-option-label" }, option.label),
                                React.createElement("span", { className: "timeline-color-coding-option-subtitle" }, option.subtitle)
                              )
                            )
                      )
                    )
                  : null
              )
            ),
            React.createElement(
              "div",
              { className: "timeline-sort-menu-field" },
              React.createElement("span", null, "Secondary"),
              React.createElement(
                "div",
                { className: "timeline-filter-dropdown-anchor" },
                React.createElement(
                  "button",
                  {
                    type: "button",
                    className: "timeline-color-coding-select timeline-color-coding-select-trigger timeline-sort-select",
                    "aria-label": "Timeline sort secondary",
                    "aria-haspopup": "listbox",
                    "aria-expanded": openDropdown === "secondary" ? "true" : "false",
                    onClick: () => {
                      setOpenDropdown((current) => (current === "secondary" ? null : "secondary"));
                      setSearchDraft("");
                    }
                  },
                  secondaryLabel
                ),
                openDropdown === "secondary"
                  ? React.createElement(
                      "div",
                      {
                        className: "timeline-color-coding-dropdown",
                        role: "listbox",
                        "aria-label": "Timeline sort secondary options"
                      },
                      React.createElement("input", {
                        type: "search",
                        className: "timeline-color-coding-dropdown-search",
                        "aria-label": "Search timeline sort secondary",
                        placeholder: "Search field",
                        value: searchDraft,
                        onChange: (event) => {
                          setSearchDraft((event.target as HTMLInputElement).value);
                        }
                      }),
                      React.createElement(
                        "div",
                        { className: "timeline-color-coding-dropdown-options" },
                        React.createElement(
                          "button",
                          {
                            type: "button",
                            className:
                              props.timelineSortPreference.secondary === null
                                ? "timeline-color-coding-option timeline-color-coding-option-active"
                                : "timeline-color-coding-option",
                            onClick: () => {
                              props.onSelectSecondarySortField(null);
                              setOpenDropdown(null);
                            }
                          },
                          React.createElement("span", { className: "timeline-color-coding-option-label" }, "None"),
                          React.createElement("span", { className: "timeline-color-coding-option-subtitle" }, "Disabled")
                        ),
                        filteredSecondaryOptions.length === 0
                          ? React.createElement("p", { className: "timeline-details-muted" }, "No matching field.")
                          : filteredSecondaryOptions.map((option) =>
                              React.createElement(
                                "button",
                                {
                                  key: `timeline-sort-secondary-${option.value}`,
                                  type: "button",
                                  className:
                                    option.value === props.timelineSortPreference.secondary
                                      ? "timeline-color-coding-option timeline-color-coding-option-active"
                                      : "timeline-color-coding-option",
                                  onClick: () => {
                                    props.onSelectSecondarySortField(option.value);
                                    setOpenDropdown(null);
                                  }
                                },
                                React.createElement("span", { className: "timeline-color-coding-option-label" }, option.label),
                                React.createElement("span", { className: "timeline-color-coding-option-subtitle" }, option.subtitle)
                              )
                            )
                      )
                    )
                  : null
              )
            )
          )
        )
      : null
  );
}

function filterSortOptionsBySearch(
  options: ReturnType<typeof buildTimelineSortOptions>,
  searchDraft: string
): ReturnType<typeof buildTimelineSortOptions> {
  const normalizedSearch = searchDraft.trim().toLowerCase();
  if (normalizedSearch.length === 0) {
    return options;
  }

  return options.filter((option) => `${option.label} ${option.subtitle}`.toLowerCase().includes(normalizedSearch));
}
