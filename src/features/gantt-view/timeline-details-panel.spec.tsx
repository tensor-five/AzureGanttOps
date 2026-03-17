// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { TimelineDetailsPanel } from "./timeline-details-panel.js";
import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";

afterEach(() => {
  cleanup();
});

function makeTimeline(): TimelineReadModel {
  return {
    bars: [
      {
        workItemId: 11,
        title: "Source Item",
        state: { code: "Active", badge: "A", color: "#2f855a" },
        schedule: {
          startDate: "2026-03-01T00:00:00.000Z",
          endDate: "2026-03-03T00:00:00.000Z",
          missingBoundary: null
        },
        details: {
          mappedId: "11",
          descriptionHtml: "<p>Initial</p>"
        }
      }
    ],
    unschedulable: [],
    dependencies: [],
    suppressedDependencies: [],
    mappingValidation: {
      status: "valid",
      issues: []
    }
  };
}

describe("timeline-details-panel keyboard shortcuts", () => {
  it("shows description collapsed by default and expands when toggled or edited", async () => {
    const { container } = render(
      React.createElement(TimelineDetailsPanel, {
        timeline: makeTimeline(),
        selectedWorkItemId: 11
      })
    );

    const description = container.querySelector(".timeline-details-richtext");
    expect(description?.className).toContain("timeline-details-richtext-collapsed");

    const toggle = screen.getByRole("button", { name: "Show more" });
    fireEvent.click(toggle);
    expect(description?.className).not.toContain("timeline-details-richtext-collapsed");

    fireEvent.click(toggle);
    expect(description?.className).toContain("timeline-details-richtext-collapsed");

    fireEvent.click(description as HTMLDivElement);

    await waitFor(() => {
      expect(description?.getAttribute("contenteditable")).toBe("true");
    });
    expect(description?.className).not.toContain("timeline-details-richtext-collapsed");
  });

  it("saves on Ctrl+S when details are dirty", async () => {
    const onUpdateSelectedWorkItemDetails = vi.fn(async () => undefined);

    render(
      React.createElement(TimelineDetailsPanel, {
        timeline: makeTimeline(),
        selectedWorkItemId: 11,
        onUpdateSelectedWorkItemDetails
      })
    );

    const titleInput = screen.getByLabelText("Title");
    fireEvent.change(titleInput, { target: { value: "Updated Source Item" } });

    const event = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, cancelable: true });
    window.dispatchEvent(event);

    await waitFor(() => {
      expect(onUpdateSelectedWorkItemDetails).toHaveBeenCalledTimes(1);
    });

    expect(onUpdateSelectedWorkItemDetails).toHaveBeenCalledWith(
      expect.objectContaining({
        targetWorkItemId: 11,
        title: "Updated Source Item",
        state: "Active"
      })
    );
    expect(event.defaultPrevented).toBe(true);
  });

  it("does nothing on Ctrl+S when no changes exist", async () => {
    const onUpdateSelectedWorkItemDetails = vi.fn(async () => undefined);

    render(
      React.createElement(TimelineDetailsPanel, {
        timeline: makeTimeline(),
        selectedWorkItemId: 11,
        onUpdateSelectedWorkItemDetails
      })
    );

    const event = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, cancelable: true });
    window.dispatchEvent(event);

    await waitFor(() => {
      expect(onUpdateSelectedWorkItemDetails).not.toHaveBeenCalled();
    });
    expect(event.defaultPrevented).toBe(false);
  });

  it("sanitizes unsafe description html before rendering and saving", async () => {
    const onUpdateSelectedWorkItemDetails = vi.fn(async () => undefined);
    const timeline = makeTimeline();
    timeline.bars[0].details.descriptionHtml = '<p onclick="evil()">Safe</p><img src=x onerror=evil()><script>alert(1)</script>';

    const { container } = render(
      React.createElement(TimelineDetailsPanel, {
        timeline,
        selectedWorkItemId: 11,
        onUpdateSelectedWorkItemDetails
      })
    );

    const description = container.querySelector(".timeline-details-richtext");
    expect(description?.innerHTML).toContain("<p>Safe</p>");
    expect(description?.innerHTML).not.toContain("onclick=");
    expect(description?.innerHTML).not.toContain("<script");

    const titleInput = screen.getByLabelText("Title");
    fireEvent.change(titleInput, { target: { value: "Updated Source Item" } });

    const event = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, cancelable: true });
    window.dispatchEvent(event);

    await waitFor(() => {
      expect(onUpdateSelectedWorkItemDetails).toHaveBeenCalledTimes(1);
    });

    expect(onUpdateSelectedWorkItemDetails).toHaveBeenCalledWith(
      expect.objectContaining({
        descriptionHtml: "<p>Safe</p>"
      })
    );
  });
});
