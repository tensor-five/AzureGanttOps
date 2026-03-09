import React from "react";

export type WarningBannerModel = {
  uiState:
    | "loading"
    | "empty"
    | "auth_failure"
    | "query_failure"
    | "partial_failure"
    | "ready"
    | "ready_with_lkg_warning";
  guidance: string | null;
  retryActionLabel: string | null;
  hasStrictFailFallback: boolean;
  onRetryRefresh?: () => void;
};

export function WarningBanner(props: WarningBannerModel): React.ReactElement | null {
  const lines = buildWarningBannerLines(props);
  if (lines.length === 0) {
    return null;
  }
  const title = lines[0] ?? "[WARN]";
  const detail = (lines[1] ?? "").replace(/^- /, "");
  const actionLine = (lines[2] ?? "").replace(/^- /, "");

  return React.createElement(
    "section",
    {
      "aria-label": "timeline-warning-banner",
      className: "warning-banner-card"
    },
    React.createElement(
      "div",
      { className: "warning-banner-copy" },
      React.createElement("p", { className: "warning-banner-title" }, title),
      React.createElement("p", { className: "warning-banner-detail" }, detail),
      React.createElement("p", { className: "warning-banner-action-line" }, actionLine)
    ),
    React.createElement(
      "button",
      {
        type: "button",
        className: "timeline-action-button timeline-action-button-primary",
        onClick: () => {
          props.onRetryRefresh?.();
        }
      },
      props.retryActionLabel ?? "Refresh"
    )
  );
}

export function buildWarningBannerLines(model: WarningBannerModel): string[] {
  if (model.uiState === "partial_failure") {
    return [
      "[WARN] Partial failure in timeline hydration",
      `- ${model.guidance ?? "Some work items could not be hydrated."}`,
      `- Action: ${model.retryActionLabel ?? "Refresh"}`
    ];
  }

  if (model.uiState === "ready_with_lkg_warning" || model.hasStrictFailFallback) {
    return [
      "[WARN] Strict-fail fallback active",
      `- ${model.guidance ?? "Latest refresh failed; showing last-known-good timeline."}`,
      `- Action: ${model.retryActionLabel ?? "Refresh"}`
    ];
  }

  return [];
}
