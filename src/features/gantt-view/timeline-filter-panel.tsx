import React from "react";
import { createPortal } from "react-dom";

import {
  EMPTY_TIMELINE_DATE_RANGE,
  isTimelineDateRangeFilter,
  type TimelineDateRange,
  type TimelineFilterGroup
} from "./timeline-filter-model.js";
import {
  countTimelineFilterSlots
} from "./timeline-filter-groups.js";
import {
  formatTimelineDateRangeFilterLabel,
  fromTimelineDateTimeLocalInputValue,
  isTimelineDateRangeInvalid,
  toTimelineDateTimeLocalInputValue
} from "./timeline-field-filtering.js";

type OpenFilterDropdownState = {
  slotId: number;
  kind: "field" | "value";
};

type ValueStatOption = {
  key: string;
  label: string;
  count: number;
};

type TimelineFilterPanelFilter = TimelineFilterGroup["filters"][number];
type FilterDropdownTriggerRefs = {
  current: Record<string, HTMLButtonElement | null>;
};

export type TimelineFilterPanelProps = {
  open: boolean;
  panelRef: React.RefObject<HTMLDivElement | null>;
  availableFieldRefs: string[];
  timelineFilterGroups: TimelineFilterGroup[];
  openFilterDropdown: OpenFilterDropdownState | null;
  openFilterFieldOptions: string[];
  openFilterValueOptions: ValueStatOption[];
  maxFilterSlots: number;
  getFieldDisplayName: (fieldRef: string) => string;
  onSetOpenFilterDropdown: React.Dispatch<React.SetStateAction<OpenFilterDropdownState | null>>;
  onSetFilterFieldSearchDraft: (value: string) => void;
  onSetFilterValueSearchDraft: (value: string) => void;
  filterFieldSearchDraft: string;
  filterValueSearchDraft: string;
  onApplyFieldFilterSelection: (slotId: number, fieldRef: string | null) => void;
  onToggleTimelineFieldValueSelection: (slotId: number, valueKey: string) => void;
  onToggleVisibleTimelineFieldValueSelections: (slotId: number, valueKeys: string[]) => void;
  onUpdateTimelineDateRangeFilter: (slotId: number, dateRange: TimelineDateRange) => void;
  onRemoveTimelineFilterSlot: (slotId: number) => void;
  onRemoveTimelineFilterGroup: (groupId: number) => void;
  onAddTimelineFilterCondition: (groupId: number) => void;
  onAddTimelineFilterGroup: () => void;
};

export function TimelineFilterPanel(props: TimelineFilterPanelProps): React.ReactElement | null {
  const filterDropdownTriggerRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const [filterDropdownStyle, setFilterDropdownStyle] = React.useState<React.CSSProperties | null>(null);

  React.useLayoutEffect(() => {
    if (!props.openFilterDropdown) {
      setFilterDropdownStyle(null);
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const triggerKey = `${props.openFilterDropdown.slotId}-${props.openFilterDropdown.kind}`;

    const updateDropdownPosition = () => {
      const trigger = filterDropdownTriggerRefs.current[triggerKey];
      if (!trigger) {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const dropdownWidth = Math.min(Math.max(rect.width, 440), Math.max(320, viewportWidth - 16));
      const left = Math.min(Math.max(8, rect.left), Math.max(8, viewportWidth - dropdownWidth - 8));

      setFilterDropdownStyle({
        position: "fixed",
        top: rect.bottom + 6,
        left,
        width: dropdownWidth,
        maxWidth: "min(560px, calc(100vw - 16px))"
      });
    };

    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);

    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [props.openFilterDropdown]);

  const totalFilterSlots = countTimelineFilterSlots(props.timelineFilterGroups);

  if (!props.open) {
    return null;
  }

  const filterGroupNodes = renderTimelineFilterGroupSections(
    props,
    totalFilterSlots,
    filterDropdownTriggerRefs,
    filterDropdownStyle
  );

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
            ...filterGroupNodes,
            React.createElement(
              "button",
              {
                type: "button",
                className: "timeline-filter-add timeline-filter-add-group",
                "aria-label": "Add OR filter group",
                disabled: totalFilterSlots >= props.maxFilterSlots,
                onClick: props.onAddTimelineFilterGroup
              },
              "+ OR Group"
            )
          )
    )
  );
}

