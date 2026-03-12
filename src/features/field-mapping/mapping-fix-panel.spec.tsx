// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { RouteObject } from "react-router";

import { MappingFixPanel } from "./mapping-fix-panel.js";
import { createRoutesStub } from "../../shared/testing/routes-stub.js";

afterEach(() => {
  cleanup();
});

describe("mapping-fix-panel routed workflows", () => {
  it("renders required-field blocker guidance and applies deterministic required defaults", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();

    const routes: RouteObject[] = [
      {
        path: "/mapping",
        element: React.createElement(MappingFixPanel, {
          requiredIssues: [
            {
              code: "MAP_REQUIRED_BLANK",
              field: "id",
              message: "ID mapping cannot be blank.",
              guidance: "Provide the Azure field reference for ID."
            },
            {
              code: "MAP_REQUIRED_BLANK",
              field: "start",
              message: "Start Date mapping cannot be blank.",
              guidance: "Provide a non-empty Azure field reference for Start Date."
            },
            {
              code: "MAP_REQUIRED_BLANK",
              field: "endOrTarget",
              message: "End/Target Date mapping cannot be blank.",
              guidance: "Provide a non-empty Azure field reference for End/Target Date."
            }
          ],
          onApply
        })
      }
    ];

    createRoutesStub(routes, { initialEntries: ["/mapping"] });

    expect(screen.getByRole("heading", { name: "Fix required mapping fields" })).toBeDefined();
    expect(screen.getByText("These fields must be mapped before timeline rendering can continue.")).toBeDefined();
    expect(screen.getByText("ID")).toBeDefined();
    expect(screen.getByText("Provide the Azure field reference for ID.")).toBeDefined();
    expect(screen.getByText("Start Date")).toBeDefined();
    expect(screen.getByText("Provide a non-empty Azure field reference for Start Date.")).toBeDefined();
    expect(screen.getByText("End/Target Date")).toBeDefined();
    expect(screen.getByText("Provide a non-empty Azure field reference for End/Target Date.")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Apply required defaults" }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith({
      id: "System.Id",
      title: "System.Title",
      start: "Microsoft.VSTS.Scheduling.StartDate",
      endOrTarget: "Microsoft.VSTS.Scheduling.TargetDate"
    });
  });

  it("keeps panel actionable when optional/non-required issues are present", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();

    const routes: RouteObject[] = [
      {
        path: "/mapping",
        element: React.createElement(MappingFixPanel, {
          requiredIssues: [
            {
              code: "MAP_REQUIRED_DUPLICATE",
              field: "title",
              message: "Title field is duplicated.",
              guidance: "Pick one unique field for title."
            }
          ],
          onApply
        })
      }
    ];

    createRoutesStub(routes, { initialEntries: ["/mapping"] });

    expect(screen.getByRole("heading", { name: "Fix required mapping fields" })).toBeDefined();
    expect(screen.getByText("Title")).toBeDefined();
    expect(screen.getByText("Pick one unique field for title.")).toBeDefined();
    expect(screen.queryByText("Optional mapping can be left empty.")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Apply required defaults" }));
    expect(onApply).toHaveBeenCalledTimes(1);
  });
});
