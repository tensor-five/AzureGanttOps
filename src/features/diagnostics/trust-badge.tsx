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

  return React.createElement(
    "section",
    {
      "aria-label": "global-trust-badge"
    },
    React.createElement(
      "span",
      null,
      `[${props.statusCode}] ${label} | last-updated=${props.lastRefreshAt ?? "none"} | read-only=${props.readOnlyTimeline ? "true" : "false"}`
    )
  );
}

export function renderTrustBadgeLine(model: TrustBadgeModel): string {
  const label = model.trustState === "ready"
    ? "Ready"
    : model.trustState === "partial_failure"
      ? "Partial failure"
      : "Needs attention";

  return `[${model.statusCode}] ${label} | last-updated=${model.lastRefreshAt ?? "none"} | read-only=${model.readOnlyTimeline ? "true" : "false"}`;
}