function renderTimelineFilterGroupSections(
  props: TimelineFilterPanelProps,
  totalFilterSlots: number,
  filterDropdownTriggerRefs: FilterDropdownTriggerRefs,
  filterDropdownStyle: React.CSSProperties | null
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let nextFilterIndex = 0;

  props.timelineFilterGroups.forEach((group, groupIndex) => {
    if (groupIndex > 0) {
      nodes.push(
        React.createElement(
          "span",
          {
            key: `timeline-filter-group-or-${group.groupId}`,
            className: "timeline-filter-joiner timeline-filter-joiner-or"
          },
          "OR"
        )
      );
    }

    nodes.push(
      React.createElement(TimelineFilterGroupSection, {
        key: `timeline-filter-group-${group.groupId}`,
        group,
        groupIndex,
        firstFilterIndex: nextFilterIndex,
        showRemoveGroup: props.timelineFilterGroups.length > 1,
        totalFilterSlots,
        maxFilterSlots: props.maxFilterSlots,
        filterDropdownTriggerRefs,
        filterDropdownStyle,
        openFilterDropdown: props.openFilterDropdown,
        openFilterFieldOptions: props.openFilterFieldOptions,
        openFilterValueOptions: props.openFilterValueOptions,
        getFieldDisplayName: props.getFieldDisplayName,
        onSetOpenFilterDropdown: props.onSetOpenFilterDropdown,
        onSetFilterFieldSearchDraft: props.onSetFilterFieldSearchDraft,
        onSetFilterValueSearchDraft: props.onSetFilterValueSearchDraft,
        filterFieldSearchDraft: props.filterFieldSearchDraft,
        filterValueSearchDraft: props.filterValueSearchDraft,
        onApplyFieldFilterSelection: props.onApplyFieldFilterSelection,
        onToggleTimelineFieldValueSelection: props.onToggleTimelineFieldValueSelection,
        onToggleVisibleTimelineFieldValueSelections: props.onToggleVisibleTimelineFieldValueSelections,
        onUpdateTimelineDateRangeFilter: props.onUpdateTimelineDateRangeFilter,
        onRemoveTimelineFilterSlot: props.onRemoveTimelineFilterSlot,
        onRemoveTimelineFilterGroup: props.onRemoveTimelineFilterGroup,
        onAddTimelineFilterCondition: props.onAddTimelineFilterCondition
      })
    );
    nextFilterIndex += group.filters.length;
  });

  return nodes;
}

type TimelineFilterGroupSectionProps = Pick<
  TimelineFilterPanelProps,
  | "maxFilterSlots"
  | "openFilterDropdown"
  | "openFilterFieldOptions"
  | "openFilterValueOptions"
  | "getFieldDisplayName"
  | "onSetOpenFilterDropdown"
  | "onSetFilterFieldSearchDraft"
  | "onSetFilterValueSearchDraft"
  | "filterFieldSearchDraft"
  | "filterValueSearchDraft"
  | "onApplyFieldFilterSelection"
  | "onToggleTimelineFieldValueSelection"
  | "onToggleVisibleTimelineFieldValueSelections"
  | "onUpdateTimelineDateRangeFilter"
  | "onRemoveTimelineFilterSlot"
  | "onRemoveTimelineFilterGroup"
  | "onAddTimelineFilterCondition"
> & {
  group: TimelineFilterGroup;
  groupIndex: number;
  firstFilterIndex: number;
  showRemoveGroup: boolean;
  totalFilterSlots: number;
  filterDropdownTriggerRefs: FilterDropdownTriggerRefs;
  filterDropdownStyle: React.CSSProperties | null;
};

