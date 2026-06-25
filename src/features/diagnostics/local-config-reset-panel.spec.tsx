// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import { LOCAL_CONFIG_RESET_CONFIRMATION, type LocalConfigResetReport } from "../../application/ports/local-config-reset.port.js";
import { LocalConfigResetPanel } from "./local-config-reset-panel.js";

const unblockedGuard = {
  blocked: false,
  reasons: []
};

afterEach(() => {
  cleanup();
});

describe("LocalConfigResetPanel", () => {
  it("disables reset when guard reports active local work", () => {
    renderPanel({
      guard: {
        blocked: true,
        reasons: ["Details panel has unsaved edits."]
      }
    });

    expect((screen.getByRole("button", { name: "Delete all Configs" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Reset blocked")).toBeDefined();
    expect(screen.getByText("Details panel has unsaved edits.")).toBeDefined();
  });

  it("requires exact confirmation before running reset", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "Delete all Configs" }));

    expect(screen.getByRole("alertdialog", { name: "Delete all Configs" })).toBeDefined();
    expect((screen.getByRole("button", { name: "Confirm delete" }) as HTMLButtonElement).disabled).toBe(true);

    await user.type(screen.getByLabelText("Delete all Configs confirmation"), "delete all configs");
    expect((screen.getByRole("button", { name: "Confirm delete" }) as HTMLButtonElement).disabled).toBe(true);

    await user.clear(screen.getByLabelText("Delete all Configs confirmation"));
    await user.type(screen.getByLabelText("Delete all Configs confirmation"), LOCAL_CONFIG_RESET_CONFIRMATION);
    expect((screen.getByRole("button", { name: "Confirm delete" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("blocks final confirmation when guard becomes blocked after dialog opens", async () => {
    const user = userEvent.setup();
    const onServerReset = vi.fn(async () => completedReport("lowdb-current-user-preferences"));
    const props = createPanelProps({ onServerReset });
    const view = render(React.createElement(LocalConfigResetPanel, props));

    await user.click(screen.getByRole("button", { name: "Delete all Configs" }));
    await user.type(screen.getByLabelText("Delete all Configs confirmation"), LOCAL_CONFIG_RESET_CONFIRMATION);
    expect((screen.getByRole("button", { name: "Confirm delete" }) as HTMLButtonElement).disabled).toBe(false);

    view.rerender(
      React.createElement(LocalConfigResetPanel, {
        ...props,
        guard: {
          blocked: true,
          reasons: ["Details panel has unsaved edits."]
        }
      })
    );

    const confirmButton = screen.getByRole("button", { name: "Confirm delete" }) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);

    await user.click(confirmButton);
    expect(onServerReset).not.toHaveBeenCalled();
  });

  it("does not run browser cleanup or reload when server reset fails", async () => {
    const user = userEvent.setup();
    const onServerReset = vi.fn(async () => {
      throw new Error("Confirmation must be DELETE ALL CONFIGS.");
    });
    const onBrowserCleanup = vi.fn(async () => completedReport("browser-local-storage"));
    const onReload = vi.fn();
    renderPanel({ onServerReset, onBrowserCleanup, onReload });

    await user.click(screen.getByRole("button", { name: "Delete all Configs" }));
    await user.type(screen.getByLabelText("Delete all Configs confirmation"), LOCAL_CONFIG_RESET_CONFIRMATION);
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Confirmation must be DELETE ALL CONFIGS.");
    expect(onBrowserCleanup).not.toHaveBeenCalled();
    expect(onReload).not.toHaveBeenCalled();
  });

  it("runs browser cleanup after server success and reloads after complete cleanup", async () => {
    const user = userEvent.setup();
    const onServerReset = vi.fn(async () => completedReport("lowdb-current-user-preferences"));
    const onBrowserCleanup = vi.fn(async () => completedReport("browser-local-storage"));
    const onReload = vi.fn();
    renderPanel({ onServerReset, onBrowserCleanup, onReload });

    await user.click(screen.getByRole("button", { name: "Delete all Configs" }));
    await user.type(screen.getByLabelText("Delete all Configs confirmation"), LOCAL_CONFIG_RESET_CONFIRMATION);
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));

    await screen.findByText("Browser localStorage app keys: deleted");
    expect(onServerReset).toHaveBeenCalledWith({ confirmation: LOCAL_CONFIG_RESET_CONFIRMATION });
    expect(onBrowserCleanup).toHaveBeenCalledTimes(1);
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it("shows a partial report without reload", async () => {
    const user = userEvent.setup();
    const onReload = vi.fn();
    renderPanel({
      onServerReset: async () => ({
        status: "partial_failure",
        targets: [
          {
            target: "mapping-settings",
            label: "Field mapping settings",
            status: "failed",
            message: "Local target could not be cleared."
          }
        ]
      }),
      onReload
    });

    await user.click(screen.getByRole("button", { name: "Delete all Configs" }));
    await user.type(screen.getByLabelText("Delete all Configs confirmation"), LOCAL_CONFIG_RESET_CONFIRMATION);
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));

    expect(await screen.findByText("Field mapping settings: failed")).toBeDefined();
    expect(onReload).not.toHaveBeenCalled();
  });
});

function renderPanel(overrides?: Partial<React.ComponentProps<typeof LocalConfigResetPanel>>) {
  return render(React.createElement(LocalConfigResetPanel, createPanelProps(overrides)));
}

function createPanelProps(
  overrides?: Partial<React.ComponentProps<typeof LocalConfigResetPanel>>
): React.ComponentProps<typeof LocalConfigResetPanel> {
  return {
    guard: unblockedGuard,
    onServerReset: async () => completedReport("lowdb-current-user-preferences"),
    onBrowserCleanup: async () => completedReport("browser-local-storage"),
    onReload: vi.fn(),
    ...overrides
  };
}

function completedReport(target: string): LocalConfigResetReport {
  const label =
    target === "browser-local-storage" ? "Browser localStorage app keys" : "Current user lowdb preferences";

  return {
    status: "completed",
    targets: [
      {
        target,
        label,
        status: "deleted",
        message: "Local target cleared."
      }
    ]
  };
}
