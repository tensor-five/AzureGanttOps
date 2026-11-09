// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { TimelineDetailsPanel } from "./timeline-details-panel.js";
import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";

afterEach(() => {
  cleanup();
});

function rowLabelsWithIterationHint(container: HTMLElement): string[] {
  const fields = Array.from(container.querySelectorAll(".timeline-details-field"));
  return fields
    .filter((field) => field.querySelector(".timeline-details-row-hint-iteration") !== null)
    .map((field) => field.querySelector(".timeline-details-label")?.textContent?.trim() ?? "");
}

function makeTimeline(): TimelineReadModel {
  return {
    queryType: "flat",
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
    treeLayout: null,
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

    const readDescription = () => container.querySelector(".timeline-details-richtext");
    expect(readDescription()?.className).toContain("timeline-details-richtext-collapsed");

    const toggle = screen.getByRole("button", { name: "Show more" });
    fireEvent.click(toggle);
    expect(readDescription()?.className).not.toContain("timeline-details-richtext-collapsed");

    fireEvent.click(screen.getByRole("button", { name: "Show less" }));
    expect(readDescription()?.className).toContain("timeline-details-richtext-collapsed");

    fireEvent.click(readDescription() as HTMLDivElement);

    await waitFor(() => {
      expect(readDescription()?.getAttribute("contenteditable")).toBe("true");
    });
    expect(readDescription()?.className).not.toContain("timeline-details-richtext-collapsed");
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
        fields: { "System.Title": "Updated Source Item" }
      })
    );
    expect(event.defaultPrevented).toBe(true);
  });

  it("reports details dirty immediately on draft changes and clears after save", async () => {
    const onDirtyChange = vi.fn();
    const onUpdateSelectedWorkItemDetails = vi.fn(async () => undefined);

    render(
      React.createElement(TimelineDetailsPanel, {
        timeline: makeTimeline(),
        selectedWorkItemId: 11,
        onDirtyChange,
        onUpdateSelectedWorkItemDetails
      })
    );

    const titleInput = screen.getByLabelText("Title");
    fireEvent.change(titleInput, { target: { value: "Updated Source Item" } });

    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onUpdateSelectedWorkItemDetails).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    });
  });

  it("resets dirty drafts when the parent requests a details draft reset", async () => {
    const onDirtyChange = vi.fn();
    const timeline = makeTimeline();
    const { rerender } = render(
      React.createElement(TimelineDetailsPanel, {
        timeline,
        selectedWorkItemId: 11,
        draftResetKey: 0,
        onDirtyChange
      })
    );

    const titleInput = screen.getByLabelText("Title") as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: "Unsaved draft" } });
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    const refreshedTimeline = makeTimeline();
    refreshedTimeline.bars[0].title = "Server title";
    rerender(
      React.createElement(TimelineDetailsPanel, {
        timeline: refreshedTimeline,
        selectedWorkItemId: 11,
        draftResetKey: 1,
        onDirtyChange
      })
    );

    await waitFor(() => {
      expect(titleInput.value).toBe("Server title");
    });
    await waitFor(() => {
      expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    });
  });

  it("rehydrates same-selected details when refreshed server values change", async () => {
    const onDirtyChange = vi.fn();
    const timeline = makeTimeline();
    const { rerender } = render(
      React.createElement(TimelineDetailsPanel, {
        timeline,
        selectedWorkItemId: 11,
        onDirtyChange
      })
    );

    const titleInput = screen.getByLabelText("Title") as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: "Local stale draft" } });
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    const refreshedTimeline = makeTimeline();
    refreshedTimeline.bars[0].title = "Fresh server title";
    refreshedTimeline.bars[0].details.descriptionHtml = "<p>Fresh server description</p>";
    rerender(
      React.createElement(TimelineDetailsPanel, {
        timeline: refreshedTimeline,
        selectedWorkItemId: 11,
        onDirtyChange
      })
    );

    await waitFor(() => {
      expect(titleInput.value).toBe("Fresh server title");
    });
    await waitFor(() => {
      expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    });
  });

  it("keeps detail controls locked while a save is in flight", async () => {
    let resolveSave: () => void = () => undefined;
    const onUpdateSelectedWorkItemDetails = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        })
    );

    render(
      React.createElement(TimelineDetailsPanel, {
        timeline: makeTimeline(),
        selectedWorkItemId: 11,
        onUpdateSelectedWorkItemDetails
      })
    );

    const titleInput = screen.getByLabelText("Title") as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: "Updated Source Item" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(titleInput.disabled).toBe(true);
    });

    resolveSave();
    await waitFor(() => {
      expect(titleInput.disabled).toBe(false);
    });
  });

  it("does not save again from Ctrl+S while a save is in flight", async () => {
    let resolveSave: () => void = () => undefined;
    const onUpdateSelectedWorkItemDetails = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        })
    );

    render(
      React.createElement(TimelineDetailsPanel, {
        timeline: makeTimeline(),
        selectedWorkItemId: 11,
        onUpdateSelectedWorkItemDetails
      })
    );

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Updated Source Item" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onUpdateSelectedWorkItemDetails).toHaveBeenCalledTimes(1);
    });

    const event = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, cancelable: true });
    window.dispatchEvent(event);

    expect(onUpdateSelectedWorkItemDetails).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(false);

    resolveSave();
    await waitFor(() => {
      expect((screen.getByLabelText("Title") as HTMLInputElement).disabled).toBe(false);
    });
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

  it("marks start and end dates with an iteration hint when both dates were inherited from the iteration", () => {
    const timeline = makeTimeline();
    timeline.bars[0].schedule.iterationFallback = "both";

    const { container } = render(
      React.createElement(TimelineDetailsPanel, {
        timeline,
        selectedWorkItemId: 11
      })
    );

    const hints = container.querySelectorAll(".timeline-details-row-hint-iteration");
    expect(hints).toHaveLength(2);
    hints.forEach((hint) => {
      expect(hint.textContent).toBe("from iteration");
      expect(hint.getAttribute("title")).toContain("iteration");
    });
  });

  it("marks only the start row when only the start was filled from the iteration", () => {
    const timeline = makeTimeline();
    timeline.bars[0].schedule.iterationFallback = "start";

    const { container } = render(
      React.createElement(TimelineDetailsPanel, {
        timeline,
        selectedWorkItemId: 11
      })
    );

    expect(rowLabelsWithIterationHint(container)).toEqual(["Start"]);
  });

  it("marks only the end row when only the end was filled from the iteration", () => {
    const timeline = makeTimeline();
    timeline.bars[0].schedule.iterationFallback = "end";

    const { container } = render(
      React.createElement(TimelineDetailsPanel, {
        timeline,
        selectedWorkItemId: 11
      })
    );

    expect(rowLabelsWithIterationHint(container)).toEqual(["End"]);
  });

  it("does not show the iteration hint when dates come from the work item", () => {
    const { container } = render(
      React.createElement(TimelineDetailsPanel, {
        timeline: makeTimeline(),
        selectedWorkItemId: 11
      })
    );

    const hints = container.querySelectorAll(".timeline-details-row-hint-iteration");
    expect(hints).toHaveLength(0);
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

    fireEvent.click(description as HTMLDivElement);
    const editor = await waitFor(() => {
      const element = container.querySelector(".timeline-details-richtext-editing");
      expect(element).not.toBeNull();
      return element as HTMLDivElement;
    });
    editor.innerHTML = '<p onclick="evil()">Safe edit</p><script>alert(1)</script>';
    fireEvent.input(editor);

    const event = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, cancelable: true });
    window.dispatchEvent(event);

    await waitFor(() => {
      expect(onUpdateSelectedWorkItemDetails).toHaveBeenCalledTimes(1);
    });

    expect(onUpdateSelectedWorkItemDetails).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: { "System.Description": "<p>Safe edit</p>" }
      })
    );
  });
});

