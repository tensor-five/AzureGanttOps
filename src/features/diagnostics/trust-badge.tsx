import React from "react";

export type TrustBadgeModel = {
  statusCode: string;
  trustState: "ready" | "needs_attention" | "partial_failure";
  lastRefreshAt: string | null;
  readOnlyTimeline: boolean;
};

export function TrustBadge(props: TrustBadgeModel): React.ReactElement {
  const label = props.trustState === "ready"
    ? "Ready"
    : props.trustState === "partial_failure"
      ? "Partial failure"
      : "Needs attention";
  const isHealthy = props.trustState === "ready";
  const pillLabel = isHealthy ? "OK" : "Trust Attention";
  const pillIcon = isHealthy ? "✓" : "!";
  const statusLine = `[${props.statusCode}] ${label}`;

  return React.createElement(
    "details",
    {
      "aria-label": "global-trust-badge",
      className: "trust-badge-details",
      "data-trust-state": isHealthy ? "healthy" : "unhealthy"
    },
    React.createElement(
      "summary",
      { className: "trust-badge-trigger" },
      React.createElement("span", { className: "trust-badge-icon", "aria-hidden": "true" }, pillIcon),
      React.createElement("span", { className: "trust-badge-pill-label" }, pillLabel)
    ),
    React.createElement(
      "div",
      { className: "trust-badge-panel" },
      React.createElement("p", { className: "trust-badge-status" }, statusLine),
      React.createElement(
        "dl",
        { className: "trust-badge-meta" },
        React.createElement("dt", null, "last-updated"),
        React.createElement("dd", null, props.lastRefreshAt ?? "none")
      )
    )
  );
}

export function renderTrustBadgeLine(model: TrustBadgeModel): string {
  const label = model.trustState === "ready"
    ? "Ready"
    : model.trustState === "partial_failure"
      ? "Partial failure"
      : "Needs attention";

  return `[${model.statusCode}] ${label} | last-updated=${model.lastRefreshAt ?? "none"}`;
}
