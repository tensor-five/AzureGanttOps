// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { buildDetailsFieldCatalog } from "./details-panel-field-catalog.js";
import { DetailsPanelFieldConfigMenu } from "./details-panel-field-config-menu.js";

afterEach(() => {
  cleanup();
});

const catalog = buildDetailsFieldCatalog({
  timeline: null,
  definitions: [
    {
      referenceName: "Microsoft.VSTS.Scheduling.StoryPoints",
      name: "Story Points",
      type: "double",
      readOnly: false,
      isIdentity: false,
      allowedValues: [],
      workItemTypes: ["User Story"]
    }
  ]
});

function renderMenu(shownIds: string[], onChangeShownIds = vi.fn(), onReset = vi.fn()) {
  render(React.createElement(DetailsPanelFieldConfigMenu, { catalog, shownIds, onChangeShownIds, onReset }));
  return { onChangeShownIds, onReset };
}

describe("DetailsPanelFieldConfigMenu", () => {
  it("lists shown fields with count, badges and disabled edge buttons", () => {
    renderMenu(["System.Title", "builtin.dependencies", "Custom.Missing"]);

    const shown = screen.getByRole("list", { name: "Shown fields" });
    const items = within(shown).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toContain("Built-in");
    expect(items[0].textContent).toContain("Full");
    expect(items[0].textContent).not.toContain("Edit");
    expect(items[1].textContent).toContain("½");
    expect(items[1].textContent).not.toContain("Edit");
    expect(items[2].textContent).toContain("Not in current query");
    expect(items[2].className).toContain("timeline-details-config-item-unavailable");
    expect((screen.getByRole("button", { name: "Move Title up" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Move Custom.Missing down" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("reorders, removes, adds and resets", () => {
    const { onChangeShownIds, onReset } = renderMenu(["System.Title", "System.State"]);

    fireEvent.click(screen.getByRole("button", { name: "Move State up" }));
    expect(onChangeShownIds).toHaveBeenLastCalledWith(["System.State", "System.Title"]);

    fireEvent.click(screen.getByRole("button", { name: "Remove Title" }));
    expect(onChangeShownIds).toHaveBeenLastCalledWith(["System.State"]);

    fireEvent.click(screen.getByRole("button", { name: "Show Story Points" }));
    expect(onChangeShownIds).toHaveBeenLastCalledWith(["System.Title", "System.State", "Microsoft.VSTS.Scheduling.StoryPoints"]);

    fireEvent.click(screen.getByRole("button", { name: "Reset to default" }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("moves items with Alt+Arrow keys", () => {
    const { onChangeShownIds } = renderMenu(["System.Title", "System.State"]);
    const items = within(screen.getByRole("list", { name: "Shown fields" })).getAllByRole("listitem");

    fireEvent.keyDown(items[1], { key: "ArrowUp", altKey: true });
    expect(onChangeShownIds).toHaveBeenLastCalledWith(["System.State", "System.Title"]);

    fireEvent.keyDown(items[1], { key: "ArrowUp" });
    expect(onChangeShownIds).toHaveBeenCalledTimes(1);
  });

  it("filters available fields by name or reference and shows an empty hint", () => {
    renderMenu(["System.Title"]);
    const search = screen.getByRole("searchbox", { name: "Search details fields" });

    fireEvent.change(search, { target: { value: "vsts.scheduling" } });
    expect(within(screen.getByRole("list", { name: "Available fields" })).getAllByRole("listitem")).toHaveLength(1);

    fireEvent.change(search, { target: { value: "nothing-like-this" } });
    expect(screen.getByText("No matching field.")).toBeTruthy();
  });

  it("supports drag and drop reordering", () => {
    const { onChangeShownIds } = renderMenu(["System.Title", "System.State", "System.Description"]);
    const items = within(screen.getByRole("list", { name: "Shown fields" })).getAllByRole("listitem");
    const dataTransfer = { effectAllowed: "", setData: vi.fn() };

    fireEvent.dragStart(items[2], { dataTransfer });
    fireEvent.dragOver(items[0], { dataTransfer });
    expect(items[0].className).toContain("timeline-details-config-item-drop-before");
    fireEvent.drop(items[0], { dataTransfer });

    expect(onChangeShownIds).toHaveBeenLastCalledWith(["System.Description", "System.Title", "System.State"]);
  });

  it("shows the fallback notice when definitions are unavailable", () => {
    render(
      React.createElement(DetailsPanelFieldConfigMenu, {
        catalog: buildDetailsFieldCatalog({ timeline: null, definitions: null }),
        shownIds: [],
        onChangeShownIds: vi.fn(),
        onReset: vi.fn()
      })
    );

    expect(screen.getByText("Field definitions unavailable – loaded fields are edited as text.")).toBeTruthy();
  });
});
