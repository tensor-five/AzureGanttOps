import React from "react";

type TimelineFieldFilter = {
  slotId: number;
  fieldRef: string | null;
  selectedValueKeys: string[];
};

type OpenFilterDropdownState = {
  slotId: number;
  kind: "field" | "value";
};

type ValueStatOption = {
  key: string;
  label: string;
  count: number;
};

export type TimelineFilterPanelProps = {
  open: boolean;
  panelRef: React.RefObject<HTMLDivElement | null>;
  availableFieldRefs: string[];
  timelineFieldFilters: TimelineFieldFilter[];
  openFilterDropdown: OpenFilterDropdownState | null;
  openFilterFieldOptions: string[];
  openFilterValueOptions: ValueStatOption[];
  effectiveTimelineValueOptionsForFilter: (fieldRef: string | null) => ValueStatOption[];
  maxFilterSlots: number;
  getFieldDisplayName: (fieldRef: string) => string;
  onSetOpenFilterDropdown: React.Dispatch<React.SetStateAction<OpenFilterDropdownState | null>>;
  onSetFilterFieldSearchDraft: (value: string) => void;
  onSetFilterValueSearchDraft: (value: string) => void;
  filterFieldSearchDraft: string;
  filterValueSearchDraft: string;
  onApplyFieldFilterSelection: (slotId: number, fieldRef: string | null) => void;
  onToggleTimelineFieldValueSelection: (slotId: number, valueKey: string) => void;
  onRemoveTimelineFilterSlot: (slotId: number) => void;
  onAddTimelineFilterSlot: () => void;
};

