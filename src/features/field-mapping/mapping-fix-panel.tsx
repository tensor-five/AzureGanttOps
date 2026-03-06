import React from "react";

import type { MappingValidationIssue } from "../../domain/mapping/mapping-errors.js";

const REQUIRED_LABELS: Record<"id" | "title" | "start" | "endOrTarget", string> = {
  id: "ID",
  title: "Title",
  start: "Start Date",
  endOrTarget: "End/Target Date"
};

export type MappingFixPanelProps = {
  requiredIssues: MappingValidationIssue[];
  onApply: (selection: {
    id: string;
    title: string;
    start: string;
    endOrTarget: string;
  }) => void;
};

export function MappingFixPanel(props: MappingFixPanelProps): React.ReactElement {
  const required = props.requiredIssues
    .filter((issue): issue is MappingValidationIssue & { field: keyof typeof REQUIRED_LABELS } =>
      issue.field in REQUIRED_LABELS
    )
    .map((issue) =>
      React.createElement(
        "li",
        { key: `${issue.field}-${issue.code}` },
        `${REQUIRED_LABELS[issue.field]} required: ${issue.guidance}`
      )
    );

  return React.createElement(
    "section",
    {
      "aria-label": "mapping-fix-panel"
    },
    React.createElement("h3", null, "Fix required mapping fields"),
    React.createElement("ul", null, ...required),
    React.createElement(
      "button",
      {
        type: "button",
        onClick: () =>
          props.onApply({
            id: "System.Id",
            title: "System.Title",
            start: "Microsoft.VSTS.Scheduling.StartDate",
            endOrTarget: "Microsoft.VSTS.Scheduling.TargetDate"
          })
      },
      "Apply required defaults"
    )
  );
}