describe("timeline-details-panel configurable fields", () => {
  const storyPointsDefinition = {
    referenceName: "Microsoft.VSTS.Scheduling.StoryPoints",
    name: "Story Points",
    type: "double",
    readOnly: false,
    isIdentity: false,
    allowedValues: [],
    workItemTypes: ["User Story"]
  };

  function makeStoryTimeline(): TimelineReadModel {
    const timeline = makeTimeline();
    timeline.bars[0].details.workItemType = "User Story";
    timeline.bars[0].details.fieldValues = { "Microsoft.VSTS.Scheduling.StoryPoints": 5 };
    return timeline;
  }

  it("loads field definitions for the query's work item types and saves story points", async () => {
    const onFetchWorkItemFieldDefinitions = vi.fn(async () => [storyPointsDefinition]);
    const onUpdateSelectedWorkItemDetails = vi.fn(async () => undefined);

    render(
      React.createElement(TimelineDetailsPanel, {
        timeline: makeStoryTimeline(),
        selectedWorkItemId: 11,
        onFetchWorkItemFieldDefinitions,
        onUpdateSelectedWorkItemDetails
      })
    );

    const storyPoints = (await screen.findByLabelText("Story Points")) as HTMLInputElement;
    expect(onFetchWorkItemFieldDefinitions).toHaveBeenCalledWith({ workItemTypes: ["User Story"] });
    expect(storyPoints.value).toBe("5");

    fireEvent.change(storyPoints, { target: { value: "1.234" } });
    expect(screen.getByText("Enter a number ≥ 0 with up to 2 decimals.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(storyPoints, { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onUpdateSelectedWorkItemDetails).toHaveBeenCalledWith({
        targetWorkItemId: 11,
        fields: { "Microsoft.VSTS.Scheduling.StoryPoints": 8 },
        htmlFields: [],
        stateColor: null
      });
    });
  });

  it("keeps the draft and the save button after a failed save", async () => {
    const onUpdateSelectedWorkItemDetails = vi.fn(async () => {
      throw new Error("TF401320: denied");
    });

    render(
      React.createElement(TimelineDetailsPanel, {
        timeline: makeStoryTimeline(),
        selectedWorkItemId: 11,
        onFetchWorkItemFieldDefinitions: async () => [storyPointsDefinition],
        onUpdateSelectedWorkItemDetails
      })
    );

    const storyPoints = (await screen.findByLabelText("Story Points")) as HTMLInputElement;
    fireEvent.change(storyPoints, { target: { value: "13" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Save failed: TF401320: denied")).toBeTruthy();
    expect(storyPoints.value).toBe("13");
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("opens the configuration from the gear and hides removed fields immediately", async () => {
    render(
      React.createElement(TimelineDetailsPanel, {
        timeline: makeStoryTimeline(),
        selectedWorkItemId: 11,
        onFetchWorkItemFieldDefinitions: async () => [storyPointsDefinition]
      })
    );

    await screen.findByLabelText("Story Points");
    const gear = screen.getByRole("button", { name: "Configure details fields" });
    fireEvent.click(gear);
    expect(gear.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Remove Story Points" }));
    expect(screen.queryByLabelText("Story Points")).toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Details fields" })).toBeNull();

    fireEvent.click(gear);
    fireEvent.click(screen.getByRole("button", { name: "Reset to default" }));
    expect(await screen.findByLabelText("Story Points")).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog", { name: "Details fields" })).toBeNull();
  });

  it("falls back to read-only loaded fields when definitions fail", async () => {
    render(
      React.createElement(TimelineDetailsPanel, {
        timeline: makeStoryTimeline(),
        selectedWorkItemId: 11,
        onFetchWorkItemFieldDefinitions: async () => {
          throw new Error("offline");
        }
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Configure details fields" }));
    expect(await screen.findByText("Field definitions unavailable – loaded fields are edited as text.")).toBeTruthy();
  });

  it("keeps drafts bound to their work item when the selection changes", async () => {
    const timeline = makeStoryTimeline();
    timeline.bars.push({
      ...timeline.bars[0],
      workItemId: 12,
      title: "Other Item",
      details: { ...timeline.bars[0].details, mappedId: "12" }
    });
    const { rerender } = render(
      React.createElement(TimelineDetailsPanel, { timeline, selectedWorkItemId: 11 })
    );

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Draft for 11" } });
    rerender(React.createElement(TimelineDetailsPanel, { timeline, selectedWorkItemId: 12 }));

    await waitFor(() => {
      expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Other Item");
    });
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps drafts typed while field definitions are still loading", async () => {
    let resolveDefinitions: (fields: typeof storyPointsDefinition[]) => void = () => undefined;
    const definitions = new Promise<typeof storyPointsDefinition[]>((resolve) => {
      resolveDefinitions = resolve;
    });
    render(
      React.createElement(TimelineDetailsPanel, {
        timeline: makeStoryTimeline(),
        selectedWorkItemId: 11,
        onFetchWorkItemFieldDefinitions: () => definitions
      })
    );

    const title = screen.getByLabelText("Title") as HTMLInputElement;
    fireEvent.change(title, { target: { value: "Early draft" } });
    resolveDefinitions([storyPointsDefinition]);

    await screen.findByLabelText("Story Points");
    expect(title.value).toBe("Early draft");
  });

  it("links validation errors to their input", async () => {
    render(
      React.createElement(TimelineDetailsPanel, {
        timeline: makeStoryTimeline(),
        selectedWorkItemId: 11,
        onFetchWorkItemFieldDefinitions: async () => [storyPointsDefinition]
      })
    );

    const storyPoints = (await screen.findByLabelText("Story Points")) as HTMLInputElement;
    fireEvent.change(storyPoints, { target: { value: "-2" } });
    const errorId = storyPoints.getAttribute("aria-describedby");
    expect(errorId).toBeTruthy();
    expect(document.getElementById(errorId as string)?.textContent).toBe("Enter a number ≥ 0 with up to 2 decimals.");
  });
});