export function TimelineFilterPanel(props: TimelineFilterPanelProps): React.ReactElement | null {
  if (!props.open) {
    return null;
  }

  return React.createElement(
    "div",
    {
      className: "timeline-filter-panel-motion"
    },
    React.createElement(
      "div",
    {
      className: "timeline-filter-panel",
      role: "group",
      "aria-label": "Timeline filters",
      ref: props.panelRef
    },
    props.availableFieldRefs.length === 0
      ? React.createElement("p", { className: "timeline-details-muted" }, "No fields available for filtering.")
      : React.createElement(
          "div",
          { className: "timeline-filter-grid" },
          ...props.timelineFieldFilters.map((filter, index) => {
            const selectedFieldDisplay = filter.fieldRef ? props.getFieldDisplayName(filter.fieldRef) : `Filter ${index + 1}`;
            const valueLabel =
              !filter.fieldRef || filter.selectedValueKeys.length === 0
                ? "All values"
                : `${filter.selectedValueKeys.length} selected`;
            const isFieldDropdownOpen =
              props.openFilterDropdown?.kind === "field" && props.openFilterDropdown.slotId === filter.slotId;
            const isValueDropdownOpen =
              props.openFilterDropdown?.kind === "value" && props.openFilterDropdown.slotId === filter.slotId;
            const filterValueOptions =
              isValueDropdownOpen && props.openFilterDropdown?.slotId === filter.slotId
                ? props.openFilterValueOptions
                : [];

            return React.createElement(
              "div",
              {
                key: `timeline-filter-slot-${filter.slotId}`,
                className:
                  isFieldDropdownOpen || isValueDropdownOpen
                    ? "timeline-filter-row timeline-filter-row-open timeline-control-cluster"
                    : "timeline-filter-row timeline-control-cluster"
              },
              React.createElement(
                "div",
                { className: "timeline-filter-dropdown-anchor" },
                React.createElement(
                  "button",
                  {
                    type: "button",
                    className: "timeline-color-coding-select timeline-color-coding-select-trigger",
                    "aria-label": `Select filter field ${index + 1}`,
                    "aria-haspopup": "listbox",
                    "aria-expanded": isFieldDropdownOpen ? "true" : "false",
                    onClick: () => {
                      props.onSetOpenFilterDropdown((current) =>
                        current?.kind === "field" && current.slotId === filter.slotId
                          ? null
                          : { slotId: filter.slotId, kind: "field" }
                      );
                      props.onSetFilterFieldSearchDraft("");
                      props.onSetFilterValueSearchDraft("");
                    }
                  },
                  selectedFieldDisplay
                ),
                isFieldDropdownOpen
                  ? React.createElement(
                      "div",
                      {
                        className: "timeline-color-coding-dropdown",
                        role: "listbox",
                        "aria-label": `Filter field options ${index + 1}`
                      },
                      React.createElement("input", {
                        type: "search",
                        className: "timeline-color-coding-dropdown-search",
                        "aria-label": `Search filter fields ${index + 1}`,
                        placeholder: "Search field",
                        value: props.filterFieldSearchDraft,
                        onChange: (event) => {
                          props.onSetFilterFieldSearchDraft((event.target as HTMLInputElement).value);
                        },
                        onKeyDown: (event) => {
                          if (event.key !== "Enter") {
                            return;
                          }

                          event.preventDefault();
                          const firstField = props.openFilterFieldOptions[0] ?? null;
                          if (!firstField) {
                            return;
                          }
                          props.onApplyFieldFilterSelection(filter.slotId, firstField);
                          props.onSetOpenFilterDropdown(null);
                        }
                      }),
                      React.createElement(
                        "div",
                        { className: "timeline-color-coding-dropdown-options" },
                        props.openFilterFieldOptions.length === 0
                          ? React.createElement("p", { className: "timeline-details-muted" }, "No matching field.")
                          : props.openFilterFieldOptions.map((fieldRef) =>
                              React.createElement(
                                "button",
                                {
                                  key: `${filter.slotId}-${fieldRef}`,
                                  type: "button",
                                  className:
                                    filter.fieldRef === fieldRef
                                      ? "timeline-color-coding-option timeline-color-coding-option-active"
                                      : "timeline-color-coding-option",
                                  onClick: () => {
                                    props.onApplyFieldFilterSelection(filter.slotId, fieldRef);
                                    props.onSetOpenFilterDropdown(null);
                                  }
                                },
                                React.createElement("span", { className: "timeline-color-coding-option-label" }, props.getFieldDisplayName(fieldRef)),
                                React.createElement("span", { className: "timeline-color-coding-option-subtitle" }, fieldRef)
                              )
                            )
                      )
                    )
                  : null
              ),
              React.createElement(
                "div",
                { className: "timeline-filter-dropdown-anchor" },
                React.createElement(
                  "button",
                  {
                    type: "button",
                    className: "timeline-color-coding-select timeline-color-coding-select-trigger",
                    "aria-label": `Select filter values ${index + 1}`,
                    "aria-haspopup": "listbox",
                    "aria-expanded": isValueDropdownOpen ? "true" : "false",
                    disabled: !filter.fieldRef,
                    onClick: () => {
                      if (!filter.fieldRef) {
                        return;
                      }

                      props.onSetOpenFilterDropdown((current) =>
                        current?.kind === "value" && current.slotId === filter.slotId
                          ? null
                          : { slotId: filter.slotId, kind: "value" }
                      );
                      props.onSetFilterValueSearchDraft("");
                      props.onSetFilterFieldSearchDraft("");
                    }
                  },
                  valueLabel
                ),
                isValueDropdownOpen
                  ? React.createElement(
                      "div",
                      {
                        className: "timeline-color-coding-dropdown",
                        role: "listbox",
                        "aria-label": `Filter value options ${index + 1}`
                      },
                      React.createElement("input", {
                        type: "search",
                        className: "timeline-color-coding-dropdown-search",
                        "aria-label": `Search filter values ${index + 1}`,
                        placeholder: "Search value",
                        value: props.filterValueSearchDraft,
                        onChange: (event) => {
                          props.onSetFilterValueSearchDraft((event.target as HTMLInputElement).value);
                        }
                      }),
                      React.createElement(
                        "div",
                        { className: "timeline-color-coding-dropdown-options" },
                        filterValueOptions.length === 0
                          ? React.createElement("p", { className: "timeline-details-muted" }, "No matching value.")
                          : filterValueOptions.map((entry) =>
                              React.createElement(
                                "label",
                                {
                                  key: `${filter.slotId}-value-${entry.key}`,
                                  className: "timeline-filter-value-option"
                                },
                                React.createElement("input", {
                                  type: "checkbox",
                                  checked: filter.selectedValueKeys.includes(entry.key),
                                  "aria-label": `Include ${entry.label} in filter ${index + 1}`,
                                  onChange: () => {
                                    props.onToggleTimelineFieldValueSelection(filter.slotId, entry.key);
                                  }
                                }),
                                React.createElement(
                                  "span",
                                  { className: "timeline-filter-value-option-meta" },
                                  React.createElement("strong", null, entry.label),
                                  React.createElement("span", null, `${entry.count} item(s)`)
                                )
                              )
                            )
                      )
                    )
                  : null
              ),
              React.createElement(
                "button",
                {
                  type: "button",
                  className: "timeline-filter-row-clear",
                  "aria-label":
                    props.timelineFieldFilters.length > 1 ? `Remove filter ${index + 1}` : `Clear filter ${index + 1}`,
                  onClick: () => {
                    props.onRemoveTimelineFilterSlot(filter.slotId);
                  }
                },
                props.timelineFieldFilters.length > 1 ? "Remove" : "Clear"
              )
            );
          }),
          React.createElement(
            "button",
            {
              type: "button",
              className: "timeline-filter-add",
              "aria-label": "Add timeline filter",
              disabled: props.timelineFieldFilters.length >= props.maxFilterSlots,
              onClick: props.onAddTimelineFilterSlot
            },
            "+"
          )
        )
    )
  );
}
