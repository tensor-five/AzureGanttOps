import React from "react";

import type { TimelineSidebarRowJustify } from "./timeline-sidebar-row-justify-preference.js";
import type { TimelineTreeLevelSummary } from "./timeline-tree-levels.js";

export type TimelineLeftSidebarHeaderProps = {
  heightPx: number;
  rowJustify: TimelineSidebarRowJustify;
  treeLevels: readonly TimelineTreeLevelSummary[];
  onToggleTreeLevel: (depth: number) => void;
  onToggleRowJustify: () => void;
};

export function TimelineLeftSidebarHeader(props: TimelineLeftSidebarHeaderProps): React.ReactElement {
  return React.createElement(
    "div",
    {
      className: "timeline-left-sidebar-header",
      style: { height: `${props.heightPx}px` }
    },
    props.treeLevels.length > 0
      ? React.createElement(
          "div",
          {
            className: "timeline-tree-level-controls",
            role: "group",
            "aria-label": "Timeline tree levels"
          },
          React.createElement(
            "div",
            {
              className: "timeline-tree-level-list"
            },
            props.treeLevels.map((level) => buildTreeLevelControl(level, props.onToggleTreeLevel))
          )
        )
      : null,
    React.createElement(
      "button",
      {
        type: "button",
        className: "timeline-left-sidebar-align-toggle",
        "aria-label": "Toggle timeline sidebar row alignment",
        title: props.rowJustify === "flex-end" ? "Align sidebar rows left" : "Align sidebar rows right",
        "aria-pressed": props.rowJustify === "flex-end",
        onClick: props.onToggleRowJustify
      },
      React.createElement(
        "svg",
        {
          viewBox: "0 0 24 24",
          className: "timeline-left-sidebar-align-icon",
          "aria-hidden": "true"
        },
        props.rowJustify === "flex-end"
          ? [
              React.createElement("line", { key: "top", x1: "7", y1: "7", x2: "17", y2: "7" }),
              React.createElement("line", { key: "middle", x1: "5", y1: "12", x2: "17", y2: "12" }),
              React.createElement("line", { key: "bottom", x1: "9", y1: "17", x2: "17", y2: "17" })
            ]
          : [
              React.createElement("line", { key: "top", x1: "7", y1: "7", x2: "17", y2: "7" }),
              React.createElement("line", { key: "middle", x1: "7", y1: "12", x2: "19", y2: "12" }),
              React.createElement("line", { key: "bottom", x1: "7", y1: "17", x2: "15", y2: "17" })
            ]
      )
    )
  );
}

function buildTreeLevelControl(
  level: TimelineTreeLevelSummary,
  onToggleTreeLevel: (depth: number) => void
): React.ReactElement {
  const label = level.depth + 1;

  return React.createElement(
    "button",
    {
      key: level.depth,
      type: "button",
      className: "timeline-tree-level-control",
      disabled: level.disabled,
      "aria-label": buildTreeLevelControlAriaLabel(level),
      "aria-pressed": buildTreeLevelAriaPressed(level),
      title: buildTreeLevelControlTitle(level),
      "data-state": level.state,
      onClick: level.disabled ? undefined : () => onToggleTreeLevel(level.depth)
    },
    React.createElement("span", {
      className: "timeline-tree-level-state-icon",
      "aria-hidden": "true"
    }),
    React.createElement(
      "span",
      {
        className: "timeline-tree-level-label"
      },
      `L${label}`
    )
  );
}

function buildTreeLevelControlAriaLabel(level: TimelineTreeLevelSummary): string {
  const label = level.depth + 1;
  const itemCountLabel = formatTreeLevelItemCount(level.itemCount);
  if (level.disabled) {
    return `Timeline tree level ${label}: ${itemCountLabel}, no collapsible items`;
  }

  const action = level.state === "collapsed" ? "Expand" : "Collapse";
  return `${action} timeline tree level ${label}: ${itemCountLabel}, ${level.collapsedCount} of ${level.collapsibleCount} collapsible items collapsed`;
}

function buildTreeLevelAriaPressed(level: TimelineTreeLevelSummary): "true" | "false" | "mixed" | undefined {
  if (level.disabled) {
    return undefined;
  }

  return level.state === "mixed" ? "mixed" : level.state === "collapsed" ? "true" : "false";
}

function buildTreeLevelControlTitle(level: TimelineTreeLevelSummary): string {
  const label = level.depth + 1;
  const itemCountLabel = formatTreeLevelItemCount(level.itemCount);
  if (level.disabled) {
    return `Level ${label}: ${itemCountLabel}, no collapsible items`;
  }

  const action = level.state === "collapsed" ? "Expand" : "Collapse";
  return `${action} level ${label}: ${itemCountLabel}, ${level.collapsedCount}/${level.collapsibleCount} collapsed`;
}

function formatTreeLevelItemCount(itemCount: number): string {
  return `${itemCount} ${itemCount === 1 ? "item" : "items"}`;
}
