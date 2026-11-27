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
      closeLabel: "Close changelog",
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
      "aria-label": "New version available"
    },
    React.createElement("strong", null, "New version available"),
    React.createElement(
      "p",
      null,
      `Installed v${updateNotice.currentVersion}; latest is v${updateNotice.latestVersion}. `,
      "Run ",
      React.createElement("code", null, "git pull"),
      ", restart the app using the ",
      React.createElement("code", null, ".cmd"),
      " or ",
      React.createElement("code", null, ".command"),
      " script, and perform a hard refresh with ",
      React.createElement("kbd", null, "Ctrl+Shift+R"),
      " if needed."
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
      `Could not load changelog. ${loadState.error}`
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
    "Loading changelog..."
  );
}
