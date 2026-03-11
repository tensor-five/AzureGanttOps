import React from "react";

import type { TimelineColorCoding, TimelineFieldColorCodingConfig } from "./timeline-color-coding-preference.js";
import type { DependencyViewMode } from "./use-dependency-editing.js";
import type { OpenFilterDropdownState } from "./use-timeline-filters.js";
import { TimelineLabelSettingsPanel } from "./timeline-label-settings-panel.js";

type ColorCodingOption = {
  key: string;
  mode: TimelineColorCoding;
  fieldRef: string | null;
  label: string;
  subtitle?: string;
  searchText: string;
};

type TimelineLabelFieldOption = {
  fieldRef: string;
  label: string;
  subtitle: string;
};

export type TimelinePaneActionsToolbarProps = {
  isRefreshing: boolean;
  onRetryRefresh: () => void;
  zoomLevel: "week" | "month";
  onSelectWeekZoom: () => void;
  onSelectMonthZoom: () => void;
  dependencyViewMode: DependencyViewMode;
  dependencyModeOptions: ReadonlyArray<{ value: DependencyViewMode; label: string }>;
  onChangeDependencyMode: (mode: DependencyViewMode) => void;
  colorCodingControlRef: React.RefObject<HTMLDivElement | null>;
  selectedColorCodingLabel: string;
  colorCodingDropdownOpen: boolean;
  colorCodingSearchDraft: string;
  filteredColorCodingOptions: ColorCodingOption[];
  colorCoding: TimelineColorCoding;
  fieldColorCoding: TimelineFieldColorCodingConfig;
  onToggleColorCodingDropdown: () => void;
  onChangeColorCodingSearchDraft: (value: string) => void;
  onApplyFirstFilteredColorCodingOption: () => boolean;
  onSelectColorCodingOption: (option: ColorCodingOption) => void;
  onOpenColorSettings: () => void;
  filterToggleControlRef: React.RefObject<HTMLDivElement | null>;
  timelineFiltersOpen: boolean;
  activeTimelineFiltersCount: number;
  onToggleTimelineFilters: () => void;
  sortControl: React.ReactElement;
  labelToggleControlRef: React.RefObject<HTMLDivElement | null>;
  labelSettingsOpen: boolean;
  timelineLabelFields: string[];
  timelineSidebarFields: string[];
  labelPanelRef: React.RefObject<HTMLDivElement | null>;
  labelMenuSidebarOptionsRef: React.RefObject<HTMLDivElement | null>;
  labelMenuBarOptionsRef: React.RefObject<HTMLDivElement | null>;
  sidebarFieldSearchDraft: string;
  labelFieldSearchDraft: string;
  filteredTimelineSidebarFieldOptions: TimelineLabelFieldOption[];
  filteredTimelineLabelFieldOptions: TimelineLabelFieldOption[];
  onToggleLabelSettings: () => void;
  onChangeSidebarFieldSearchDraft: (value: string) => void;
  onChangeLabelFieldSearchDraft: (value: string) => void;
  onClearTimelineSidebarFields: () => void;
  onClearTimelineLabelFields: () => void;
  onSyncLabelMenuScrollFromSidebar: () => void;
  onSyncLabelMenuScrollFromBar: () => void;
  onToggleTimelineSidebarField: (fieldRef: string) => void;
  onToggleTimelineLabelField: (fieldRef: string) => void;
  workItemSyncState: "up_to_date" | "syncing" | "error";
  workItemSyncError: string | null;
};

