import React from "react";

import { GITHUB_REPO_URL, TENSORFIVE_WEBSITE_URL } from "../../shared/project-meta/project-meta.js";

export type TimelinePrintFooterProps = {
  isPrintMode: boolean;
};

export function TimelinePrintFooter(props: TimelinePrintFooterProps): React.ReactElement {
  return React.createElement(
    "div",
    { className: "timeline-print-footer", "aria-hidden": !props.isPrintMode },
    "An ",
    React.createElement(
      "a",
      {
        className: "timeline-print-footer-link",
        href: GITHUB_REPO_URL,
        target: "_blank",
        rel: "noopener noreferrer"
      },
      "Open Source Project"
    ),
    " by Christian Betz @ ",
    React.createElement(
      "a",
      {
        className: "timeline-print-footer-link",
        href: TENSORFIVE_WEBSITE_URL,
        target: "_blank",
        rel: "noopener noreferrer"
      },
      "TensorFive GmbH"
    )
  );
}
