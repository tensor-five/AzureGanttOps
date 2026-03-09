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
    state: string;
    stateColor: string | null;
  }) => Promise<void>;
  onFetchWorkItemStateOptions?: (input: { targetWorkItemId: number }) => Promise<Array<{ name: string; color: string | null }>>;
};

const KNOWN_STATE_ORDER = ["To Do", "New", "Active", "Resolved", "Closed", "Done"];

export function TimelineDetailsPanel(props: TimelineDetailsPanelProps): React.ReactElement {
  const collapsed = props.collapsed ?? false;
  const selected = resolveSelectedWorkItem(props.timeline, props.selectedWorkItemId);
  const [titleDraft, setTitleDraft] = React.useState("");
  const [descriptionDraft, setDescriptionDraft] = React.useState("");
  const [stateDraft, setStateDraft] = React.useState("");
  const [serverStateOptions, setServerStateOptions] = React.useState<Array<{ name: string; color: string | null }>>([]);
  const [isDescriptionEditing, setIsDescriptionEditing] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const descriptionFieldRef = React.useRef<HTMLDivElement | null>(null);
  const descriptionRef = React.useRef<HTMLDivElement | null>(null);
  const hasFetchedInitialStateOptionsRef = React.useRef(false);

  React.useEffect(() => {
    if (!selected) {
      setTitleDraft("");
      setDescriptionDraft("");
      setStateDraft("");
      setIsDescriptionEditing(false);
      setSaveError(null);
      if (descriptionRef.current) {
        descriptionRef.current.innerHTML = "";
      }
      return;
    }

    setTitleDraft(selected.title);
    setDescriptionDraft(selected.descriptionHtml);
    setStateDraft(selected.state);
    setIsDescriptionEditing(false);
    setSaveError(null);
    if (descriptionRef.current) {
      descriptionRef.current.innerHTML = selected.descriptionHtml;
    }
  }, [selected?.workItemId]);

  React.useEffect(() => {
    if (hasFetchedInitialStateOptionsRef.current || !selected || !props.onFetchWorkItemStateOptions) {
      return;
    }

    let cancelled = false;
    hasFetchedInitialStateOptionsRef.current = true;
    void props
      .onFetchWorkItemStateOptions({ targetWorkItemId: selected.workItemId })
      .then((states) => {
        if (cancelled) {
          return;
        }
        setServerStateOptions(states.filter((state) => state.name.trim().length > 0));
      })
      .catch(() => {
        if (!cancelled) {
          setServerStateOptions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [props.onFetchWorkItemStateOptions, selected?.workItemId]);

  const lines = buildTimelineDetailsLines(props);
  const entries = lines
    .map((line) => parseTimelineDetailLine(line))
    .filter((entry): entry is { label: string; value: string } => entry !== null)
    .filter((entry) => !["selected work item", "mapped id", "missing boundary", "title"].includes(entry.label.toLowerCase()))
    .map((entry, index) =>
      React.createElement(
        "div",
        { key: `${index}-${entry.label}`, className: "timeline-details-row" },
        React.createElement("span", { className: "timeline-details-row-label" }, `${entry.label}:`),
        React.createElement("span", { className: "timeline-details-row-value" }, formatTimelineDetailValue(entry.label, entry.value))
      )
    );

  const baselineTitle = selected?.title ?? "";
  const baselineDescription = selected?.descriptionHtml ?? "";
  const baselineState = selected?.state ?? "";
  const isDirty =
    titleDraft.trim() !== baselineTitle.trim() || descriptionDraft !== baselineDescription || stateDraft.trim() !== baselineState.trim();

  const azureLink = selected
    ? buildAzureWorkItemUrl({
        organization: props.organization,
        project: props.project,
        workItemId: selected.workItemId
      })
    : null;

  const stateOptions = React.useMemo(
    () => resolveStateOptions(props.timeline, selected?.state ?? "", serverStateOptions),
    [props.timeline, selected?.state, serverStateOptions]
  );
  const selectedStateColor =
    stateOptions.find((option) => option.name.toLowerCase() === stateDraft.trim().toLowerCase())?.color ?? null;

  const applyDescriptionCommand = (command: string, value?: string) => {
    if (!descriptionRef.current) {
      return;
    }

    descriptionRef.current.focus();
    document.execCommand(command, false, value);
    setDescriptionDraft(descriptionRef.current.innerHTML);
  };

  const saveDetails = async () => {
    if (
      !selected ||
      !props.onUpdateSelectedWorkItemDetails ||
      titleDraft.trim().length === 0 ||
      stateDraft.trim().length === 0 ||
      !isDirty
    ) {
      return;
    }

    setSaveError(null);
    setIsSaving(true);

    try {
      await props.onUpdateSelectedWorkItemDetails({
        targetWorkItemId: selected.workItemId,
        title: titleDraft.trim(),
        descriptionHtml: descriptionDraft,
        state: stateDraft.trim(),
        stateColor: selectedStateColor
      });
      setTitleDraft(titleDraft.trim());
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Saving details failed.");
    } finally {
      setIsSaving(false);
    }
  };

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "s" || (!event.ctrlKey && !event.metaKey)) {
        return;
      }

      event.preventDefault();
      void saveDetails();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [saveDetails]);

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
        "div",
        { className: "timeline-details-panel-head-main" },
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
          React.createElement(
            "svg",
            {
              viewBox: "0 0 16 16",
              "aria-hidden": "true",
              className: "timeline-details-collapse-icon"
            },
            collapsed
              ? React.createElement(
                  React.Fragment,
                  null,
                  React.createElement("path", { d: "M6 8H2", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }),
                  React.createElement("path", { d: "m4 5-2 3 2 3", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }),
                  React.createElement("path", { d: "M10 8h4", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }),
                  React.createElement("path", { d: "m12 5 2 3-2 3", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" })
                )
              : React.createElement(
                  React.Fragment,
                  null,
                  React.createElement("path", { d: "M2 8h4", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }),
                  React.createElement("path", { d: "m4 5 2 3-2 3", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }),
                  React.createElement("path", { d: "M14 8h-4", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }),
                  React.createElement("path", { d: "m12 5-2 3 2 3", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" })
                )
          )
        ),
        collapsed || !selected
          ? null
          : React.createElement(
              "button",
                {
                  type: "button",
                  className: isDirty
                    ? "timeline-action-button timeline-details-save-button timeline-details-save-button-dirty"
                    : "timeline-action-button timeline-details-save-button",
                  onClick: () => {
                    void saveDetails();
                  },
                disabled:
                  isSaving ||
                  !isDirty ||
                  titleDraft.trim().length === 0 ||
                  stateDraft.trim().length === 0 ||
                  !props.onUpdateSelectedWorkItemDetails
              },
              isSaving ? "Saving..." : "Save"
            )
      ),
      collapsed
        ? null
        : selected
          ? React.createElement(
              "div",
              { className: "timeline-details-head-actions" },
              azureLink
                ? React.createElement(
                    "a",
                    {
                      className: "timeline-details-work-item-id timeline-details-work-item-link",
                      href: azureLink,
                      target: "_blank",
                      rel: "noreferrer"
                    },
                    `#${selected.workItemId}`
                  )
                : React.createElement("span", { className: "timeline-details-work-item-id" }, `#${selected.workItemId}`)
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
              "label",
              { className: "timeline-details-field" },
              React.createElement("span", { className: "timeline-details-label" }, "State"),
              React.createElement(
                "select",
                {
                  className: "timeline-details-input",
                  value: stateDraft,
                  onChange: (event) => {
                    setStateDraft((event.target as HTMLSelectElement).value);
                  }
                },
                ...stateOptions.map((option) => React.createElement("option", { key: option.name, value: option.name }, option.name))
              )
            ),
            React.createElement(
              "div",
              { className: "timeline-details-field", ref: descriptionFieldRef },
              React.createElement("span", { className: "timeline-details-label" }, "Description"),
              isDescriptionEditing
                ? React.createElement(
                    "div",
                    { className: "timeline-richtext-toolbar", role: "group", "aria-label": "Rich text controls" },
                    React.createElement(
                      "button",
                      { type: "button", className: "timeline-richtext-button", onClick: () => applyDescriptionCommand("bold") },
                      "B"
                    ),
                    React.createElement(
                      "button",
                      { type: "button", className: "timeline-richtext-button", onClick: () => applyDescriptionCommand("italic") },
                      "I"
                    ),
                    React.createElement(
                      "button",
                      { type: "button", className: "timeline-richtext-button", onClick: () => applyDescriptionCommand("underline") },
                      "U"
                    ),
                    React.createElement(
                      "button",
                      {
                        type: "button",
                        className: "timeline-richtext-button",
                        onClick: () => applyDescriptionCommand("insertOrderedList")
                      },
                      "1."
                    ),
                    React.createElement(
                      "button",
                      {
                        type: "button",
                        className: "timeline-richtext-button",
                        onClick: () => applyDescriptionCommand("insertUnorderedList")
                      },
                      "•"
                    ),
                    React.createElement(
                      "button",
                      {
                        type: "button",
                        className: "timeline-richtext-button",
                        onClick: () => applyDescriptionCommand("formatBlock", "<h2>")
                      },
                      "H2"
                    ),
                    React.createElement(
                      "button",
                      {
                        type: "button",
                        className: "timeline-richtext-button",
                        onClick: () => applyDescriptionCommand("formatBlock", "<blockquote>")
                      },
                      "Quote"
                    ),
                    React.createElement(
                      "button",
                      {
                        type: "button",
                        className: "timeline-richtext-button",
                        onClick: () => {
                          const url = window.prompt("Link URL", "https://");
                          if (url && url.trim().length > 0) {
                            applyDescriptionCommand("createLink", url.trim());
                          }
                        }
                      },
                      "Link"
                    ),
                    React.createElement(
                      "button",
                      { type: "button", className: "timeline-richtext-button", onClick: () => applyDescriptionCommand("removeFormat") },
                      "Clear"
                    )
                  )
                : React.createElement(
                    "p",
                    { className: "timeline-details-muted timeline-description-edit-hint" },
                    "Click description to edit"
                  ),
              React.createElement("div", {
                ref: descriptionRef,
                className: isDescriptionEditing
                  ? "timeline-details-richtext timeline-details-richtext-editing"
                  : "timeline-details-richtext timeline-details-richtext-readonly",
                contentEditable: isDescriptionEditing,
                suppressContentEditableWarning: true,
                onClick: () => {
                  if (!isDescriptionEditing) {
                    setIsDescriptionEditing(true);
                    requestAnimationFrame(() => {
                      descriptionRef.current?.focus();
                    });
                  }
                },
                onInput: (event) => {
                  setDescriptionDraft((event.target as HTMLDivElement).innerHTML);
                },
                onBlur: () => {
                  requestAnimationFrame(() => {
                    const activeElement = document.activeElement;
                    if (descriptionFieldRef.current && activeElement && descriptionFieldRef.current.contains(activeElement)) {
                      return;
                    }
                    setIsDescriptionEditing(false);
                  });
                }
              })
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
        : React.createElement("p", { className: "timeline-details-muted" }, "Select a work item to edit title and description."),
    collapsed ? null : React.createElement("div", { className: "timeline-details-list", role: "list" }, ...entries),
    React.createElement("pre", { className: "timeline-details-raw", "aria-hidden": "true" }, lines.join("\n"))
  );
}

export function buildTimelineDetailsLines(input: TimelineDetailsPanelProps): string[] {
  if (!input.timeline || input.selectedWorkItemId === null) {
    return [];
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

  return [];
}

function resolveSelectedWorkItem(
  timeline: TimelineReadModel | null,
  selectedWorkItemId: number | null
): { workItemId: number; title: string; descriptionHtml: string; state: string } | null {
  if (!timeline || selectedWorkItemId === null) {
    return null;
  }

  const selectedBar = timeline.bars.find((bar) => bar.workItemId === selectedWorkItemId);
  if (selectedBar) {
    return {
      workItemId: selectedBar.workItemId,
      title: selectedBar.title,
      descriptionHtml: selectedBar.details.descriptionHtml ?? "",
      state: selectedBar.state.code
    };
  }

  const selectedUnschedulable = timeline.unschedulable.find((item) => item.workItemId === selectedWorkItemId);
  if (selectedUnschedulable) {
    return {
      workItemId: selectedUnschedulable.workItemId,
      title: selectedUnschedulable.title,
      descriptionHtml: selectedUnschedulable.details.descriptionHtml ?? "",
      state: selectedUnschedulable.state.code
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

function formatTimelineDetailValue(label: string, value: string): string {
  const normalizedLabel = label.trim().toLowerCase();
  if (normalizedLabel === "start" || normalizedLabel === "end") {
    return formatDateForDisplay(value);
  }

  return value;
}

function formatDateForDisplay(raw: string): string {
  if (raw === "none") {
    return raw;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }

  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

function resolveStateOptions(
  timeline: TimelineReadModel | null,
  selectedState: string,
  serverStateOptions: Array<{ name: string; color: string | null }>
): Array<{ name: string; color: string | null }> {
  if (serverStateOptions.length > 0) {
    const normalizedServerOptions = serverStateOptions
      .map((state) => ({ name: state.name.trim(), color: state.color }))
      .filter((state) => state.name.length > 0);
    if (
      selectedState.trim().length > 0 &&
      !normalizedServerOptions.some((entry) => entry.name.toLowerCase() === selectedState.trim().toLowerCase())
    ) {
      normalizedServerOptions.unshift({ name: selectedState.trim(), color: null });
    }
    return normalizedServerOptions;
  }

  const discovered = new Set<string>();
  timeline?.bars.forEach((bar) => {
    if (bar.state.code.trim().length > 0) {
      discovered.add(bar.state.code.trim());
    }
  });
  timeline?.unschedulable.forEach((item) => {
    if (item.state.code.trim().length > 0) {
      discovered.add(item.state.code.trim());
    }
  });

  if (selectedState.trim().length > 0) {
    discovered.add(selectedState.trim());
  }

  const result: Array<{ name: string; color: string | null }> = [];
  KNOWN_STATE_ORDER.forEach((state) => {
    result.push({ name: state, color: null });
    discovered.delete(state);
  });

  [...discovered].sort((left, right) => left.localeCompare(right)).forEach((state) => {
    result.push({ name: state, color: null });
  });

  return result.length > 0 ? result : [{ name: selectedState || "To Do", color: null }];
}
