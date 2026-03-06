import React from "react";

import type { QueryIntakeResponse } from "./query-intake.controller.js";
import {
  persistQueryMappingSelection,
  proposeDefaultMappingForQuery,
  readPersistedQueryMappingSelection
} from "../field-mapping/mapping-auto-apply.js";

export type QuerySelectorProps = {
  savedQueries: Array<{
    id: string;
    name: string;
  }>;
  availableFieldRefs: string[];
  onRun: (request: {
    queryId: string;
    mappingProfileId?: string;
    mappingProfileUpsert?: {
      id: string;
      name: string;
      fields: {
        id: string;
        title: string;
        start: string;
        endOrTarget: string;
      };
    };
  }) => Promise<QueryIntakeResponse>;
  onNeedsFix: (response: QueryIntakeResponse) => void;
};

export function QuerySelector(props: QuerySelectorProps): React.ReactElement {
  const buttons = props.savedQueries.map((query) =>
    React.createElement(
      "button",
      {
        key: query.id,
        type: "button",
        onClick: async () => {
          const persisted = readPersistedQueryMappingSelection(query.id);
          const proposal = proposeDefaultMappingForQuery({
            queryId: query.id,
            availableFieldRefs: props.availableFieldRefs
          });

          const response = await props.onRun({
            queryId: query.id,
            mappingProfileId: persisted,
            mappingProfileUpsert: proposal.status === "valid" ? proposal.profile : undefined
          });

          if (response.activeMappingProfileId) {
            persistQueryMappingSelection(query.id, response.activeMappingProfileId);
          }

          if (response.mappingValidation.status === "invalid" || proposal.status === "invalid") {
            props.onNeedsFix(response);
          }
        }
      },
      `${query.name} (${query.id})`
    )
  );

  return React.createElement(
    "section",
    {
      "aria-label": "query-selector"
    },
    React.createElement("h3", null, "Select saved query"),
    ...buttons
  );
}
