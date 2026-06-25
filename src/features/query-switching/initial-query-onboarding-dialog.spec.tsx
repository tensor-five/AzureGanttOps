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
    organization: "",
    project: "",
    loading: false,
    statusMessage: null,
    errorMessage: null,
    onQueryInputChange: vi.fn(),
    onOrganizationChange: vi.fn(),
    onProjectChange: vi.fn(),
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

    const dialog = screen.getByRole("dialog", { name: "Erste Query verbinden" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");

    const queryInput = screen.getByLabelText("Erststart Query URL oder Query ID");
    await waitFor(() => {
      expect(document.activeElement).toBe(queryInput);
    });
  });

  it("shows loading status and alert errors", () => {
    renderDialog({
      loading: true,
      errorMessage: "Azure CLI ist nicht angemeldet."
    });

    expect(screen.getByRole("status").textContent).toBe("Query wird geladen...");
    expect(screen.getByRole("alert").textContent).toBe("Azure CLI ist nicht angemeldet.");
  });

  it("does not disappear on Escape or backdrop interaction", () => {
    renderDialog();

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.mouseDown(screen.getByTestId("initial-query-onboarding-backdrop"));

    expect(screen.getByRole("dialog", { name: "Erste Query verbinden" })).toBeTruthy();
  });

  it("submits the form through the provided callback", () => {
    const onSubmit = vi.fn();
    renderDialog({ onSubmit });

    fireEvent.click(screen.getByRole("button", { name: "Query laden" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("traps Tab focus inside the dialog", async () => {
    renderDialog();

    const dialog = screen.getByRole("dialog", { name: "Erste Query verbinden" });
    const queryInput = screen.getByLabelText("Erststart Query URL oder Query ID");
    const submitButton = screen.getByRole("button", { name: "Query laden" });

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
    previousButton.textContent = "Vorheriger Fokus";
    document.body.appendChild(previousButton);
    previousButton.focus();

    const { unmount } = renderDialog();
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText("Erststart Query URL oder Query ID"));
    });

    unmount();
    expect(document.activeElement).toBe(previousButton);
    previousButton.remove();
  });
});
