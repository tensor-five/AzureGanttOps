import React from "react";

import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";

export type TimelineDetailsPanelProps = {
  timeline: TimelineReadModel | null;
  selectedWorkItemId: number | null;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  organization?: string;
  project?: string;
  onUpdateSelectedWorkItemDetails?: (input: {
    targetWorkItemId: number;
    title: string;
    descriptionHtml: string;
  }) => Promise<void>;
};

export function TimelineDetailsPanel(props: TimelineDetailsPanelProps): React.ReactElement {
  const collapsed = props.collapsed ?? false;
  const selected = resolveSelectedWorkItem(props.timeline, props.selectedWorkItemId);
  const [titleDraft, setTitleDraft] = React.useState("");
  const [descriptionDraft, setDescriptionDraft] = React.useState("");
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const descriptionRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!selected) {
      setTitleDraft("");
      setDescriptionDraft("");
      setSaveError(null);
      if (descriptionRef.current) {
        descriptionRef.current.innerHTML = "";
      }
      return;
    }

    setTitleDraft(selected.title);
    setDescriptionDraft(selected.descriptionHtml);
    setSaveError(null);
    if (descriptionRef.current) {
      descriptionRef.current.innerHTML = selected.descriptionHtml;
    }
  }, [selected?.workItemId]);

  const lines = buildTimelineDetailsLines(props);
  const entries = lines.map((line, index) => {
    const parsed = parseTimelineDetailLine(line);
    if (!parsed) {
      return React.createElement(
        "div",
        { key: `${index}-${line}`, className: "timeline-details-note" },
        line.replace(/^- /, "")
      );
    }

    return React.createElement(
      "article",
      { key: `${index}-${line}`, className: "timeline-details-card" },
      React.createElement("p", { className: "timeline-details-card-label" }, parsed.label),
      React.createElement("p", { className: "timeline-details-card-value" }, parsed.value)
    );
  });
  const baselineTitle = selected?.title ?? "";
  const baselineDescription = selected?.descriptionHtml ?? "";
  const isDirty = titleDraft.trim() !== baselineTitle.trim() || descriptionDraft !== baselineDescription;
  const azureLink = selected
    ? buildAzureWorkItemUrl({
        organization: props.organization,
        project: props.project,
        workItemId: selected.workItemId
      })
    : null;

  const applyDescriptionCommand = (command: "bold" | "italic" | "insertUnorderedList") => {
    if (!descriptionRef.current) {
      return;
    }

    descriptionRef.current.focus();
    document.execCommand(command);
  };

  const saveDetails = async () => {
    if (!selected || !props.onUpdateSelectedWorkItemDetails || titleDraft.trim().length === 0 || !isDirty) {
      return;
    }

    setSaveError(null);
    setIsSaving(true);

    try {
      await props.onUpdateSelectedWorkItemDetails({
        targetWorkItemId: selected.workItemId,
        title: titleDraft.trim(),
        descriptionHtml: descriptionDraft
      });
      setTitleDraft(titleDraft.trim());
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Saving details failed.");
    } finally {
      setIsSaving(false);
    }
  };

  return React.createElement(
    "aside",
    {
      "aria-label": "timeline-details-panel",
      className: collapsed
        ? "timeline-details-panel-surface timeline-details-panel-surface-collapsed"
        : "timeline-details-panel-surface"
    },
    React.createElement(
      "div",
      { className: "timeline-details-panel-head" },
      React.createElement(
        "button",
        {
          type: "button",
          className: "timeline-details-collapse-toggle",
          "aria-label": collapsed ? "Expand details panel" : "Collapse details panel",
          title: collapsed ? "Expand details panel" : "Collapse details panel",
          onClick: () => {
            props.onToggleCollapsed?.();
          }
        },
        collapsed ? "◀" : "▶"
      ),
      collapsed
        ? null
        : React.createElement("h4", null, "Work item details"),
      collapsed
        ? null
        : selected
          ? React.createElement(
              "span",
              { className: "timeline-details-work-item-id" },
              `#${selected.workItemId}`
            )
          : null
    ),
    collapsed
      ? null
      : selected
      ? React.createElement(
          "div",
          { className: "timeline-details-edit-form" },
          React.createElement(
            "label",
            { className: "timeline-details-field" },
            React.createElement("span", { className: "timeline-details-label" }, "Title"),
            React.createElement("input", {
              type: "text",
              className: "timeline-details-input",
              value: titleDraft,
              onChange: (event) => {
                setTitleDraft((event.target as HTMLInputElement).value);
              }
            })
          ),
          React.createElement(
            "div",
            { className: "timeline-details-field" },
            React.createElement("span", { className: "timeline-details-label" }, "Description"),
            React.createElement(
              "div",
              { className: "timeline-richtext-toolbar", role: "group", "aria-label": "Rich text controls" },
              React.createElement(
                "button",
                {
                  type: "button",
                  className: "timeline-richtext-button",
                  onClick: () => {
                    applyDescriptionCommand("bold");
                  }
                },
                "Bold"
              ),
              React.createElement(
                "button",
                {
                  type: "button",
                  className: "timeline-richtext-button",
                  onClick: () => {
                    applyDescriptionCommand("italic");
                  }
                },
                "Italic"
              ),
              React.createElement(
                "button",
                {
                  type: "button",
                  className: "timeline-richtext-button",
                  onClick: () => {
                    applyDescriptionCommand("insertUnorderedList");
                  }
                },
                "List"
              )
            ),
            React.createElement("div", {
              ref: descriptionRef,
              className: "timeline-details-richtext",
              contentEditable: true,
              suppressContentEditableWarning: true,
              onInput: (event) => {
                setDescriptionDraft((event.target as HTMLDivElement).innerHTML);
              }
            })
          ),
          React.createElement(
            "div",
            { className: "timeline-details-actions" },
            React.createElement(
              "button",
              {
                type: "button",
                className: "timeline-action-button timeline-action-button-primary",
                onClick: () => {
                  void saveDetails();
                },
                disabled: isSaving || !isDirty || titleDraft.trim().length === 0 || !props.onUpdateSelectedWorkItemDetails
              },
              isSaving ? "Saving..." : "Save"
            ),
            azureLink
              ? React.createElement(
                  "a",
                  {
                    className: "timeline-details-azure-link",
                    href: azureLink,
                    target: "_blank",
                    rel: "noreferrer"
                  },
                  "Open in Azure DevOps"
                )
              : React.createElement(
                  "span",
                  { className: "timeline-details-muted" },
                  "Azure link unavailable (missing organization/project)."
                )
          ),
          saveError
            ? React.createElement(
                "p",
                {
                  className: "timeline-update-error",
                  role: "status"
                },
                `Save failed: ${saveError}`
              )
            : null
        )
      : React.createElement(
          "p",
          { className: "timeline-details-muted" },
          "Select a work item to edit title and description."
        ),
    collapsed ? null : React.createElement("div", { className: "timeline-details-list", role: "list" }, ...entries),
    React.createElement("pre", { className: "timeline-details-raw", "aria-hidden": "true" }, lines.join("\n"))
  );
}

