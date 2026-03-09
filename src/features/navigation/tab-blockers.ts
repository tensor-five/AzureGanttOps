import type { QueryIntakeUiModel } from "../../shared/ui-state/query-intake-ui-mapper.js";
import type { TabId } from "../../shared/ui-state/tab-id.js";

export type TabBlocker = {
  blocked: boolean;
  reason: string;
  nextAction: string;
};

export function resolveTabBlocker(tab: TabId, model: QueryIntakeUiModel): TabBlocker {
  if (tab === "query") {
    return {
      blocked: false,
      reason: "",
      nextAction: ""
    };
  }

  if (model.statusCode === "CONTEXT_MISMATCH") {
    return {
      blocked: true,
      reason: "Azure defaults do not match selected query context.",
      nextAction: "Paste full query URL or set Organization + Project in Query tab and run again."
    };
  }

  if (model.statusCode === "SESSION_EXPIRED") {
    return {
      blocked: true,
      reason: "Azure session expired.",
      nextAction: "Run az login and retry query intake."
    };
  }

  if (model.statusCode === "CLI_NOT_FOUND") {
    return {
      blocked: true,
      reason: "Azure CLI not found.",
      nextAction: "Install Azure CLI, then retry query intake."
    };
  }

  if (model.statusCode === "MISSING_EXTENSION") {
    return {
      blocked: true,
      reason: "Azure DevOps extension is missing.",
      nextAction: "Run az extension add --name azure-devops and retry."
    };
  }

  if (model.uiState === "auth_failure") {
    return {
      blocked: true,
      reason: "Azure preflight is not ready.",
      nextAction: "Open Query tab, correct context/session, then run again."
    };
  }

  if (tab === "mapping") {
    if (!model.freshness.activeQueryId) {
      return {
        blocked: true,
        reason: "No query selected yet.",
        nextAction: "Run query intake first."
      };
    }

    return {
      blocked: false,
      reason: "",
      nextAction: ""
    };
  }

  if (tab === "timeline") {
    if (!model.freshness.activeQueryId) {
      return {
        blocked: true,
        reason: "Timeline requires an active query run.",
        nextAction: "Run query intake from Query tab."
      };
    }

    if (model.mapping.status === "invalid") {
      return {
        blocked: true,
        reason: "Required mapping fields are invalid.",
        nextAction: "Open Mapping and resolve required id/title/start/endOrTarget fields."
      };
    }

    return {
      blocked: false,
      reason: "",
      nextAction: ""
    };
  }

  if (!model.freshness.activeQueryId) {
    return {
      blocked: true,
      reason: "Diagnostics require an attempted query run.",
      nextAction: "Run query intake from Query tab."
    };
  }

  return {
    blocked: false,
    reason: "",
    nextAction: ""
  };
}
