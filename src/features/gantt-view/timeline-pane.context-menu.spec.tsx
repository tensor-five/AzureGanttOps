// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import { TimelinePane } from "./timeline-pane.js";
import { makeTimeline, registerTimelinePaneSpecCleanup } from "./timeline-pane.test-helpers.js";
import type { WorkItemStateOption } from "./work-item-state-options.js";

registerTimelinePaneSpecCleanup();

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

describe("timeline-pane work item context menu", () => {
  it("opens from sidebar rows with only the allowed actions", () => {
    render(
      React.createElement(TimelinePane, {
        timeline: makeTimeline(),
        showDependencies: true,
        organization: "contoso",
        project: "delivery"
      })
    );

    fireEvent.contextMenu(screen.getByLabelText("timeline-sidebar-row-11"), { clientX: 120, clientY: 140 });

    expect(screen.getByRole("menu", { name: /Work item #11 context menu/ })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Duplizieren" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Status ändern" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "In Azure DevOps öffnen" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Link kopieren" })).toBeTruthy();
    expect(screen.queryByText(/Details öffnen/i)).toBeNull();
    expect(screen.queryByText(/neues Kind/i)).toBeNull();
    expect(screen.queryByText(/Zeitraum bearbeiten/i)).toBeNull();
    expect(screen.queryByText(/Abhängigkeit hinzufügen/i)).toBeNull();
    expect(screen.queryByText(/Tags bearbeiten/i)).toBeNull();
    expect(screen.queryByText(/Löschen/i)).toBeNull();
  });

  it("opens from Gantt bars and duplicates the selected work item", async () => {
    const user = userEvent.setup();
    const onDuplicateWorkItem = vi.fn(async () => undefined);
    const timeline = {
      ...makeTimeline(),
      scheduleFieldRefs: {
        start: "Custom.StartDate2",
        endOrTarget: "Custom.TargetDate2"
      }
    };

    render(
      React.createElement(TimelinePane, {
        timeline,
        showDependencies: true,
        organization: "contoso",
        project: "delivery",
        onDuplicateWorkItem
      })
    );

    fireEvent.contextMenu(screen.getByLabelText("timeline-bar-11"), { clientX: 160, clientY: 180 });
    await user.click(screen.getByRole("menuitem", { name: "Duplizieren" }));

    await waitFor(() => {
      expect(onDuplicateWorkItem).toHaveBeenCalledWith({
        sourceWorkItemId: 11,
        scheduleFieldRefs: {
          start: "Custom.StartDate2",
          endOrTarget: "Custom.TargetDate2"
        }
      });
    });
  });

  it("opens child type selection for mapped bar work item types and confirms the preferred default with Enter", async () => {
    const user = userEvent.setup();
    const onCreateChildWorkItem = vi.fn(async () => undefined);
    const onFetchWorkItemTypes = vi.fn(async () => [
      { name: "Task" },
      { name: "User Story" },
      { name: "Bug" }
    ]);
    const timeline = {
      ...makeTimeline(),
      scheduleFieldRefs: {
        start: "Custom.StartDate2",
        endOrTarget: "Custom.TargetDate2"
      }
    };
    timeline.bars[0] = {
      ...timeline.bars[0]!,
      details: {
        ...timeline.bars[0]!.details,
        workItemType: "Feature"
      }
    };

    render(
      React.createElement(TimelinePane, {
        timeline,
        showDependencies: true,
        organization: "contoso",
        project: "delivery",
        canCreateChildWorkItem: true,
        onCreateChildWorkItem,
        onFetchWorkItemTypes
      })
    );

    fireEvent.contextMenu(screen.getByLabelText("timeline-bar-11"), { clientX: 160, clientY: 180 });
    const childMenuButton = screen.getByRole("menuitem", { name: "Child hinzufügen" });
    fireEvent.keyDown(childMenuButton, { key: "Enter" });
    const userStoryOption = await screen.findByRole("menuitem", { name: "User Story" });

    await waitFor(() => {
      expect(document.activeElement).toBe(userStoryOption);
    });
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(onFetchWorkItemTypes).toHaveBeenCalled();
      expect(onCreateChildWorkItem).toHaveBeenCalledWith({
        parentWorkItemId: 11,
        childWorkItemType: "User Story",
        scheduleFieldRefs: {
          start: "Custom.StartDate2",
          endOrTarget: "Custom.TargetDate2"
        }
      });
    });
  });

  it("shows child-create actions for mapped unscheduled work item types", async () => {
    const user = userEvent.setup();
    const onCreateChildWorkItem = vi.fn(async () => undefined);
    const onFetchWorkItemTypes = vi.fn(async () => [
      { name: "Bug" },
      { name: "Task" }
    ]);
    const timeline = makeTimeline();
    timeline.unschedulable[0] = {
      ...timeline.unschedulable[0]!,
      details: {
        ...timeline.unschedulable[0]!.details,
        workItemType: "User Story"
      }
    };

    render(
      React.createElement(TimelinePane, {
        timeline,
        showDependencies: true,
        organization: "contoso",
        project: "delivery",
        canCreateChildWorkItem: true,
        onCreateChildWorkItem,
        onFetchWorkItemTypes
      })
    );

    fireEvent.contextMenu(screen.getByRole("button", { name: /#22 Target Item/ }), { clientX: 120, clientY: 140 });
    await user.click(screen.getByRole("menuitem", { name: "Child hinzufügen" }));
    await user.click(await screen.findByRole("menuitem", { name: "Task" }));

    await waitFor(() => {
      expect(onCreateChildWorkItem).toHaveBeenCalledWith({
        parentWorkItemId: 22,
        childWorkItemType: "Task"
      });
    });
  });

  it("falls back to the first alphabetic child type when the preferred type is unavailable", async () => {
    const user = userEvent.setup();
    const onCreateChildWorkItem = vi.fn(async () => undefined);
    const onFetchWorkItemTypes = vi.fn(async () => [
      { name: "Task" },
      { name: "Bug" }
    ]);
    const timeline = makeTimeline();
    timeline.bars[0] = {
      ...timeline.bars[0]!,
      details: {
        ...timeline.bars[0]!.details,
        workItemType: "Feature"
      }
    };

    render(
      React.createElement(TimelinePane, {
        timeline,
        showDependencies: true,
        organization: "contoso",
        project: "delivery",
        canCreateChildWorkItem: true,
        onCreateChildWorkItem,
        onFetchWorkItemTypes
      })
    );

    fireEvent.contextMenu(screen.getByLabelText("timeline-bar-11"), { clientX: 160, clientY: 180 });
    await user.click(screen.getByRole("menuitem", { name: "Child hinzufügen" }));
    const bugOption = await screen.findByRole("menuitem", { name: "Bug" });

    await waitFor(() => {
      expect(document.activeElement).toBe(bugOption);
    });
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(onCreateChildWorkItem).toHaveBeenCalledWith({
        parentWorkItemId: 11,
        childWorkItemType: "Bug"
      });
    });
  });

  it("shows an empty state when no child work item types are available", async () => {
    const user = userEvent.setup();
    const onCreateChildWorkItem = vi.fn(async () => undefined);
    const onFetchWorkItemTypes = vi.fn(async () => []);

    render(
      React.createElement(TimelinePane, {
        timeline: makeTimeline(),
        showDependencies: true,
        organization: "contoso",
        project: "delivery",
        canCreateChildWorkItem: true,
        onCreateChildWorkItem,
        onFetchWorkItemTypes
      })
    );

    fireEvent.contextMenu(screen.getByLabelText("timeline-bar-11"), { clientX: 160, clientY: 180 });
    await user.click(screen.getByRole("menuitem", { name: "Child hinzufügen" }));

    expect(await screen.findByText("Keine Work Item Types verfügbar.")).toBeTruthy();
    expect(onCreateChildWorkItem).not.toHaveBeenCalled();
  });

  it("shows child-create actions for parent types without hierarchy preferences when fetcher exists", () => {
    const onCreateChildWorkItem = vi.fn(async () => undefined);
    const onFetchWorkItemTypes = vi.fn(async () => [
      { name: "Task" }
    ]);
    const taskTimeline = makeTimeline();
    taskTimeline.bars[0] = {
      ...taskTimeline.bars[0]!,
      details: {
        ...taskTimeline.bars[0]!.details,
        workItemType: "Task"
      }
    };

    const { rerender } = render(
      React.createElement(TimelinePane, {
        timeline: taskTimeline,
        showDependencies: true,
        organization: "contoso",
        project: "delivery",
        canCreateChildWorkItem: true,
        onCreateChildWorkItem,
        onFetchWorkItemTypes
      })
    );

    fireEvent.contextMenu(screen.getByLabelText("timeline-bar-11"), { clientX: 160, clientY: 180 });
    expect(screen.getByRole("menuitem", { name: "Child hinzufügen" })).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    const unknownTimeline = makeTimeline();
    unknownTimeline.bars[0] = {
      ...unknownTimeline.bars[0]!,
      details: {
        ...unknownTimeline.bars[0]!.details,
        workItemType: "Bug"
      }
    };
    rerender(
      React.createElement(TimelinePane, {
        timeline: unknownTimeline,
        showDependencies: true,
        organization: "contoso",
        project: "delivery",
        canCreateChildWorkItem: true,
        onCreateChildWorkItem,
        onFetchWorkItemTypes
      })
    );

    fireEvent.contextMenu(screen.getByLabelText("timeline-bar-11"), { clientX: 160, clientY: 180 });
    expect(screen.getByRole("menuitem", { name: "Child hinzufügen" })).toBeTruthy();
  });

  it("does not show child-create actions when writeback capability is disabled", () => {
    const onCreateChildWorkItem = vi.fn(async () => undefined);
    const timeline = makeTimeline();
    timeline.bars[0] = {
      ...timeline.bars[0]!,
      details: {
        ...timeline.bars[0]!.details,
        workItemType: "Feature"
      }
    };

    render(
      React.createElement(TimelinePane, {
        timeline,
        showDependencies: true,
        organization: "contoso",
        project: "delivery",
        canCreateChildWorkItem: false,
        onCreateChildWorkItem
      })
    );

    fireEvent.contextMenu(screen.getByLabelText("timeline-bar-11"), { clientX: 160, clientY: 180 });

    expect(screen.queryByRole("menuitem", { name: "Child hinzufügen" })).toBeNull();
  });

  it("loads state options and applies a state-only update", async () => {
    const user = userEvent.setup();
    const onUpdateWorkItemState = vi.fn(async () => undefined);
    const onFetchWorkItemStateOptions = vi.fn(async () => [
      { name: "Active", color: "007acc" },
      { name: "Closed", color: "339933" }
    ]);

    render(
      React.createElement(TimelinePane, {
        timeline: makeTimeline(),
        showDependencies: true,
        organization: "contoso",
        project: "delivery",
        onUpdateWorkItemState,
        onFetchWorkItemStateOptions
      })
    );

    fireEvent.contextMenu(screen.getByLabelText("timeline-sidebar-row-11"), { clientX: 120, clientY: 140 });
    await user.click(screen.getByRole("menuitem", { name: "Status ändern" }));

    expect(onFetchWorkItemStateOptions).toHaveBeenCalledWith({ targetWorkItemId: 11 });
    await user.click(await screen.findByRole("menuitem", { name: /Closed/ }));

    await waitFor(() => {
      expect(onUpdateWorkItemState).toHaveBeenCalledWith({
        targetWorkItemId: 11,
        state: "Closed",
        stateColor: "339933"
      });
    });
  });

  it("does not expose fallback state mutations while server state options are loading", async () => {
    const user = userEvent.setup();
    const onUpdateWorkItemState = vi.fn(async () => undefined);
    const stateOptions = createDeferred<WorkItemStateOption[]>();
    const onFetchWorkItemStateOptions = vi.fn(() => stateOptions.promise);

    render(
      React.createElement(TimelinePane, {
        timeline: makeTimeline(),
        showDependencies: true,
        organization: "contoso",
        project: "delivery",
        onUpdateWorkItemState,
        onFetchWorkItemStateOptions
      })
    );

    fireEvent.contextMenu(screen.getByLabelText("timeline-sidebar-row-11"), { clientX: 120, clientY: 140 });
    await user.click(screen.getByRole("menuitem", { name: "Status ändern" }));

    expect(await screen.findByText("Status werden geladen...")).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Done" })).toBeNull();
    expect(onUpdateWorkItemState).not.toHaveBeenCalled();

    stateOptions.resolve([{ name: "Closed", color: "339933" }]);
    await user.click(await screen.findByRole("menuitem", { name: "Closed" }));

    await waitFor(() => {
      expect(onUpdateWorkItemState).toHaveBeenCalledWith({
        targetWorkItemId: 11,
        state: "Closed",
        stateColor: "339933"
      });
    });
  });

  it("does not expose fallback state mutations after server state options fail", async () => {
    const user = userEvent.setup();
    const onUpdateWorkItemState = vi.fn(async () => undefined);
    const onFetchWorkItemStateOptions = vi.fn(async () => {
      throw new Error("State options unavailable");
    });

    render(
      React.createElement(TimelinePane, {
        timeline: makeTimeline(),
        showDependencies: true,
        organization: "contoso",
        project: "delivery",
        onUpdateWorkItemState,
        onFetchWorkItemStateOptions
      })
    );

    fireEvent.contextMenu(screen.getByLabelText("timeline-sidebar-row-11"), { clientX: 120, clientY: 140 });
    await user.click(screen.getByRole("menuitem", { name: "Status ändern" }));

    expect(await screen.findByText("State options unavailable")).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Done" })).toBeNull();
    expect(onUpdateWorkItemState).not.toHaveBeenCalled();
  });

  it("keeps context-menu state changes unavailable when no state-option fetcher exists", async () => {
    const user = userEvent.setup();
    const onUpdateWorkItemState = vi.fn(async () => undefined);

    render(
      React.createElement(TimelinePane, {
        timeline: makeTimeline(),
        showDependencies: true,
        organization: "contoso",
        project: "delivery",
        onUpdateWorkItemState
      })
    );

    fireEvent.contextMenu(screen.getByLabelText("timeline-sidebar-row-11"), { clientX: 120, clientY: 140 });
    const statusButton = screen.getByRole("menuitem", { name: "Status ändern" }) as HTMLButtonElement;

    expect(statusButton.disabled).toBe(true);
    await user.click(statusButton);

    expect(screen.queryByRole("menu", { name: "Status ändern" })).toBeNull();
    expect(onUpdateWorkItemState).not.toHaveBeenCalled();
  });

  it("opens from keyboard context menu keys on bars and unscheduled list items", () => {
    render(
      React.createElement(TimelinePane, {
        timeline: makeTimeline(),
        showDependencies: true,
        organization: "contoso",
        project: "delivery"
      })
    );

    fireEvent.keyDown(screen.getByLabelText("timeline-bar-11"), { key: "ContextMenu" });
    expect(screen.getByRole("menu", { name: /Work item #11 context menu/ })).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.keyDown(screen.getByRole("button", { name: /#22 Target Item/ }), { key: "F10", shiftKey: true });
    expect(screen.getByRole("menu", { name: /Work item #22 context menu/ })).toBeTruthy();
  });

  it("dismisses on Escape and outside pointer down", async () => {
    render(
      React.createElement(TimelinePane, {
        timeline: makeTimeline(),
        showDependencies: true,
        organization: "contoso",
        project: "delivery"
      })
    );

    fireEvent.contextMenu(screen.getByLabelText("timeline-sidebar-row-11"), { clientX: 120, clientY: 140 });
    expect(screen.getByRole("menu", { name: /Work item #11 context menu/ })).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("menu", { name: /Work item #11 context menu/ })).toBeNull();
    });

    fireEvent.contextMenu(screen.getByLabelText("timeline-sidebar-row-11"), { clientX: 120, clientY: 140 });
    fireEvent.pointerDown(document.body);
    await waitFor(() => {
      expect(screen.queryByRole("menu", { name: /Work item #11 context menu/ })).toBeNull();
    });
  });

  it("does not start selection or schedule drag on non-left pointer events", () => {
    const onUpdateWorkItemSchedule = vi.fn(async () => undefined);

    render(
      React.createElement(TimelinePane, {
        timeline: makeTimeline(),
        showDependencies: true,
        onUpdateWorkItemSchedule
      })
    );

    const chart = screen.getByLabelText("gantt-chart");
    const bar = screen.getByLabelText("timeline-bar-11");

    fireEvent.pointerDown(bar, { pointerId: 1, button: 2, clientX: 100 });
    fireEvent.pointerMove(chart, { pointerId: 1, clientX: 130 });
    fireEvent.pointerUp(chart, { pointerId: 1, clientX: 130 });

    expect(onUpdateWorkItemSchedule).not.toHaveBeenCalled();
    expect(bar.getAttribute("aria-current")).toBeNull();
  });
});
