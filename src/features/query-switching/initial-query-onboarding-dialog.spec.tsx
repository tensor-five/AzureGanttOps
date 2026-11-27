// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { InitialQueryOnboardingDialog } from "./initial-query-onboarding-dialog.js";

afterEach(() => {
  cleanup();
});

function renderDialog(overrides?: Partial<React.ComponentProps<typeof InitialQueryOnboardingDialog>>) {
  const props: React.ComponentProps<typeof InitialQueryOnboardingDialog> = {
    queryInput: "",
    loading: false,
    statusMessage: null,
    errorMessage: null,
    onQueryInputChange: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides
  };

  return {
    props,
    ...render(React.createElement(InitialQueryOnboardingDialog, props))
  };
}

describe("initial-query-onboarding-dialog", () => {
  it("renders as a modal dialog and focuses the query input first", async () => {
    renderDialog();

    const dialog = screen.getByRole("dialog", { name: "Connect your first query" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");

    const queryInput = screen.getByLabelText("Initial query URL");
    await waitFor(() => {
      expect(document.activeElement).toBe(queryInput);
    });
  });

  it("only asks for the initial Azure DevOps query URL", () => {
    renderDialog();

    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.getByLabelText("Initial query URL")).toBeTruthy();
    expect(screen.queryByText("Organization")).toBeNull();
    expect(screen.queryByText("Project")).toBeNull();
    expect(screen.queryByText("Query ID")).toBeNull();
  });

  it("shows loading status and alert errors", () => {
    renderDialog({
      loading: true,
      errorMessage: "Azure CLI is not signed in."
    });

    expect(screen.getByRole("status").textContent).toBe("Loading query...");
    expect(screen.getByRole("alert").textContent).toBe("Azure CLI is not signed in.");
  });

  it("keeps the submit button name stable and shows a hidden loading spinner", () => {
    renderDialog({ loading: true });

    const submitButton = screen.getByRole("button", { name: "Load query" });
    const spinner = screen.getByTestId("initial-query-onboarding-submit-spinner");

    expect((submitButton as HTMLButtonElement).disabled).toBe(true);
    expect(submitButton.getAttribute("aria-busy")).toBe("true");
    expect(spinner.getAttribute("aria-hidden")).toBe("true");
  });

  it("does not disappear on Escape or backdrop interaction", () => {
    renderDialog();

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.mouseDown(screen.getByTestId("initial-query-onboarding-backdrop"));

    expect(screen.getByRole("dialog", { name: "Connect your first query" })).toBeTruthy();
  });

  it("submits the form through the provided callback", () => {
    const onSubmit = vi.fn();
    renderDialog({ onSubmit });

    fireEvent.click(screen.getByRole("button", { name: "Load query" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("traps Tab focus inside the dialog", async () => {
    renderDialog();

    const dialog = screen.getByRole("dialog", { name: "Connect your first query" });
    const queryInput = screen.getByLabelText("Initial query URL");
    const submitButton = screen.getByRole("button", { name: "Load query" });

    await waitFor(() => {
      expect(document.activeElement).toBe(queryInput);
    });

    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(submitButton);

    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(queryInput);
  });

  it("returns focus to the previously active element after closing", async () => {
    const previousButton = document.createElement("button");
    previousButton.textContent = "Previous focus";
    document.body.appendChild(previousButton);
    previousButton.focus();

    const { unmount } = renderDialog();
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText("Initial query URL"));
    });

    unmount();
    expect(document.activeElement).toBe(previousButton);
    previousButton.remove();
  });
});
