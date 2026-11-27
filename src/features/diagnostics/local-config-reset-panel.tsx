import React from "react";

import {
  LOCAL_CONFIG_RESET_CONFIRMATION,
  type LocalConfigResetReport,
  type LocalConfigResetTargetResult
} from "../../application/ports/local-config-reset.port.js";
import type { LocalConfigResetGuard } from "./local-config-reset-guard.js";

export type LocalConfigResetPanelProps = {
  guard: LocalConfigResetGuard;
  onServerReset: (request: { confirmation: string }) => Promise<LocalConfigResetReport>;
  onBrowserCleanup: () => Promise<LocalConfigResetReport>;
  onReload: () => void;
};

type ResetPhase = "idle" | "pending" | "failed" | "partial" | "reloading";

export function LocalConfigResetPanel(props: LocalConfigResetPanelProps): React.ReactElement {
  const [modalOpen, setModalOpen] = React.useState(false);
  const [confirmation, setConfirmation] = React.useState("");
  const [phase, setPhase] = React.useState<ResetPhase>("idle");
  const [serverReport, setServerReport] = React.useState<LocalConfigResetReport | null>(null);
  const [browserReport, setBrowserReport] = React.useState<LocalConfigResetReport | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const resetDialogState = React.useCallback(() => {
    setConfirmation("");
    setPhase("idle");
    setServerReport(null);
    setBrowserReport(null);
    setErrorMessage(null);
  }, []);

  const closeModal = React.useCallback(() => {
    if (phase === "pending" || phase === "reloading") {
      return;
    }

    setModalOpen(false);
    resetDialogState();
  }, [phase, resetDialogState]);

  const runReset = React.useCallback(async () => {
    if (props.guard.blocked) {
      return;
    }

    setPhase("pending");
    setErrorMessage(null);
    setServerReport(null);
    setBrowserReport(null);

    try {
      const nextServerReport = await props.onServerReset({ confirmation });
      setServerReport(nextServerReport);
      if (nextServerReport.status === "partial_failure") {
        setPhase("partial");
        return;
      }

      const nextBrowserReport = await props.onBrowserCleanup();
      setBrowserReport(nextBrowserReport);
      if (nextBrowserReport.status === "partial_failure") {
        setPhase("partial");
        return;
      }

      setPhase("reloading");
      props.onReload();
    } catch (error: unknown) {
      setPhase("failed");
      setErrorMessage(error instanceof Error ? error.message : "Local config reset failed.");
    }
  }, [confirmation, props]);

  const confirmDisabled =
    props.guard.blocked ||
    confirmation !== LOCAL_CONFIG_RESET_CONFIRMATION ||
    phase === "pending" ||
    phase === "reloading";
  const panelButtonDisabled = props.guard.blocked || phase === "pending" || phase === "reloading";

  return React.createElement(
    "section",
    { className: "local-config-reset-panel", "aria-label": "local-config-reset-panel" },
    React.createElement("h3", { className: "local-config-reset-title" }, "Delete all Configs"),
    React.createElement(
      "p",
      { className: "local-config-reset-copy" },
      "Clears local app configuration only. Azure DevOps data, saved queries, az login, ~/.azure, repo artifacts and shell environment stay untouched."
    ),
    props.guard.blocked
      ? React.createElement(
          "div",
          { className: "local-config-reset-guard", role: "status" },
          React.createElement("strong", null, "Reset blocked"),
          React.createElement(
            "ul",
            null,
            props.guard.reasons.map((reason) => React.createElement("li", { key: reason }, reason))
          )
        )
      : null,
    React.createElement(
      "button",
      {
        type: "button",
        className: "local-config-reset-open",
        disabled: panelButtonDisabled,
        onClick: () => {
          resetDialogState();
          setModalOpen(true);
        }
      },
      phase === "pending" ? "Deleting..." : "Delete all Configs"
    ),
    modalOpen
      ? React.createElement(
          "div",
          {
            className: "local-config-reset-backdrop",
            onClick: closeModal
          },
          React.createElement(
            "div",
            {
              className: "local-config-reset-dialog",
              role: "alertdialog",
              "aria-modal": "true",
              "aria-labelledby": "local-config-reset-dialog-title",
              "aria-describedby": "local-config-reset-dialog-desc",
              onClick: (event: React.MouseEvent) => event.stopPropagation()
            },
            React.createElement(
              "h3",
              { id: "local-config-reset-dialog-title", className: "local-config-reset-dialog-title" },
              "Delete all Configs"
            ),
            React.createElement(
              "p",
              { id: "local-config-reset-dialog-desc", className: "local-config-reset-dialog-desc" },
              "This removes local preferences, context, mappings, browser app storage and PWA caches. It does not touch Azure DevOps, Azure saved queries, az login, ~/.azure, repository files, build artifacts or shell environment."
            ),
            React.createElement("label", { className: "local-config-reset-confirm-label" }, "Type DELETE ALL CONFIGS"),
            React.createElement("input", {
              className: "local-config-reset-confirm-input",
              "aria-label": "Delete all Configs confirmation",
              value: confirmation,
              disabled: phase === "pending" || phase === "reloading",
              onChange: (event) => {
                setConfirmation((event.target as HTMLInputElement).value);
              }
            }),
            errorMessage
              ? React.createElement("p", { className: "local-config-reset-error", role: "alert" }, errorMessage)
              : null,
            serverReport || browserReport ? renderResetReport(serverReport, browserReport) : null,
            React.createElement(
              "div",
              { className: "local-config-reset-actions" },
              React.createElement(
                "button",
                {
                  type: "button",
                  className: "local-config-reset-cancel",
                  disabled: phase === "pending" || phase === "reloading",
                  onClick: closeModal
                },
                "Cancel"
              ),
              React.createElement(
                "button",
                {
                  type: "button",
                  className: "local-config-reset-confirm",
                  disabled: confirmDisabled,
                  onClick: () => {
                    void runReset();
                  }
                },
                phase === "pending" ? "Deleting..." : phase === "reloading" ? "Reloading..." : "Confirm delete"
              )
            )
          )
        )
      : null
  );
}

function renderResetReport(
  serverReport: LocalConfigResetReport | null,
  browserReport: LocalConfigResetReport | null
): React.ReactElement {
  const targets = [
    ...(serverReport?.targets ?? []),
    ...(browserReport?.targets ?? [])
  ];

  return React.createElement(
    "div",
    { className: "local-config-reset-report", role: "status", "aria-label": "local-config-reset-report" },
    React.createElement("strong", null, "Reset report"),
    React.createElement(
      "ul",
      null,
      targets.map((target) => renderReportItem(target))
    )
  );
}

function renderReportItem(target: LocalConfigResetTargetResult): React.ReactElement {
  return React.createElement(
    "li",
    { key: `${target.target}-${target.status}`, "data-status": target.status },
    `${target.label}: ${target.status}`
  );
}
