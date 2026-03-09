import React from "react";

export type DiagnosticsTabModel = {
  statusCode: string;
  errorCode: string | null;
  guidance: string | null;
  sourceHealth:
    | "HEALTHY"
    | "AUTH_EXPIRED_REAUTH_TRIGGERED"
    | "AUTH_WARNING"
    | "REFRESH_FAILED_LKG_ACTIVE"
    | "REFRESH_FAILED_NO_LKG";
  activeQueryId: string | null;
  lastRefreshAt: string | null;
  reloadSource: "full_reload" | "preflight_blocked" | "stale_discarded" | null;
  onRetryRefresh?: () => void;
};

export function DiagnosticsTab(props: DiagnosticsTabModel): React.ReactElement {
  const lines = buildDiagnosticsTabLines(props).slice(1);
  const rows = lines.map((line, index) =>
    React.createElement(
      "li",
      { key: `${index}-${line}`, className: "diagnostics-row" },
      line.replace(/^- /, "")
    )
  );

  return React.createElement(
    "section",
    {
      "aria-label": "diagnostics-tab",
      className: "diagnostics-card"
    },
    React.createElement("h3", { className: "diagnostics-title" }, "Diagnostics"),
    React.createElement("ul", { className: "diagnostics-list" }, ...rows),
    React.createElement(
      "button",
      {
        type: "button",
        className: "timeline-action-button timeline-action-button-primary",
        onClick: () => {
          props.onRetryRefresh?.();
        }
      },
      "Retry refresh"
    )
  );
}

export function buildDiagnosticsTabLines(model: DiagnosticsTabModel): string[] {
  return [
    "Diagnostics:",
    `- status code: ${model.statusCode}`,
    `- error code: ${model.errorCode ?? "none"}`,
    `- guidance: ${model.guidance ?? "none"}`,
    `- source health: ${model.sourceHealth}`,
    `- handoff code: ${model.errorCode ?? model.statusCode}`,
    `- active query source: ${model.activeQueryId ?? "none"}`,
    `- last successful refresh: ${model.lastRefreshAt ?? "none"}`,
    `- reload source: ${model.reloadSource ?? "none"}`
  ];
}
