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
  const [manualQueryId, setManualQueryId] = React.useState("");

  const runQuery = React.useCallback(
    async (queryId: string) => {
      const normalizedQueryId = queryId.trim();
      if (normalizedQueryId.length === 0) {
        return;
      }

      const persisted = readPersistedQueryMappingSelection(normalizedQueryId);
      const proposal = proposeDefaultMappingForQuery({
        queryId: normalizedQueryId,
        availableFieldRefs: props.availableFieldRefs
      });

      const response = await props.onRun({
        queryId: normalizedQueryId,
        mappingProfileId: persisted,
        mappingProfileUpsert: proposal.status === "valid" ? proposal.profile : undefined
      });

      if (response.activeMappingProfileId) {
        persistQueryMappingSelection(normalizedQueryId, response.activeMappingProfileId);
      }

      if (response.mappingValidation.status === "invalid" || proposal.status === "invalid") {
        props.onNeedsFix(response);
      }
    },
    [props]
  );

  const buttons = props.savedQueries.map((query) =>
    React.createElement(
      "button",
      {
        key: query.id,
        type: "button",
        onClick: () => {
          void runQuery(query.id);
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
    React.createElement(
      "label",
      null,
      "Query ID",
      React.createElement("input", {
        "aria-label": "Query ID",
        value: manualQueryId,
        onChange: (event) => {
          setManualQueryId((event.target as HTMLInputElement).value);
        }
      })
    ),
    React.createElement(
      "button",
      {
        type: "button",
        onClick: () => {
          void runQuery(manualQueryId);
        }
      },
      "Run query by ID"
    ),
    ...buttons
  );
}
