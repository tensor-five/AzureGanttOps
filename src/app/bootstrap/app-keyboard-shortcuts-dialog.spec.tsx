// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  APP_KEYBOARD_SHORTCUT_SECTIONS,
  type KeyboardShortcut,
  type KeyboardShortcutFeatureContract,
  type KeyboardShortcutSection
} from "./app-keyboard-shortcuts.catalog.js";
import { APP_DIALOG_SHELL_SHORTCUT_CONTRACTS } from "./app-dialog-shell.js";
import { AppKeyboardShortcutsDialog } from "./app-keyboard-shortcuts-dialog.js";
import { TIMELINE_DETAILS_KEYBOARD_SHORTCUT_CONTRACTS } from "../../features/gantt-view/timeline-details-panel.js";
import { TIMELINE_PANE_SHORTCUT_CONTRACTS } from "../../features/gantt-view/timeline-pane.js";
import { WORK_ITEM_CONTEXT_MENU_KEYBOARD_SHORTCUT_CONTRACTS } from "../../features/gantt-view/timeline-work-item-context-menu.js";
import { TIMELINE_KEYBOARD_SHORTCUT_CONTRACTS } from "../../features/gantt-view/use-timeline-keyboard-shortcuts.js";
import { WORK_ITEM_CONTEXT_MENU_TRIGGER_SHORTCUT_CONTRACTS } from "../../features/gantt-view/use-work-item-context-menu.js";

afterEach(() => {
  cleanup();
});

describe("AppKeyboardShortcutsDialog", () => {
  it("renders nothing while closed", () => {
    render(React.createElement(AppKeyboardShortcutsDialog, { open: false, onClose: vi.fn() }));

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders available shortcuts in the shared dialog shell", () => {
    render(React.createElement(AppKeyboardShortcutsDialog, { open: true, onClose: vi.fn() }));

    expect(screen.getByRole("dialog", { name: "Tastenkombinationen" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tastenkombinationen schließen" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Allgemein", level: 3 })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Timeline", level: 3 })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Work Items", level: 3 })).toBeTruthy();
    expect(screen.getByText("Strg/Cmd+S").tagName).toBe("KBD");
    expect(screen.getByText("Geänderte Details speichern oder ausstehende Work-Item-Änderungen synchronisieren")).toBeTruthy();
    expect(screen.getByText("Umschalt+F10").tagName).toBe("KBD");
    expect(screen.getByText("Kontextmenü am fokussierten Work Item öffnen")).toBeTruthy();
  });

  it("matches every audited catalog contract to exported feature shortcut contracts", () => {
    render(React.createElement(AppKeyboardShortcutsDialog, { open: true, onClose: vi.fn() }));

    const featureContracts = [
      ...APP_DIALOG_SHELL_SHORTCUT_CONTRACTS,
      ...TIMELINE_DETAILS_KEYBOARD_SHORTCUT_CONTRACTS,
      ...TIMELINE_KEYBOARD_SHORTCUT_CONTRACTS,
      ...TIMELINE_PANE_SHORTCUT_CONTRACTS,
      ...WORK_ITEM_CONTEXT_MENU_TRIGGER_SHORTCUT_CONTRACTS,
      ...WORK_ITEM_CONTEXT_MENU_KEYBOARD_SHORTCUT_CONTRACTS
    ] as const satisfies readonly KeyboardShortcutFeatureContract[];
    const catalogSections: readonly KeyboardShortcutSection[] = APP_KEYBOARD_SHORTCUT_SECTIONS;
    const catalogShortcuts: readonly KeyboardShortcut[] = catalogSections.flatMap((section) => section.shortcuts);
    const catalogContracts = catalogShortcuts.map((shortcut) => shortcut.contract);

    expect(catalogContracts).toEqual(Array.from(new Set(catalogContracts)));
    expect(uniqueSortedContracts(catalogContracts)).toEqual(uniqueSortedContracts(featureContracts));

    for (const shortcut of catalogShortcuts) {
      for (const key of shortcut.keys) {
        expect(screen.getAllByText(key).some((element) => element.tagName === "KBD")).toBe(true);
      }
      expect(screen.getByText(shortcut.description)).toBeTruthy();
    }
  });

  it("keeps Tab focus trapped on the shell close button", async () => {
    render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement("button", { type: "button" }, "Außen"),
        React.createElement(AppKeyboardShortcutsDialog, { open: true, onClose: vi.fn() })
      )
    );

    const dialog = screen.getByRole("dialog", { name: "Tastenkombinationen" });
    const closeButton = screen.getByRole("button", { name: "Tastenkombinationen schließen" });

    await waitFor(() => {
      expect(document.activeElement).toBe(closeButton);
    });

    expect(fireEvent.keyDown(dialog, { key: "Tab", cancelable: true })).toBe(false);
    expect(document.activeElement).toBe(closeButton);

    expect(fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true, cancelable: true })).toBe(false);
    expect(document.activeElement).toBe(closeButton);
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    render(React.createElement(ClosableKeyboardShortcutsHarness));

    const trigger = screen.getByRole("button", { name: "Tastenkombinationen öffnen" });
    trigger.focus();
    fireEvent.click(trigger);

    const closeButton = await screen.findByRole("button", { name: "Tastenkombinationen schließen" });
    await waitFor(() => {
      expect(document.activeElement).toBe(closeButton);
    });

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Tastenkombinationen" })).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });
  });
});

function ClosableKeyboardShortcutsHarness(): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "button",
      {
        ref: triggerRef,
        type: "button",
        onClick: () => setOpen(true)
      },
      "Tastenkombinationen öffnen"
    ),
    React.createElement(AppKeyboardShortcutsDialog, {
      open,
      onClose: () => setOpen(false),
      returnFocusRef: triggerRef
    })
  );
}

function uniqueSortedContracts(contracts: readonly KeyboardShortcutFeatureContract[]): KeyboardShortcutFeatureContract[] {
  return Array.from(new Set(contracts)).sort((left, right) => left.localeCompare(right));
}
