import React from "react";

import { APP_VERSION } from "../../shared/project-meta/project-meta.js";

export type AppReleaseBadgeProps = {
  open: boolean;
  updateAvailable?: boolean;
  onVersionClick: () => void;
  onUpdateClick?: () => void;
  versionButtonRef?: React.Ref<HTMLButtonElement>;
  updateButtonRef?: React.Ref<HTMLButtonElement>;
};

export function AppReleaseBadge(props: AppReleaseBadgeProps): React.ReactElement {
  const label = `v${APP_VERSION}`;

  return React.createElement(
    "span",
    {
      className: "app-release-badge-group"
    },
    React.createElement(
      "button",
      {
        ref: props.versionButtonRef,
        type: "button",
        className: "app-release-badge",
        "aria-haspopup": "dialog",
        "aria-expanded": props.open,
        "aria-label": `Changelog zu Version ${APP_VERSION} öffnen`,
        title: `Changelog zu Version ${APP_VERSION} öffnen`,
        onClick: props.onVersionClick
      },
      label
    ),
    props.updateAvailable
      ? React.createElement(
          "button",
          {
            ref: props.updateButtonRef,
            type: "button",
            className: "app-release-update-indicator",
            "aria-haspopup": "dialog",
            "aria-expanded": props.open,
            "aria-label": "Neue Version verfügbar. Changelog mit Update-Hinweis öffnen",
            title: "Neue Version verfügbar",
            onClick: props.onUpdateClick
          },
          "!"
        )
      : null
  );
}
