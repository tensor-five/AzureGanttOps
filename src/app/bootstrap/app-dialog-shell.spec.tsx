// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppDialogShell } from "./app-dialog-shell.js";

afterEach(() => {
  cleanup();
});

describe("AppDialogShell", () => {
  it("traps focus between the shell close button and focusable dialog content", async () => {
    render(
      React.createElement(
        AppDialogShell,
        {
          open: true,
          title: "Testdialog",
          titleId: "test-dialog-title",
          closeLabel: "Testdialog schließen",
          onClose: vi.fn()
        },
        React.createElement("button", { type: "button" }, "Dialogaktion")
      )
    );

    const dialog = screen.getByRole("dialog", { name: "Testdialog" });
    const closeButton = screen.getByRole("button", { name: "Testdialog schließen" });
    const actionButton = screen.getByRole("button", { name: "Dialogaktion" });
    const backdrop = screen.getByTestId("app-dialog-backdrop");

    expect(backdrop.classList.contains("app-dialog-backdrop")).toBe(true);
    expect(dialog.classList.contains("app-dialog")).toBe(true);
    expect(dialog.classList.contains("app-changelog-dialog")).toBe(false);
    expect(closeButton.classList.contains("app-dialog-close")).toBe(true);

    await waitFor(() => {
      expect(document.activeElement).toBe(closeButton);
    });

    expect(fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true, cancelable: true })).toBe(false);
    expect(document.activeElement).toBe(actionButton);

    expect(fireEvent.keyDown(dialog, { key: "Tab", cancelable: true })).toBe(false);
    expect(document.activeElement).toBe(closeButton);
  });

  it("closes on Escape and restores focus to the configured trigger", async () => {
    render(React.createElement(ClosableShellHarness));

    const trigger = screen.getByRole("button", { name: "Dialog öffnen" });
    trigger.focus();
    fireEvent.click(trigger);

    const closeButton = await screen.findByRole("button", { name: "Testdialog schließen" });
    await waitFor(() => {
      expect(document.activeElement).toBe(closeButton);
    });

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Testdialog" })).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });
  });
});

function ClosableShellHarness(): React.ReactElement {
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
      "Dialog öffnen"
    ),
    React.createElement(
      AppDialogShell,
      {
        open,
        title: "Testdialog",
        titleId: "test-dialog-title",
        closeLabel: "Testdialog schließen",
        onClose: () => setOpen(false),
        returnFocusRef: triggerRef
      },
      React.createElement("button", { type: "button" }, "Dialogaktion")
    )
  );
}
