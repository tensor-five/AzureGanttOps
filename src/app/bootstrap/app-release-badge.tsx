import React from "react";

import { APP_VERSION } from "../../shared/project-meta/project-meta.js";

export type AppReleaseBadgeProps = {
  open: boolean;
  onClick: () => void;
  buttonRef?: React.Ref<HTMLButtonElement>;
};

export function AppReleaseBadge(props: AppReleaseBadgeProps): React.ReactElement {
  const label = `Changelog v${APP_VERSION}`;

  return React.createElement(
    "button",
    {
      ref: props.buttonRef,
      type: "button",
      className: "app-release-badge",
      "aria-haspopup": "dialog",
      "aria-expanded": props.open,
      "aria-label": `Changelog zu Version ${APP_VERSION} öffnen`,
      title: `Changelog zu Version ${APP_VERSION} öffnen`,
      onClick: props.onClick
    },
    label
  );
}
