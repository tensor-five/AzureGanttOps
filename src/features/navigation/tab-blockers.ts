import type { QueryIntakeUiModel } from "../../shared/ui-state/query-intake-ui-mapper.js";

export type TabId = "query" | "mapping" | "timeline" | "diagnostics";

export type TabBlocker = {
  blocked: boolean;
  reason: string;
  nextAction: string;
};

export function resolveTabBlocker(tab: TabId, model: QueryIntakeUiModel): TabBlocker {
  if (tab === "query") {
    if (!model.capabilities.canSwitchQuery) {
      return {
        blocked: true,
        reason: "No active Azure session.",
        nextAction: "Restore Azure session, then pick a saved query."
      };
    }

    return {
      blocked: false,
      reason: "",
      nextAction: ""
    };
  }

  if (tab === "mapping") {
    if (!model.freshness.activeQueryId) {
      return {
        blocked: true,
        reason: "No query selected yet.",
        nextAction: "Select a saved query first."
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
        nextAction: "Select a query and run intake."
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
      nextAction: "Select a query to populate diagnostics and freshness state."
    };
  }

  return {
    blocked: false,
    reason: "",
    nextAction: ""
  };
}
