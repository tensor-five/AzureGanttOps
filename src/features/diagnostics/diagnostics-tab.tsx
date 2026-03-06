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
};

export function DiagnosticsTab(props: DiagnosticsTabModel): React.ReactElement {
  const lines = buildDiagnosticsTabLines(props);

  return React.createElement(
    "section",
    {
      "aria-label": "diagnostics-tab"
    },
    React.createElement("pre", null, lines.join("\n"))
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
