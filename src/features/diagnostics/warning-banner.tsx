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
};

export function WarningBanner(props: WarningBannerModel): React.ReactElement | null {
  const lines = buildWarningBannerLines(props);
  if (lines.length === 0) {
    return null;
  }

  return React.createElement(
    "section",
    {
      "aria-label": "timeline-warning-banner"
    },
    React.createElement("pre", null, lines.join("\n"))
  );
}

export function buildWarningBannerLines(model: WarningBannerModel): string[] {
  if (model.uiState === "partial_failure") {
    return [
      "[WARN] Partial failure in timeline hydration",
      `- ${model.guidance ?? "Some work items could not be hydrated."}`,
      `- Action: ${model.retryActionLabel ?? "Retry refresh"}`
    ];
  }

  if (model.uiState === "ready_with_lkg_warning" || model.hasStrictFailFallback) {
    return [
      "[WARN] Strict-fail fallback active",
      `- ${model.guidance ?? "Latest refresh failed; showing last-known-good timeline."}`,
      `- Action: ${model.retryActionLabel ?? "Retry now"}`
    ];
  }

  return [];
}
