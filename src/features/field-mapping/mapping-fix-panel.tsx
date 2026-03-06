import React from "react";

import type { MappingValidationIssue } from "../../domain/mapping/mapping-errors.js";

const REQUIRED_LABELS: Record<"id" | "title" | "start" | "endOrTarget", string> = {
  id: "ID",
  title: "Title",
  start: "Start Date",
  endOrTarget: "End/Target Date"
};

const REQUIRED_ORDER: Array<keyof typeof REQUIRED_LABELS> = ["id", "title", "start", "endOrTarget"];

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
  const issueByField = new Map<keyof typeof REQUIRED_LABELS, MappingValidationIssue>();
  for (const issue of props.requiredIssues) {
    if (issue.field in REQUIRED_LABELS) {
      issueByField.set(issue.field as keyof typeof REQUIRED_LABELS, issue);
    }
  }

  const required = REQUIRED_ORDER.map((field) => {
    const issue = issueByField.get(field);
    return React.createElement(
      "li",
      { key: field },
      `${REQUIRED_LABELS[field]} required: ${issue?.guidance ?? "Apply required defaults to continue."}`
    );
  });

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
