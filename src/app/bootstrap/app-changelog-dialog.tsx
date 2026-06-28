import React from "react";

import { APP_VERSION } from "../../shared/project-meta/project-meta.js";
import type { AppUpdateNotice } from "../../shared/project-meta/app-update-check.js";
import { AppDialogShell } from "./app-dialog-shell.js";
import { type ChangelogLoadState, useAppChangelogLoader } from "./use-app-changelog-loader.js";

export type AppChangelogDialogProps = {
  open: boolean;
  onClose: () => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  updateNotice?: AppUpdateNotice | null;
};

const LazyAppChangelogMarkdown = React.lazy(async () => {
  const module = await import("./app-changelog-markdown.js");
  return { default: module.AppChangelogMarkdown };
});

export function AppChangelogDialog(props: AppChangelogDialogProps): React.ReactElement | null {
  const loadState = useAppChangelogLoader(props.open);

  return React.createElement(
    AppDialogShell,
    {
      open: props.open,
      title: `Changelog v${APP_VERSION}`,
      titleId: "app-changelog-title",
      closeLabel: "Changelog schließen",
      onClose: props.onClose,
      returnFocusRef: props.returnFocusRef,
      busy: loadState.status === "loading",
      backdropClassName: "app-changelog-backdrop",
      dialogClassName: "app-changelog-dialog",
      headerClassName: "app-changelog-header",
      closeButtonClassName: "app-changelog-close",
      contentClassName: "app-changelog-content"
    },
    props.updateNotice ? renderAppUpdateNotice(props.updateNotice) : null,
    renderChangelogContent(loadState)
  );
}

function renderAppUpdateNotice(updateNotice: AppUpdateNotice): React.ReactElement {
  return React.createElement(
    "section",
    {
      className: "app-update-notice",
      role: "note",
      "aria-label": "Neue Version verfügbar"
    },
    React.createElement("strong", null, "Neue Version verfügbar"),
    React.createElement(
      "p",
      null,
      `Installiert ist v${updateNotice.currentVersion}, verfügbar ist v${updateNotice.latestVersion}. `,
      "Mit ",
      React.createElement("code", null, "git pull"),
      " ziehen, die App über das ",
      React.createElement("code", null, ".cmd"),
      " oder ",
      React.createElement("code", null, ".command"),
      " Skript neu starten und bei Bedarf einen Hard Refresh mit ",
      React.createElement("kbd", null, "Strg+Shift+R"),
      " ausführen."
    )
  );
}

function renderChangelogContent(loadState: ChangelogLoadState): React.ReactNode {
  if (loadState.status === "loading" || loadState.status === "idle") {
    return renderChangelogLoadingState();
  }

  if (loadState.status === "error") {
    return React.createElement(
      "div",
      { className: "app-changelog-error", role: "alert" },
      `Changelog konnte nicht geladen werden. ${loadState.error}`
    );
  }

  return React.createElement(
    React.Suspense,
    { fallback: renderChangelogLoadingState() },
    React.createElement(LazyAppChangelogMarkdown, {
      content: loadState.content
    })
  );
}

function renderChangelogLoadingState(): React.ReactElement {
  return React.createElement(
    "div",
    { className: "app-changelog-state", role: "status", "aria-live": "polite" },
    "Changelog wird geladen..."
  );
}
