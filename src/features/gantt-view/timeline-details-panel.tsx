import React from "react";

import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";
import { sanitizeHtmlFragment } from "../../shared/security/sanitize-html-fragment.js";

export type TimelineDetailsPanelProps = {
  timeline: TimelineReadModel | null;
  selectedWorkItemId: number | null;
  contentHidden?: boolean;
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
  onDirtyChange?: (dirty: boolean) => void;
};

const KNOWN_STATE_ORDER = ["To Do", "New", "Active", "Resolved", "Closed", "Done"];

export function TimelineDetailsPanel(props: TimelineDetailsPanelProps): React.ReactElement {
  const contentHidden = props.contentHidden ?? false;
  const selected = resolveSelectedWorkItem(props.timeline, props.selectedWorkItemId);
  const [titleDraft, setTitleDraft] = React.useState("");
  const [descriptionDraft, setDescriptionDraft] = React.useState("");
  const [stateDraft, setStateDraft] = React.useState("");
  const [serverStateOptions, setServerStateOptions] = React.useState<Array<{ name: string; color: string | null }>>([]);
  const [isDescriptionEditing, setIsDescriptionEditing] = React.useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = React.useState(false);
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
      setIsDescriptionExpanded(false);
      setSaveError(null);
      if (descriptionRef.current) {
        descriptionRef.current.innerHTML = "";
      }
      return;
    }

    const sanitizedDescription = sanitizeHtmlFragment(selected.descriptionHtml);
    setTitleDraft(selected.title);
    setDescriptionDraft(sanitizedDescription);
    setStateDraft(selected.state);
    setIsDescriptionEditing(false);
    setIsDescriptionExpanded(false);
    setSaveError(null);
    if (descriptionRef.current) {
      descriptionRef.current.innerHTML = sanitizedDescription;
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
  const iterationFallback = selected?.iterationFallback ?? null;
  const entries = lines
    .map((line) => parseTimelineDetailLine(line))
    .filter((entry): entry is { label: string; value: string } => entry !== null)
    .filter((entry) => !["selected work item", "mapped id", "missing boundary", "title"].includes(entry.label.toLowerCase()))
    .map((entry, index) => {
      const normalizedLabel = entry.label.trim().toLowerCase();
      const isStartRow = normalizedLabel === "start";
      const isEndRow = normalizedLabel === "end";
      const showIterationHint =
        (isStartRow && (iterationFallback === "start" || iterationFallback === "both")) ||
        (isEndRow && (iterationFallback === "end" || iterationFallback === "both"));
      return React.createElement(
        "div",
        { key: `${index}-${entry.label}`, className: "timeline-details-row" },
        React.createElement("span", { className: "timeline-details-row-label" }, `${entry.label}:`),
        React.createElement("span", { className: "timeline-details-row-value" }, formatTimelineDetailValue(entry.label, entry.value)),
        showIterationHint
          ? React.createElement(
              "span",
              {
                className: "timeline-details-row-hint timeline-details-row-hint-iteration",
                title: "Date inherited from the iteration; not set on this work item"
              },
              "from iteration"
            )
          : null
      );
    });

  const baselineTitle = selected?.title ?? "";
  const baselineDescription = sanitizeHtmlFragment(selected?.descriptionHtml ?? "");
  const baselineState = selected?.state ?? "";
  const isDirty =
    titleDraft.trim() !== baselineTitle.trim() || descriptionDraft !== baselineDescription || stateDraft.trim() !== baselineState.trim();

  React.useEffect(() => {
    props.onDirtyChange?.(isDirty);
  }, [isDirty]);

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
  const hasDescriptionContent = stripHtmlToText(descriptionDraft).length > 0;

  const applyDescriptionCommand = (command: string, value?: string) => {
    if (!descriptionRef.current) {
      return;
    }

    descriptionRef.current.focus();
    document.execCommand(command, false, value);
    setDescriptionDraft(sanitizeHtmlFragment(descriptionRef.current.innerHTML));
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
        descriptionHtml: sanitizeHtmlFragment(descriptionDraft),
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

      if (
        !selected ||
        !props.onUpdateSelectedWorkItemDetails ||
        titleDraft.trim().length === 0 ||
        stateDraft.trim().length === 0 ||
        !isDirty
      ) {
        return;
      }

      event.preventDefault();
      void saveDetails();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isDirty, props.onUpdateSelectedWorkItemDetails, saveDetails, selected, stateDraft, titleDraft]);

  return React.createElement(
    "aside",
    {
      "aria-label": "timeline-details-panel",
      className: contentHidden
        ? "timeline-details-panel-surface timeline-details-panel-surface-content-hidden"
        : "timeline-details-panel-surface"
    },
    React.createElement(
      "div",
      { className: "timeline-details-panel-head" },
      React.createElement(
        "div",
        { className: "timeline-details-panel-head-main" },
        !selected || contentHidden
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
      contentHidden
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
                    `#${selected.workItemId}`,
                    React.createElement(
                      "svg",
                      {
                        className: "timeline-details-work-item-link-icon",
                        viewBox: "0 0 16 16",
                        "aria-hidden": "true"
                      },
                      React.createElement("path", {
                        d: "M6 10 11.5 4.5M8.5 4.5h3v3M10.5 8.5v2a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 10.5V7a1.5 1.5 0 0 1 1.5-1.5h2",
                        fill: "none",
                        stroke: "currentColor",
                        strokeWidth: "1.6",
                        strokeLinecap: "round",
                        strokeLinejoin: "round"
                      })
                    )
                  )
                : React.createElement("span", { className: "timeline-details-work-item-id" }, `#${selected.workItemId}`)
            )
          : null
    ),
    contentHidden
      ? React.createElement(
          "p",
          { className: "timeline-details-hidden-hint" },
          "Details hidden. Drag the panel wider to show details."
        )
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
                    "div",
                    { className: "timeline-description-readonly-head" },
                    React.createElement(
                      "p",
                      { className: "timeline-details-muted timeline-description-edit-hint" },
                      "Click description to edit"
                    ),
                    hasDescriptionContent
                      ? React.createElement(
                          "button",
                          {
                            type: "button",
                            className: "timeline-description-toggle",
                            "aria-expanded": isDescriptionExpanded,
                            onClick: (event) => {
                              event.stopPropagation();
                              setIsDescriptionExpanded((current) => !current);
                            }
                          },
                          isDescriptionExpanded ? "Show less" : "Show more"
                        )
                      : null
                  ),
              React.createElement("div", {
                ref: descriptionRef,
                className: [
                  "timeline-details-richtext",
                  isDescriptionEditing ? "timeline-details-richtext-editing" : "timeline-details-richtext-readonly",
                  !isDescriptionEditing && !isDescriptionExpanded ? "timeline-details-richtext-collapsed" : null
                ]
                  .filter(Boolean)
                  .join(" "),
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
                  const target = event.target as HTMLDivElement;
                  const sanitized = sanitizeHtmlFragment(target.innerHTML);
                  if (sanitized !== target.innerHTML) {
                    target.innerHTML = sanitized;
                  }
                  setDescriptionDraft(sanitized);
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
    contentHidden ? null : React.createElement("div", { className: "timeline-details-list", role: "list" }, ...entries),
    contentHidden ? null : React.createElement("pre", { className: "timeline-details-raw", "aria-hidden": "true" }, lines.join("\n"))
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
): {
  workItemId: number;
  title: string;
  descriptionHtml: string;
  state: string;
  iterationFallback: "start" | "end" | "both" | null;
} | null {
  if (!timeline || selectedWorkItemId === null) {
    return null;
  }

  const selectedBar = timeline.bars.find((bar) => bar.workItemId === selectedWorkItemId);
  if (selectedBar) {
    return {
      workItemId: selectedBar.workItemId,
      title: selectedBar.title,
      descriptionHtml: selectedBar.details.descriptionHtml ?? "",
      state: selectedBar.state.code,
      iterationFallback: selectedBar.schedule.iterationFallback ?? null
    };
  }

  const selectedUnschedulable = timeline.unschedulable.find((item) => item.workItemId === selectedWorkItemId);
  if (selectedUnschedulable) {
    return {
      workItemId: selectedUnschedulable.workItemId,
      title: selectedUnschedulable.title,
      descriptionHtml: selectedUnschedulable.details.descriptionHtml ?? "",
      state: selectedUnschedulable.state.code,
      iterationFallback: null
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

function stripHtmlToText(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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