function TimelineFilterGroupSection(props: TimelineFilterGroupSectionProps): React.ReactElement {
  const conditionNodes: React.ReactNode[] = [];

  props.group.filters.forEach((filter, conditionIndex) => {
    if (conditionIndex > 0) {
      conditionNodes.push(
        React.createElement(
          "span",
          {
            key: `timeline-filter-group-${props.group.groupId}-and-${filter.slotId}`,
            className: "timeline-filter-joiner timeline-filter-joiner-and"
          },
          "AND"
        )
      );
    }

    conditionNodes.push(
      React.createElement(TimelineFilterRow, {
        key: `timeline-filter-slot-${filter.slotId}`,
        filter,
        filterIndex: props.firstFilterIndex + conditionIndex,
        totalFilterSlots: props.totalFilterSlots,
        filterDropdownTriggerRefs: props.filterDropdownTriggerRefs,
        filterDropdownStyle: props.filterDropdownStyle,
        openFilterDropdown: props.openFilterDropdown,
        openFilterFieldOptions: props.openFilterFieldOptions,
        openFilterValueOptions: props.openFilterValueOptions,
        getFieldDisplayName: props.getFieldDisplayName,
        onSetOpenFilterDropdown: props.onSetOpenFilterDropdown,
        onSetFilterFieldSearchDraft: props.onSetFilterFieldSearchDraft,
        onSetFilterValueSearchDraft: props.onSetFilterValueSearchDraft,
        filterFieldSearchDraft: props.filterFieldSearchDraft,
        filterValueSearchDraft: props.filterValueSearchDraft,
        onApplyFieldFilterSelection: props.onApplyFieldFilterSelection,
        onToggleTimelineFieldValueSelection: props.onToggleTimelineFieldValueSelection,
        onToggleVisibleTimelineFieldValueSelections: props.onToggleVisibleTimelineFieldValueSelections,
        onUpdateTimelineDateRangeFilter: props.onUpdateTimelineDateRangeFilter,
        onRemoveTimelineFilterSlot: props.onRemoveTimelineFilterSlot
      })
    );
  });

  conditionNodes.push(
    React.createElement(
      "button",
      {
        key: `timeline-filter-group-${props.group.groupId}-add-condition`,
        type: "button",
        className: "timeline-filter-add timeline-filter-add-condition",
        "aria-label":
          props.groupIndex === 0 ? "Add timeline filter" : `Add condition to filter group ${props.groupIndex + 1}`,
        disabled: props.totalFilterSlots >= props.maxFilterSlots,
        onClick: () => {
          props.onAddTimelineFilterCondition(props.group.groupId);
        }
      },
      "+ Condition"
    )
  );

  if (props.showRemoveGroup) {
    conditionNodes.push(
      React.createElement(
        "button",
        {
          key: `timeline-filter-group-${props.group.groupId}-remove`,
          type: "button",
          className: "timeline-filter-row-clear timeline-filter-group-remove",
          "aria-label": `Remove filter group ${props.groupIndex + 1}`,
          onClick: () => {
            props.onRemoveTimelineFilterGroup(props.group.groupId);
          }
        },
        "Remove group"
      )
    );
  }

  return React.createElement(
    "div",
    {
      className: "timeline-filter-group",
      role: "group",
      "aria-label": `Timeline filter group ${props.groupIndex + 1}`
    },
    ...conditionNodes
  );
}

type TimelineFilterRowProps = Pick<
  TimelineFilterPanelProps,
  | "openFilterDropdown"
  | "openFilterFieldOptions"
  | "openFilterValueOptions"
  | "getFieldDisplayName"
  | "onSetOpenFilterDropdown"
  | "onSetFilterFieldSearchDraft"
  | "onSetFilterValueSearchDraft"
  | "filterFieldSearchDraft"
  | "filterValueSearchDraft"
  | "onApplyFieldFilterSelection"
  | "onToggleTimelineFieldValueSelection"
  | "onToggleVisibleTimelineFieldValueSelections"
  | "onUpdateTimelineDateRangeFilter"
  | "onRemoveTimelineFilterSlot"
