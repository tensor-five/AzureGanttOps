import React from "react";

export type TimelinePrintHeaderProps = {
  queryName: string | null;
  queryUrl: string | null;
  workItemCount: number;
  printedAt: Date;
  isPrintMode: boolean;
};

export function TimelinePrintHeader(props: TimelinePrintHeaderProps): React.ReactElement {
  const trimmedName = props.queryName?.trim() ?? "";
  const titleText = trimmedName.length > 0 ? `AzureGanttOps – ${trimmedName}` : "AzureGanttOps";

  return React.createElement(
    "div",
    { className: "timeline-print-header", "aria-hidden": !props.isPrintMode },
    React.createElement(
      "div",
      { className: "timeline-print-header-title-block" },
      React.createElement("span", { className: "timeline-print-header-title" }, titleText),
      props.queryUrl ? renderQueryLinkIcon(props.queryUrl) : null
    ),
    React.createElement(
      "div",
      { className: "timeline-print-header-meta" },
      `${props.workItemCount} work items · ${formatPrintTimestamp(props.printedAt)}`
    )
  );
}

function renderQueryLinkIcon(href: string): React.ReactElement {
  return React.createElement(
    "a",
    {
      className: "timeline-print-header-link",
      href,
      target: "_blank",
      rel: "noopener noreferrer",
      "aria-label": "Open query in Azure DevOps",
      title: "Open query in Azure DevOps"
    },
    React.createElement(
      "svg",
      {
        viewBox: "0 0 24 24",
        className: "timeline-print-header-link-icon",
        "aria-hidden": "true"
      },
      React.createElement("path", {
        d: "M14 3h7v7M21 3l-9 9M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeLinejoin: "round"
      })
    )
  );
}

export function formatPrintTimestamp(when: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  const year = when.getFullYear();
  const month = pad(when.getMonth() + 1);
  const day = pad(when.getDate());
  const hours = pad(when.getHours());
  const minutes = pad(when.getMinutes());
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
