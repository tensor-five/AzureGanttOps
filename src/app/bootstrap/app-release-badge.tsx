import React from "react";

import { APP_VERSION, CHANGELOG_PATH } from "../../shared/project-meta/project-meta.js";

export function AppReleaseBadge(): React.ReactElement {
  const label = `Changelog v${APP_VERSION}`;

  return React.createElement(
    "a",
    {
      className: "app-release-badge",
      href: CHANGELOG_PATH,
      "aria-label": `Changelog zu Version ${APP_VERSION} öffnen`,
      title: `Changelog zu Version ${APP_VERSION} öffnen`
    },
    label
  );
}
