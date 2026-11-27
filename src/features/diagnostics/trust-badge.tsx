import React from "react";

export type TrustBadgeModel = {
  statusCode: string;
  trustState: "ready" | "needs_attention" | "partial_failure";
  lastRefreshAt: string | null;
  readOnlyTimeline: boolean;
  controlsOpen?: boolean;
  onControlsOpenChange?: (open: boolean) => void;
  controlsContent?: React.ReactNode;
};

const CLOSED_TRIGGER_LABEL = "Status";

export function TrustBadge(props: TrustBadgeModel): React.ReactElement {
  const label = labelForTrustState(props.trustState);
  const statusLine = `[${props.statusCode}] ${label}`;
  const isControlled = typeof props.controlsOpen === "boolean";
  const [internalControlsOpen, setInternalControlsOpen] = React.useState(false);
  const controlsOpen = props.controlsOpen ?? internalControlsOpen;
  const detailsProps: {
    "aria-label": string;
    className: string;
    open: boolean;
    onToggle: (event: React.SyntheticEvent<HTMLDetailsElement>) => void;
  } = {
    "aria-label": CLOSED_TRIGGER_LABEL,
    className: "trust-badge-details",
    open: controlsOpen,
    onToggle: (event) => {
      const nextControlsOpen = (event.currentTarget as HTMLDetailsElement).open;
      if (!isControlled) {
        setInternalControlsOpen(nextControlsOpen);
      }
      props.onControlsOpenChange?.(nextControlsOpen);
    }
  };

  return React.createElement(
    "details",
    detailsProps,
    React.createElement(
      "summary",
      { className: "trust-badge-trigger" },
      React.createElement("span", { className: "trust-badge-pill-label" }, CLOSED_TRIGGER_LABEL)
    ),
    controlsOpen
      ? React.createElement(
          "div",
          { className: "trust-badge-panel" },
          React.createElement("p", { className: "trust-badge-status" }, statusLine),
          React.createElement(
            "dl",
            { className: "trust-badge-meta" },
            React.createElement("dt", null, "last-updated"),
            React.createElement("dd", null, props.lastRefreshAt ?? "none")
          ),
          props.controlsContent
            ? React.createElement(
                "section",
                { className: "trust-badge-controls-menu", "aria-label": "controls-menu" },
                props.controlsContent
              )
            : null
        )
      : null
  );
}

export function renderTrustBadgeLine(model: TrustBadgeModel): string {
  const label = labelForTrustState(model.trustState);

  return `[${model.statusCode}] ${label} | last-updated=${model.lastRefreshAt ?? "none"}`;
}

function labelForTrustState(trustState: TrustBadgeModel["trustState"]): string {
  return trustState === "ready"
    ? "Ready"
    : trustState === "partial_failure"
      ? "Partial failure"
      : "Needs attention";
}
