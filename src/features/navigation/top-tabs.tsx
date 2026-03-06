import React from "react";

import type { QueryIntakeUiModel } from "../../shared/ui-state/query-intake-ui-mapper.js";
import { resolveTabBlocker, type TabId } from "./tab-blockers.js";

const TAB_ORDER: TabId[] = ["query", "mapping", "timeline", "diagnostics"];

export type TopTabsProps = {
  activeTab: TabId;
  model: QueryIntakeUiModel;
  onTabChange: (tab: TabId) => void;
  onBlockedAttempt?: (payload: {
    tab: TabId;
    reason: string;
    nextAction: string;
  }) => void;
};

export function TopTabs(props: TopTabsProps): React.ReactElement {
  const tabs = TAB_ORDER.map((tab) => {
    const blocker = resolveTabBlocker(tab, props.model);
    const selected = props.activeTab === tab;
    const meta = props.model.tabs.find((entry) => entry.id === tab);
    const label = meta?.label ?? toLabel(tab);
    const badge = meta?.badge ?? "ok";

    return React.createElement(
      "button",
      {
        key: tab,
        type: "button",
        role: "tab",
        id: `tab-${tab}`,
        "aria-selected": selected,
        "aria-controls": `tabpanel-${tab}`,
        onClick: () => {
          if (blocker.blocked) {
            props.onBlockedAttempt?.({
              tab,
              reason: blocker.reason,
              nextAction: blocker.nextAction
            });
          }

          props.onTabChange(tab);
        }
      },
      `${label} [${badge}]`
    );
  });

  return React.createElement(
    "div",
    {
      role: "tablist",
      "aria-label": "Main views"
    },
    ...tabs
  );
}

function toLabel(tab: TabId): string {
  if (tab === "query") {
    return "Query";
  }

  if (tab === "mapping") {
    return "Mapping";
  }

  if (tab === "timeline") {
    return "Timeline";
  }

  return "Diagnostics";
}