> & {
  filter: TimelineFilterPanelFilter;
  filterIndex: number;
  totalFilterSlots: number;
  filterDropdownTriggerRefs: FilterDropdownTriggerRefs;
  filterDropdownStyle: React.CSSProperties | null;
};

function TimelineFilterRow(props: TimelineFilterRowProps): React.ReactElement {
  const { filter, filterIndex } = props;
  const selectedFieldDisplay = filter.fieldRef ? props.getFieldDisplayName(filter.fieldRef) : `Filter ${filterIndex + 1}`;
  const isDateFilter = isTimelineDateRangeFilter(filter);
  const dateRange = isTimelineDateRangeFilter(filter) ? filter.dateRange : EMPTY_TIMELINE_DATE_RANGE;
  const selectedValueKeys = filter.kind === "value" ? filter.selectedValueKeys : [];
  const valueLabel =
    !filter.fieldRef
      ? "All values"
      : isDateFilter
        ? formatTimelineDateRangeFilterLabel(dateRange)
        : selectedValueKeys.length > 0
          ? `${selectedValueKeys.length} selected`
          : "All values";
  const isFieldDropdownOpen = props.openFilterDropdown?.kind === "field" && props.openFilterDropdown.slotId === filter.slotId;
  const isValueDropdownOpen = props.openFilterDropdown?.kind === "value" && props.openFilterDropdown.slotId === filter.slotId;
  const filterValueOptions =
    isValueDropdownOpen && props.openFilterDropdown?.slotId === filter.slotId ? props.openFilterValueOptions : [];
  const visibleValueKeys = filterValueOptions.map((entry) => entry.key);
  const hasVisibleValueOptions = visibleValueKeys.length > 0;
  const areAllVisibleValuesSelected =
    !isDateFilter && hasVisibleValueOptions && visibleValueKeys.every((key) => selectedValueKeys.includes(key));

  const valueControlState: TimelineFilterValueControlState = {
    isValueDropdownOpen,
    isDateFilter,
    dateRange,
    selectedValueKeys,
    valueLabel,
    filterValueOptions,
    visibleValueKeys,
    hasVisibleValueOptions,
    areAllVisibleValuesSelected
  };

  return React.createElement(
    "div",
    {
      className:
        isFieldDropdownOpen || isValueDropdownOpen
          ? "timeline-filter-row timeline-filter-row-open timeline-control-cluster"
          : "timeline-filter-row timeline-control-cluster"
    },
    renderTimelineFilterFieldControl(props, selectedFieldDisplay, isFieldDropdownOpen),
    renderTimelineFilterValueControl(props, valueControlState),
    renderTimelineFilterRemoveButton(props)
  );
}

type TimelineFilterValueControlState = {
  isValueDropdownOpen: boolean;
  isDateFilter: boolean;
  dateRange: TimelineDateRange;
  selectedValueKeys: string[];
  valueLabel: string;
  filterValueOptions: ValueStatOption[];
  visibleValueKeys: string[];
  hasVisibleValueOptions: boolean;
  areAllVisibleValuesSelected: boolean;
};

function renderTimelineFilterFieldControl(
  props: TimelineFilterRowProps,
  selectedFieldDisplay: string,
  isFieldDropdownOpen: boolean
): React.ReactElement {
  return React.createElement(
    "div",
    { className: "timeline-filter-dropdown-anchor" },
    renderTimelineFilterFieldTrigger(props, selectedFieldDisplay, isFieldDropdownOpen),
    isFieldDropdownOpen ? renderTimelineFilterFieldDropdown(props) : null
  );
}