export function TimelinePaneActionsToolbar(props: TimelinePaneActionsToolbarProps): React.ReactElement {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "div",
      {
        className: "timeline-pane-actions"
      },
      React.createElement(
        "div",
        { className: "timeline-pane-actions-group" },
        React.createElement(
          "button",
          {
            type: "button",
            className: "timeline-action-button timeline-action-button-primary",
            disabled: props.isRefreshing,
            "aria-busy": props.isRefreshing ? "true" : undefined,
            onClick: props.onRetryRefresh
          },
          props.isRefreshing
            ? React.createElement(
                "span",
                { className: "timeline-action-button-content" },
                React.createElement("span", {
                  className: "timeline-action-button-spinner",
                  "aria-hidden": "true"
                }),
                React.createElement("span", null, "Updating...")
              )
            : "Refresh"
        ),
        React.createElement(
          "div",
          {
            className:
              "timeline-density-controls timeline-density-controls-harmonized timeline-density-controls-zoom timeline-control-cluster",
            role: "group",
            "aria-label": "Timeline zoom"
          },
          React.createElement(
            "button",
            {
              type: "button",
              className:
                props.zoomLevel === "week"
                  ? "timeline-density-button timeline-density-button-active"
                  : "timeline-density-button",
              "aria-pressed": props.zoomLevel === "week",
              "aria-label": "Zoom in to week view",
              onClick: props.onSelectWeekZoom
            },
            "Week"
          ),
          React.createElement(
            "button",
            {
              type: "button",
              className:
                props.zoomLevel === "month"
                  ? "timeline-density-button timeline-density-button-active"
                  : "timeline-density-button",
              "aria-pressed": props.zoomLevel === "month",
              "aria-label": "Zoom out to month view",
              onClick: props.onSelectMonthZoom
            },
            "Month"
          )
        ),
        React.createElement(
          "div",
          {
            className: "timeline-dependency-control timeline-control-cluster"
          },
          React.createElement("span", { className: "timeline-dependency-label" }, "Dependencies"),
          React.createElement(
            "select",
            {
              className: "timeline-dependency-select",
              "aria-label": "Dependency mode",
              value: props.dependencyViewMode,
              onChange: (event) => {
                props.onChangeDependencyMode((event.target as HTMLSelectElement).value as DependencyViewMode);
              }
            },
            props.dependencyModeOptions.map((option) =>
              React.createElement("option", { key: option.value, value: option.value }, option.label)
            )
          )
        ),
        React.createElement(
          "div",
          { className: "timeline-color-coding-control timeline-control-cluster", ref: props.colorCodingControlRef },
          React.createElement("span", { className: "timeline-color-coding-label" }, "Color coding"),
          React.createElement(
            "button",
            {
              type: "button",
              className: "timeline-color-coding-select timeline-color-coding-select-trigger",
              "aria-label": "Color coding",
              title: "Choose how timeline bars are color-coded.",
              "aria-haspopup": "listbox",
              "aria-expanded": props.colorCodingDropdownOpen ? "true" : "false",
              onClick: props.onToggleColorCodingDropdown
            },
            props.selectedColorCodingLabel
          ),
          props.colorCodingDropdownOpen
            ? React.createElement(
                "div",
                { className: "timeline-color-coding-dropdown", role: "listbox", "aria-label": "Color coding options" },
                React.createElement("input", {
                  type: "search",
                  className: "timeline-color-coding-dropdown-search",
                  "aria-label": "Search color coding",
                  placeholder: "Search mode or field",
                  value: props.colorCodingSearchDraft,
                  onChange: (event) => {
                    props.onChangeColorCodingSearchDraft((event.target as HTMLInputElement).value);
                  },
                  onKeyDown: (event) => {
                    if (event.key !== "Enter") {
                      return;
                    }

                    event.preventDefault();
                    props.onApplyFirstFilteredColorCodingOption();
                  }
                }),
                React.createElement(
                  "div",
                  { className: "timeline-color-coding-dropdown-options" },
                  props.filteredColorCodingOptions.length === 0
                    ? React.createElement("p", { className: "timeline-details-muted" }, "No matching option.")
                    : props.filteredColorCodingOptions.map((option) =>
                        React.createElement(
                          "button",
                          {
                            key: option.key,
                            type: "button",
                            className:
                              option.mode === props.colorCoding &&
                              ((option.mode !== "field" && props.colorCoding !== "field") ||
                                option.fieldRef === props.fieldColorCoding.fieldRef)
                                ? "timeline-color-coding-option timeline-color-coding-option-active"
                                : "timeline-color-coding-option",
                            onClick: () => {
                              props.onSelectColorCodingOption(option);
                            }
                          },
                          React.createElement("span", { className: "timeline-color-coding-option-label" }, option.label),
                          option.subtitle
                            ? React.createElement("span", { className: "timeline-color-coding-option-subtitle" }, option.subtitle)
                            : null
                        )
                      )
                )
              )
            : null,
          React.createElement(
            "button",
            {
              type: "button",
              className: "timeline-color-coding-settings-button",
              "aria-label": "Open color coding settings",
              title: "Open color-coding settings and set colors per value.",
              onClick: props.onOpenColorSettings
            },
            "Settings"
          )
        ),
        React.createElement(
          "div",
          { className: "timeline-filter-control", ref: props.filterToggleControlRef },
          React.createElement(
            "button",
            {
              type: "button",
              className: props.timelineFiltersOpen ? "timeline-filter-toggle timeline-filter-toggle-active" : "timeline-filter-toggle",
              "aria-label": "Toggle timeline filters",
              title: "Filter timeline rows by field values.",
              "aria-expanded": props.timelineFiltersOpen ? "true" : "false",
              "aria-haspopup": "dialog",
              onClick: props.onToggleTimelineFilters
            },
            React.createElement(
              "svg",
              {
                viewBox: "0 0 24 24",
                className: "timeline-filter-toggle-icon",
                "aria-hidden": "true"
              },
              React.createElement("path", {
                d: "M3 5h18l-7 8v5l-4 2v-7L3 5z"
              })
            ),
            props.activeTimelineFiltersCount > 0
              ? React.createElement("span", { className: "timeline-filter-toggle-count" }, props.activeTimelineFiltersCount)
              : null
          )
        ),
        props.sortControl,
        React.createElement(
          "div",
          { className: "timeline-label-control", ref: props.labelToggleControlRef },
          React.createElement(
            "button",
            {
              type: "button",
              className: props.labelSettingsOpen ? "timeline-label-toggle timeline-label-toggle-active" : "timeline-label-toggle",
              "aria-label": "Toggle timeline label fields",
              title: "Select which fields are shown in sidebar and bar labels.",
              "aria-expanded": props.labelSettingsOpen ? "true" : "false",
              "aria-haspopup": "dialog",
              onClick: props.onToggleLabelSettings
            },
            React.createElement(
              "svg",
              {
                viewBox: "0 0 24 24",
                className: "timeline-label-toggle-icon",
                "aria-hidden": "true"
              },
              React.createElement("path", {
                d: "M3 8.25A2.25 2.25 0 0 1 5.25 6h6.69c.6 0 1.17.24 1.59.66l6.8 6.8a2.25 2.25 0 0 1 0 3.18l-3.69 3.69a2.25 2.25 0 0 1-3.18 0l-6.8-6.8A2.25 2.25 0 0 1 6 11.94V8.25Zm4.5.75a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"
              })
            ),
            React.createElement(
              "span",
              { className: "timeline-label-toggle-count" },
              `${props.timelineLabelFields.length}/${props.timelineSidebarFields.length}`
            )
          ),
          React.createElement(TimelineLabelSettingsPanel, {
            open: props.labelSettingsOpen,
            panelRef: props.labelPanelRef,
            sidebarFieldSearchDraft: props.sidebarFieldSearchDraft,
            labelFieldSearchDraft: props.labelFieldSearchDraft,
            filteredTimelineSidebarFieldOptions: props.filteredTimelineSidebarFieldOptions,
            filteredTimelineLabelFieldOptions: props.filteredTimelineLabelFieldOptions,
            timelineSidebarFields: props.timelineSidebarFields,
            timelineLabelFields: props.timelineLabelFields,
            labelMenuSidebarOptionsRef: props.labelMenuSidebarOptionsRef,
            labelMenuBarOptionsRef: props.labelMenuBarOptionsRef,
            onChangeSidebarFieldSearchDraft: props.onChangeSidebarFieldSearchDraft,
            onChangeLabelFieldSearchDraft: props.onChangeLabelFieldSearchDraft,
            onClearTimelineSidebarFields: props.onClearTimelineSidebarFields,
            onClearTimelineLabelFields: props.onClearTimelineLabelFields,
            onSyncLabelMenuScrollFromSidebar: props.onSyncLabelMenuScrollFromSidebar,
            onSyncLabelMenuScrollFromBar: props.onSyncLabelMenuScrollFromBar,
            onToggleTimelineSidebarField: props.onToggleTimelineSidebarField,
            onToggleTimelineLabelField: props.onToggleTimelineLabelField
          })
        )
      ),
      React.createElement(
        "div",
        { className: "timeline-pane-actions-status" },
        React.createElement(
          "div",
          {
            className: "gantt-sync-status",
            "data-state": props.workItemSyncState,
            role: "status",
            "aria-live": "polite",
            title: props.workItemSyncState === "error" ? props.workItemSyncError ?? undefined : undefined
          },
          React.createElement("span", { className: "gantt-sync-status-dot", "aria-hidden": "true" }),
          React.createElement(
            "span",
            null,
            props.workItemSyncState === "syncing"
              ? "Updating work items..."
              : props.workItemSyncState === "error"
                ? "Work item update failed"
                : "Work items up to date"
          )
        )
      )
    )
  );
}