export function buildTimelineDetailsLines(input: TimelineDetailsPanelProps): string[] {
  if (!input.timeline || input.selectedWorkItemId === null) {
    return ["- selected: none"];
  }

  const selectedBar = input.timeline.bars.find((bar) => bar.workItemId === input.selectedWorkItemId);
  if (selectedBar) {
    const predecessorCount = input.timeline.dependencies.filter(
      (dependency) => dependency.successorWorkItemId === selectedBar.workItemId
    ).length;
    const successorCount = input.timeline.dependencies.filter(
      (dependency) => dependency.predecessorWorkItemId === selectedBar.workItemId
    ).length;

    return [
      `- selected work item: #${selectedBar.workItemId}`,
      `- mapped id: ${selectedBar.details.mappedId}`,
      `- title: ${selectedBar.title}`,
      `- state: ${selectedBar.state.code}`,
      `- start: ${selectedBar.schedule.startDate ?? "none"}`,
      `- end: ${selectedBar.schedule.endDate ?? "none"}`,
      `- missing boundary: ${selectedBar.schedule.missingBoundary ?? "none"}`,
      `- predecessors: ${predecessorCount}`,
      `- successors: ${successorCount}`
    ];
  }

  const selectedUnschedulable = input.timeline.unschedulable.find(
    (item) => item.workItemId === input.selectedWorkItemId
  );
  if (selectedUnschedulable) {
    return [
      `- selected work item: #${selectedUnschedulable.workItemId}`,
      `- mapped id: ${selectedUnschedulable.details.mappedId}`,
      `- title: ${selectedUnschedulable.title}`,
      `- state: ${selectedUnschedulable.state.code}`,
      `- reason: ${selectedUnschedulable.reason}`
    ];
  }

  return ["- selected: none"];
}

function resolveSelectedWorkItem(
  timeline: TimelineReadModel | null,
  selectedWorkItemId: number | null
): { workItemId: number; title: string; descriptionHtml: string } | null {
  if (!timeline || selectedWorkItemId === null) {
    return null;
  }

  const selectedBar = timeline.bars.find((bar) => bar.workItemId === selectedWorkItemId);
  if (selectedBar) {
    return {
      workItemId: selectedBar.workItemId,
      title: selectedBar.title,
      descriptionHtml: selectedBar.details.descriptionHtml ?? ""
    };
  }

  const selectedUnschedulable = timeline.unschedulable.find((item) => item.workItemId === selectedWorkItemId);
  if (selectedUnschedulable) {
    return {
      workItemId: selectedUnschedulable.workItemId,
      title: selectedUnschedulable.title,
      descriptionHtml: selectedUnschedulable.details.descriptionHtml ?? ""
    };
  }

  return null;
}

function buildAzureWorkItemUrl(input: {
  organization: string | undefined;
  project: string | undefined;
  workItemId: number;
}): string | null {
  const organization = (input.organization ?? "").trim();
  const project = (input.project ?? "").trim();

  if (!organization || !project) {
    return null;
  }

  return `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/_workitems/edit/${input.workItemId}`;
}

function parseTimelineDetailLine(line: string): { label: string; value: string } | null {
  const match = /^- ([^:]+):\s?(.*)$/.exec(line);
  if (!match) {
    return null;
  }

  return {
    label: match[1],
    value: match[2]
  };
}