function renderTimelineFilterFieldTrigger(
  props: TimelineFilterRowProps,
  selectedFieldDisplay: string,
  isFieldDropdownOpen: boolean
): React.ReactElement {
  const { filter, filterIndex } = props;

  return React.createElement(
    "button",
    {
      type: "button",
      className: "timeline-color-coding-select timeline-color-coding-select-trigger",
      ref: (element) => {
        props.filterDropdownTriggerRefs.current[`${filter.slotId}-field`] = element as HTMLButtonElement | null;
      },
      "aria-label": `Select filter field ${filterIndex + 1}`,
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
  );
}

function renderTimelineFilterFieldDropdown(props: TimelineFilterRowProps): React.ReactPortal {
  const { filter, filterIndex } = props;

  return createPortal(
    React.createElement(
      "div",
      {
        className: "timeline-color-coding-dropdown",
        "data-timeline-filter-overlay": "true",
        style: props.filterDropdownStyle ?? undefined,
        role: "listbox",
        "aria-label": `Filter field options ${filterIndex + 1}`
      },
      React.createElement("input", {
        type: "search",
        className: "timeline-color-coding-dropdown-search",
        "aria-label": `Search filter fields ${filterIndex + 1}`,
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
                React.createElement(
                  "span",
                  { className: "timeline-color-coding-option-label" },
                  props.getFieldDisplayName(fieldRef)
                ),
                React.createElement("span", { className: "timeline-color-coding-option-subtitle" }, fieldRef)
              )
            )
      )
    ),
    document.body
  );
}

function renderTimelineFilterValueControl(
  props: TimelineFilterRowProps,
  state: TimelineFilterValueControlState
): React.ReactElement {
  return React.createElement(
    "div",
    { className: "timeline-filter-dropdown-anchor" },
    renderTimelineFilterValueTrigger(props, state),
    state.isValueDropdownOpen ? renderTimelineFilterValueDropdown(props, state) : null
  );
}

