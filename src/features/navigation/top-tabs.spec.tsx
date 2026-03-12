// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { RouteObject } from "react-router";

import { TopTabs } from "./top-tabs.js";
import type { QueryIntakeUiModel } from "../../shared/ui-state/query-intake-ui-mapper.js";
import { resolveTabBlocker } from "./tab-blockers.js";
import { createRoutesStub } from "../../shared/testing/routes-stub.js";

function makeModel(overrides?: Partial<QueryIntakeUiModel>): QueryIntakeUiModel {
  return {
    uiState: "ready",
    trustState: "ready",
    statusCode: "OK",
    errorCode: null,
    guidance: null,
    freshness: {
      activeQueryId: "query-1",
      lastRefreshAt: "2026-03-06T12:00:00.000Z",
      reloadSource: "full_reload"
    },
    capabilities: {
      canRefresh: true,
      canSwitchQuery: true,
      canChangeDensity: true,
      canOpenDetails: true,
      readOnlyTimeline: true
    },
    strictFail: {
      active: false,
      message: null,
      retryActionLabel: null,
      dismissible: true,
      dismissed: false,
      lastSuccessfulRefreshAt: null,
      lastSuccessfulSource: null
    },
    mapping: {
      status: "valid",
      issues: [],
      activeProfileId: "profile-a"
    },
    timeline: null,
    tabs: [
      { id: "query", label: "Query", badge: "ok" },
      { id: "mapping", label: "Mapping", badge: "ok" },
      { id: "timeline", label: "Timeline", badge: "ok" },
      { id: "diagnostics", label: "Diagnostics", badge: "ok" }
    ],
    ...overrides
  };
}

describe("top-tabs routed interactions", () => {
  it("keeps blocked timeline tab clickable and emits blocker reason + next action", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    const onBlockedAttempt = vi.fn();

    const blockedModel = makeModel({
      freshness: {
        activeQueryId: "query-1",
        lastRefreshAt: null,
        reloadSource: "full_reload"
      },
      mapping: {
        status: "invalid",
        issues: [
          {
            code: "MAP_REQUIRED_BLANK",
            field: "start",
            message: "Start Date mapping cannot be blank.",
            guidance: "Provide a non-empty Azure field reference for Start Date."
          }
        ],
        activeProfileId: "profile-a"
      },
      tabs: [
        { id: "query", label: "Query", badge: "ok" },
        { id: "mapping", label: "Mapping", badge: "warning" },
        { id: "timeline", label: "Timeline", badge: "blocked" },
        { id: "diagnostics", label: "Diagnostics", badge: "ok" }
      ]
    });

    const routes: RouteObject[] = [
      {
        path: "/",
        element: React.createElement(TopTabs, {
          activeTab: "query",
          model: blockedModel,
          onTabChange,
          onBlockedAttempt
        })
      }
    ];

    createRoutesStub(routes, { initialEntries: ["/"] });

    const timelineTab = screen.getByRole("tab", { name: "Timeline [blocked]" });
    expect(timelineTab).toBeDefined();

    await user.click(timelineTab);

    expect(onTabChange).toHaveBeenCalledWith("timeline");
    expect(onBlockedAttempt).toHaveBeenCalledTimes(1);
    expect(onBlockedAttempt).toHaveBeenCalledWith({
      tab: "timeline",
      reason: "Required mapping fields are invalid.",
      nextAction: "Open Mapping and resolve required id/title/start/endOrTarget fields."
    });

    const blocker = resolveTabBlocker("timeline", blockedModel);
    expect(blocker.blocked).toBe(true);
    expect(blocker.reason).toContain("Required mapping fields are invalid.");
    expect(blocker.nextAction).toContain("resolve required id/title/start/endOrTarget fields");
  });

  it("allows diagnostics navigation after query run and does not emit blocker event", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    const onBlockedAttempt = vi.fn();

    const readyModel = makeModel({
      freshness: {
        activeQueryId: "query-2",
        lastRefreshAt: "2026-03-06T12:01:00.000Z",
        reloadSource: "full_reload"
      },
      tabs: [
        { id: "query", label: "Query", badge: "ok" },
        { id: "mapping", label: "Mapping", badge: "ok" },
        { id: "timeline", label: "Timeline", badge: "ok" },
        { id: "diagnostics", label: "Diagnostics", badge: "warning" }
      ]
    });

    const routes: RouteObject[] = [
      {
        path: "/",
        element: React.createElement(TopTabs, {
          activeTab: "query",
          model: readyModel,
          onTabChange,
          onBlockedAttempt
        })
      }
    ];

    createRoutesStub(routes, { initialEntries: ["/"] });

    await user.click(screen.getByRole("tab", { name: "Diagnostics [warning]" }));

    expect(onTabChange).toHaveBeenCalledWith("diagnostics");
    expect(onBlockedAttempt).not.toHaveBeenCalled();

    const blocker = resolveTabBlocker("diagnostics", readyModel);
    expect(blocker.blocked).toBe(false);
    expect(blocker.reason).toBe("");
    expect(blocker.nextAction).toBe("");
  });
});
