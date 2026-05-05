import React from "react";

import { STANDARD_AZURE_FIELD_DEFAULTS } from "../../domain/mapping/default-mapping-proposal.js";
import {
  REQUIRED_FIELD_LABELS,
  REQUIRED_MAPPING_FIELDS,
  type RequiredMappingField
} from "../../domain/mapping/field-mapping.js";
import type { MappingValidationIssue } from "../../domain/mapping/mapping-errors.js";

const REQUIRED_LABELS = REQUIRED_FIELD_LABELS;
const REQUIRED_ORDER: readonly RequiredMappingField[] = REQUIRED_MAPPING_FIELDS;

export type MappingFixPanelProps = {
  requiredIssues: MappingValidationIssue[];
  detectedFieldRefs?: ReadonlyArray<string>;
  onApply: (selection: {
    id: string;
    title: string;
    start: string;
    endOrTarget: string;
  }) => void;
};

export function MappingFixPanel(props: MappingFixPanelProps): React.ReactElement {
  const issueByField = new Map<RequiredMappingField, MappingValidationIssue>();
  for (const issue of props.requiredIssues) {
    if (issue.field in REQUIRED_LABELS) {
      issueByField.set(issue.field as RequiredMappingField, issue);
    }
  }

  const required = REQUIRED_ORDER.map((field) => {
    const issue = issueByField.get(field);
    return React.createElement(
      "li",
      { key: field, className: "mapping-fix-item" },
      React.createElement("strong", null, REQUIRED_LABELS[field]),
      React.createElement(
        "span",
        null,
        issue?.guidance ?? "Apply standard Azure mapping to continue."
      )
    );
  });

  const detectedRefs = props.detectedFieldRefs ?? [];
  const detectedSection = detectedRefs.length > 0
    ? React.createElement(
        "section",
        {
          "aria-label": "mapping-fix-detected",
          className: "mapping-fix-detected"
        },
        React.createElement("h4", null, "Detected in your snapshot"),
        React.createElement(
          "p",
          { className: "mapping-fix-detected-hint" },
          "These field references were found in the work items returned by your query. Use them to map manually if the standard mapping doesn't fit."
        ),
        React.createElement(
          "ul",
          { className: "mapping-fix-detected-list" },
          ...detectedRefs.map((ref) =>
            React.createElement("li", { key: ref, className: "mapping-fix-detected-item" }, ref)
          )
        )
      )
    : null;

  return React.createElement(
    "section",
    {
      "aria-label": "mapping-fix-panel",
      className: "mapping-fix-panel"
    },
    React.createElement(
      "header",
      { className: "mapping-fix-header" },
      React.createElement("h3", null, "Set up field mapping"),
      React.createElement(
        "p",
        null,
        "Pick the Azure field references that drive your timeline. We couldn't auto-detect standard scheduling fields in this project's work items."
      )
    ),
    React.createElement("ul", { className: "mapping-fix-list" }, ...required),
    React.createElement(
      "button",
      {
        type: "button",
        className: "mapping-fix-primary",
        onClick: () => props.onApply({ ...STANDARD_AZURE_FIELD_DEFAULTS })
      },
      "Apply standard Azure mapping"
    ),
    detectedSection
  );
}