function renderTimelineFilterValueTrigger(
  props: TimelineFilterRowProps,
  state: TimelineFilterValueControlState
): React.ReactElement {
  const { filter, filterIndex } = props;

  return React.createElement(
    "button",
    {
      type: "button",
      className: "timeline-color-coding-select timeline-color-coding-select-trigger",
      ref: (element) => {
        props.filterDropdownTriggerRefs.current[`${filter.slotId}-value`] = element as HTMLButtonElement | null;
      },
      "aria-label": `Select filter values ${filterIndex + 1}`,
      "aria-haspopup": "listbox",
      "aria-expanded": state.isValueDropdownOpen ? "true" : "false",
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
    state.valueLabel
  );
}

function renderTimelineFilterValueDropdown(
  props: TimelineFilterRowProps,
  state: TimelineFilterValueControlState
): React.ReactPortal {
  return createPortal(
    state.isDateFilter
      ? renderTimelineFilterDateDropdown(props, state.dateRange)
      : renderTimelineFilterValueMultiSelectDropdown(props, state),
    document.body
  );
}

function renderTimelineFilterDateDropdown(
  props: TimelineFilterRowProps,
  dateRange: TimelineDateRange
): React.ReactElement {
  const { filter, filterIndex } = props;

  return React.createElement(
    "div",
    {
      className: "timeline-color-coding-dropdown timeline-filter-date-dropdown",
      "data-timeline-filter-overlay": "true",
      style: props.filterDropdownStyle ?? undefined,
      role: "group",
      "aria-label": `Filter value options ${filterIndex + 1}`
    },
    React.createElement(
      "div",
      { className: "timeline-filter-date-range" },
      React.createElement("input", {
        type: "datetime-local",
        className: "timeline-details-input timeline-filter-date-input",
        "aria-label": `Filter ${filterIndex + 1} date range start`,
        value: toTimelineDateTimeLocalInputValue(dateRange.startIso),
        onChange: (event) => {
          props.onUpdateTimelineDateRangeFilter(filter.slotId, {
            ...dateRange,
            startIso: fromTimelineDateTimeLocalInputValue((event.target as HTMLInputElement).value)
          });
        }
      }),
      React.createElement("input", {
        type: "datetime-local",
        className: "timeline-details-input timeline-filter-date-input",
        "aria-label": `Filter ${filterIndex + 1} date range end`,
        value: toTimelineDateTimeLocalInputValue(dateRange.endIso),
        onChange: (event) => {
          props.onUpdateTimelineDateRangeFilter(filter.slotId, {
            ...dateRange,
            endIso: fromTimelineDateTimeLocalInputValue((event.target as HTMLInputElement).value)
          });
        }
      }),
      dateRange.startIso || dateRange.endIso
        ? React.createElement(
            "button",
            {
              type: "button",
              className: "timeline-filter-date-clear",
              onClick: () => {
                props.onUpdateTimelineDateRangeFilter(filter.slotId, EMPTY_TIMELINE_DATE_RANGE);
              }
            },
            "Clear"
          )
        : null
    ),
    isTimelineDateRangeInvalid(dateRange)
      ? React.createElement(
          "p",
          { className: "timeline-filter-date-note", role: "status" },
          "Start must be before end."
        )
      : null
  );
}

function renderTimelineFilterValueMultiSelectDropdown(
  props: TimelineFilterRowProps,
  state: TimelineFilterValueControlState
): React.ReactElement {
  const { filter, filterIndex } = props;

  return React.createElement(
    "div",
    {
      className: "timeline-color-coding-dropdown",
      "data-timeline-filter-overlay": "true",
      style: props.filterDropdownStyle ?? undefined,
      role: "listbox",
      "aria-label": `Filter value options ${filterIndex + 1}`
    },
    React.createElement(
      "div",
      { className: "timeline-filter-value-search-row" },
      React.createElement(
        "button",
        {
          type: "button",
          className: state.areAllVisibleValuesSelected
            ? "timeline-filter-bulk-toggle timeline-filter-bulk-toggle-active"
            : "timeline-filter-bulk-toggle",
          "aria-label": state.areAllVisibleValuesSelected
            ? `Deselect all visible filter values ${filterIndex + 1}`
            : `Select all visible filter values ${filterIndex + 1}`,
          title: state.areAllVisibleValuesSelected
            ? "Deselect all currently filtered values"
            : "Select all currently filtered values",
          disabled: !state.hasVisibleValueOptions,
          onClick: () => {
            props.onToggleVisibleTimelineFieldValueSelections(filter.slotId, state.visibleValueKeys);
          }
        },
        React.createElement(
          "svg",
          {
            viewBox: "0 0 24 24",
            className: "timeline-label-toggle-icon",
            "aria-hidden": "true"
          },
          React.createElement("path", {
            d: "M9.55 17.45 4.8 12.7l1.4-1.4 3.35 3.35 8.25-8.25 1.4 1.4-9.65 9.65Z"
          })
        )
      ),
      React.createElement("input", {
        type: "search",
        className: "timeline-color-coding-dropdown-search",
        "aria-label": `Search filter values ${filterIndex + 1}`,
        placeholder: "Search value",
        value: props.filterValueSearchDraft,
        onChange: (event) => {
          props.onSetFilterValueSearchDraft((event.target as HTMLInputElement).value);
        }
      })
    ),
    React.createElement(
      "div",
      { className: "timeline-color-coding-dropdown-options" },
      state.filterValueOptions.length === 0
        ? React.createElement("p", { className: "timeline-details-muted" }, "No matching value.")
        : state.filterValueOptions.map((entry) =>
            React.createElement(
              "label",
              {
                key: `${filter.slotId}-value-${entry.key}`,
                className: "timeline-filter-value-option"
              },
              React.createElement("input", {
                type: "checkbox",
                checked: state.selectedValueKeys.includes(entry.key),
                "aria-label": `Include ${entry.label} in filter ${filterIndex + 1}`,
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
  );
}

function renderTimelineFilterRemoveButton(props: TimelineFilterRowProps): React.ReactElement {
  const { filter, filterIndex } = props;

  return React.createElement(
    "button",
    {
      type: "button",
      className: "timeline-filter-row-clear",
      "aria-label": props.totalFilterSlots > 1 ? `Remove filter ${filterIndex + 1}` : `Clear filter ${filterIndex + 1}`,
      onClick: () => {
        props.onRemoveTimelineFilterSlot(filter.slotId);
      }
    },
    props.totalFilterSlots > 1 ? "Remove" : "Clear"
  );
}
