import React from "react";

import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";
import type { WorkItemFieldDefinition } from "../../application/dto/work-item-field-definition.js";
import { buildAzureWorkItemUrl } from "../../shared/azure-devops/azure-work-item-url.js";
import type { WorkItemSyncState } from "../../shared/ui-state/work-item-sync-state.js";
import {
  DEFAULT_DETAILS_PANEL_FIELD_IDS,
  DETAILS_FIELD_IDS,
  DEFAULT_SCHEDULE_FIELD_REFS,
  buildDetailsFieldCatalog,
  layoutDetailsFields,
  listWorkItemTypes,
  type DetailsFieldDescriptor,
  type TimelineDetailsItem
} from "./details-panel-field-catalog.js";
import { DetailsPanelFieldConfigMenu } from "./details-panel-field-config-menu.js";
import {
  hydrateDetailsPanelFieldsPreference,
  loadDetailsPanelFields,
  saveDetailsPanelFields
} from "./details-panel-fields-preference.js";
import {
  BOOLEAN_OPTIONS,
  UNASSIGNED_OPTION,
  readDetailsFieldValue,
  toDetailsFieldSaveValue,
  validateDetailsFieldDraft,
  type DetailsFieldSaveValue
} from "./details-panel-field-values.js";
import { DetailsPanelRichTextField } from "./details-panel-rich-text-field.js";
import { GearIcon } from "./gear-icon.js";
import { buildTimelineAssigneeOptions } from "./timeline-assignee-options.js";
import { resolveWorkItemStateOptions } from "./work-item-state-options.js";

export type TimelineDetailsUpdateInput = {
  targetWorkItemId: number;
  fields: Record<string, DetailsFieldSaveValue>;
  htmlFields: string[];
  stateColor: string | null;
};

export type TimelineDetailsPanelProps = {
  timeline: TimelineReadModel | null;
  /** Unfiltered timeline of the active query; source for the field catalog and option lists. */
  catalogTimeline?: TimelineReadModel | null;
  activeQueryId?: string | null;
  selectedWorkItemId: number | null;
  contentHidden?: boolean;
  draftResetKey?: number;
  organization?: string;
  project?: string;
  onUpdateSelectedWorkItemDetails?: (input: TimelineDetailsUpdateInput) => Promise<void>;
  onFetchWorkItemStateOptions?: (input: { targetWorkItemId: number }) => Promise<Array<{ name: string; color: string | null }>>;
  onFetchWorkItemFieldDefinitions?: (input: { workItemTypes: string[] }) => Promise<WorkItemFieldDefinition[]>;
  onDirtyChange?: (dirty: boolean) => void;
  workItemSyncState?: WorkItemSyncState;
};

type FieldDefinitionsState =
  | { key: string; status: "loading" }
  | { key: string; status: "ready"; fields: WorkItemFieldDefinition[] }
  | { key: string; status: "failed" };

export const TIMELINE_DETAILS_KEYBOARD_SHORTCUT_CONTRACTS = ["details.save-or-sync"] as const;

export function TimelineDetailsPanel(props: TimelineDetailsPanelProps): React.ReactElement {
  const contentHidden = props.contentHidden ?? false;
  const catalogTimeline = props.catalogTimeline ?? props.timeline;
  const selected = resolveSelectedWorkItem(props.timeline, props.selectedWorkItemId);
  const shownIds = useDetailsPanelFieldIds();
  const definitionsState = useFieldDefinitions(catalogTimeline, props.activeQueryId ?? null, props.onFetchWorkItemFieldDefinitions);
  const serverStateOptions = useServerStateOptions(selected?.workItemId ?? null, props.onFetchWorkItemStateOptions);
  const [configOpen, setConfigOpen] = React.useState(false);
  const [draftState, setDraftState] = React.useState<{ workItemId: number | null; values: Record<string, string> }>({
    workItemId: null,
    values: {}
  });
  const [failedBaseline, setFailedBaseline] = React.useState<{ workItemId: number; values: Record<string, string> } | null>(
    null
  );
  const [saveError, setSaveError] = React.useState<{ workItemId: number; message: string } | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const configAreaRef = React.useRef<HTMLDivElement | null>(null);
  const configToggleRef = React.useRef<HTMLButtonElement | null>(null);
  const selectedWorkItemId = selected?.workItemId ?? null;
  const selectedWorkItemIdRef = React.useRef<number | null>(selectedWorkItemId);
  selectedWorkItemIdRef.current = selectedWorkItemId;

  const catalog = React.useMemo(
    () =>
      buildDetailsFieldCatalog({
        definitions:
          definitionsState.status === "ready" ? definitionsState.fields : definitionsState.status === "loading" ? [] : null,
        timeline: catalogTimeline
      }),
    [catalogTimeline, definitionsState]
  );

  const visibleFields = React.useMemo(
    () =>
      selected
        ? shownIds.value
            .map((id) => catalog.byId.get(id))
            .filter((field): field is DetailsFieldDescriptor => !!field)
        : [],
    [catalog, selected, shownIds.value]
  );

  const computedBaseline = React.useMemo(() => {
    const values: Record<string, string> = {};
    if (selected) {
      catalog.fields
        .filter((field) => field.editable)
        .forEach((field) => {
          values[field.id] = readDetailsFieldValue(field, selected, catalogTimeline);
        });
    }
    return values;
  }, [catalog, catalogTimeline, selected]);
  const activeFailedBaseline =
    failedBaseline && failedBaseline.workItemId === selectedWorkItemId ? failedBaseline.values : null;
  const baseline = activeFailedBaseline ?? computedBaseline;
  const drafts = draftState.workItemId !== null && draftState.workItemId === selectedWorkItemId ? draftState.values : {};
  const activeSaveError = saveError && saveError.workItemId === selectedWorkItemId ? saveError.message : null;

  // Drafts are reset when the selection or the reset key changes, or when the server value of a
  // field that has a draft changes. Fields that only join the catalog later never reset drafts.
  const previousBaselineRef = React.useRef<{ workItemId: number | null; resetKey: number | undefined; values: Record<string, string> }>({
    workItemId: selectedWorkItemId,
    resetKey: props.draftResetKey,
    values: computedBaseline
  });
  React.useEffect(() => {
    const previous = previousBaselineRef.current;
    previousBaselineRef.current = { workItemId: selectedWorkItemId, resetKey: props.draftResetKey, values: computedBaseline };

    if (previous.workItemId !== selectedWorkItemId || previous.resetKey !== props.draftResetKey) {
      setDraftState({ workItemId: null, values: {} });
      setFailedBaseline(null);
      setSaveError(null);
      return;
    }

    if (isSaving) {
      return;
    }

    const serverChangedDraftedField = Object.keys(drafts).some(
      (id) => previous.values[id] !== undefined && previous.values[id] !== computedBaseline[id]
    );
    if (serverChangedDraftedField && !activeFailedBaseline) {
      setDraftState({ workItemId: null, values: {} });
      setSaveError(null);
    }
  }, [selectedWorkItemId, computedBaseline, props.draftResetKey]);

  React.useEffect(() => {
    if (props.workItemSyncState === "up_to_date" && failedBaseline) {
      setFailedBaseline(null);
      setSaveError(null);
      setDraftState((current) =>
        current.workItemId === failedBaseline.workItemId ? { workItemId: null, values: {} } : current
      );
    }
  }, [props.workItemSyncState]);

  const currentDraft = (id: string): string => drafts[id] ?? baseline[id] ?? "";
  const dirtyFieldIds = Object.keys(drafts).filter((id) => {
    const field = catalog.byId.get(id);
    return !!field && field.editable && drafts[id] !== (baseline[id] ?? "");
  });
  const isDirty = dirtyFieldIds.length > 0;
  const validationErrors = new Map<string, string>();
  dirtyFieldIds.forEach((id) => {
    const field = catalog.byId.get(id);
    const error = field ? validateDetailsFieldDraft(field, currentDraft(id)) : null;
    if (error) {
      validationErrors.set(id, error);
    }
  });
  const titleDraft = currentDraft(DETAILS_FIELD_IDS.title);
  const stateDraft = currentDraft(DETAILS_FIELD_IDS.state);
  const canSave =
    !!selected &&
    !!props.onUpdateSelectedWorkItemDetails &&
    !isSaving &&
    isDirty &&
    validationErrors.size === 0 &&
    titleDraft.trim().length > 0 &&
    stateDraft.trim().length > 0;

  React.useEffect(() => {
    props.onDirtyChange?.(isDirty);
  }, [isDirty]);

  const stateOptions = React.useMemo(
    () =>
      resolveWorkItemStateOptions({
        timeline: catalogTimeline,
        selectedState: selected?.state.code ?? "",
        serverStateOptions
      }),
    [catalogTimeline, selected?.state.code, serverStateOptions]
  );
  const scheduleFieldRefs = catalogTimeline?.scheduleFieldRefs ?? DEFAULT_SCHEDULE_FIELD_REFS;
  const assigneeNames = React.useMemo(
    () => buildTimelineAssigneeOptions(catalogTimeline).map((option) => option.name),
    [catalogTimeline]
  );

  const saveDetails = async () => {
    if (!canSave || !selected || !props.onUpdateSelectedWorkItemDetails) {
      return;
    }

    const savedWorkItemId = selected.workItemId;
    const submittedDrafts = { ...drafts };
    const fields: Record<string, DetailsFieldSaveValue> = {};
    const htmlFields: string[] = [];
    dirtyFieldIds.forEach((id) => {
      const field = catalog.byId.get(id);
      if (!field) {
        return;
      }
      const writeRef = resolveWriteFieldRef(id, scheduleFieldRefs);
      const value = toDetailsFieldSaveValue(field, currentDraft(id));
      if (value === null && writeRef !== id && !hasStoredFieldValue(selected, writeRef)) {
        // The date was inherited from the iteration and is not stored on the work item.
        return;
      }
      fields[writeRef] = value;
      if (field.kind === "html" && id !== DETAILS_FIELD_IDS.description) {
        htmlFields.push(id);
      }
    });
    if (Object.keys(fields).length === 0) {
      setDraftState({ workItemId: null, values: {} });
      return;
    }
    const nextState = typeof fields[DETAILS_FIELD_IDS.state] === "string" ? (fields[DETAILS_FIELD_IDS.state] as string) : null;
    const stateColor = nextState
      ? stateOptions.find((option) => option.name.toLowerCase() === nextState.toLowerCase())?.color ?? null
      : null;
    const confirmedBaseline = { ...baseline };

    setSaveError(null);
    setIsSaving(true);
    try {
      await props.onUpdateSelectedWorkItemDetails({
        targetWorkItemId: savedWorkItemId,
        fields,
        htmlFields,
        stateColor
      });
      setFailedBaseline((current) => (current?.workItemId === savedWorkItemId ? null : current));
      setDraftState((current) => {
        if (current.workItemId !== savedWorkItemId) {
          return current;
        }
        const remaining = Object.fromEntries(
          Object.entries(current.values).filter(([id, value]) => submittedDrafts[id] !== value)
        );
        return { workItemId: savedWorkItemId, values: remaining };
      });
    } catch (error) {
      setFailedBaseline({ workItemId: savedWorkItemId, values: confirmedBaseline });
      setSaveError({
        workItemId: savedWorkItemId,
        message: error instanceof Error ? error.message : "Saving details failed."
      });
    } finally {
      setIsSaving(false);
    }
  };

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "s" || (!event.ctrlKey && !event.metaKey) || !canSave) {
        return;
      }
      event.preventDefault();
      void saveDetails();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  React.useEffect(() => {
    if (!configOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setConfigOpen(false);
        configToggleRef.current?.focus();
      }
    };
    const onPointerDown = (event: MouseEvent) => {
      if (configAreaRef.current && event.target instanceof Node && !configAreaRef.current.contains(event.target)) {
        setConfigOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [configOpen]);

  React.useEffect(() => {
    if (contentHidden) {
      setConfigOpen(false);
    }
  }, [contentHidden]);

  const updateDraft = (fieldId: string, value: string) => {
    const workItemId = selectedWorkItemIdRef.current;
    if (workItemId === null) {
      return;
    }
    setDraftState((current) =>
      current.workItemId === workItemId
        ? { workItemId, values: { ...current.values, [fieldId]: value } }
        : { workItemId, values: { [fieldId]: value } }
    );
  };

  const azureLink = selected ? buildAzureWorkItemUrl(props.organization, props.project, selected.workItemId) : null;
  const lines = buildTimelineDetailsLines(props);

  const renderField = (field: DetailsFieldDescriptor, width: "half" | "full") => {
    const isFieldDirty = dirtyFieldIds.includes(field.id);
    const error = validationErrors.get(field.id) ?? null;
    const className = [
      "timeline-details-field",
      width === "half" ? "timeline-details-field-half" : "timeline-details-field-full",
      isFieldDirty ? "timeline-details-field-dirty" : ""
    ]
      .filter(Boolean)
      .join(" ");
    const hint =
      selected && isIterationFallbackField(field.id, selected)
        ? React.createElement(
            "span",
            {
              className: "timeline-details-row-hint timeline-details-row-hint-iteration",
              title: "Date inherited from the iteration; not set on this work item"
            },
            "from iteration"
          )
        : null;

    return React.createElement(
      "div",
      { key: field.id, className },
      React.createElement(
        "div",
        { className: "timeline-details-field-head" },
        React.createElement("span", { className: "timeline-details-label" }, field.name),
        hint
      ),
      selected ? renderFieldControl(field, selected, error) : null,
      error
        ? React.createElement("p", { id: toErrorId(field.id), className: "timeline-details-field-error", role: "status" }, error)
        : null
    );
  };

  const renderFieldControl = (field: DetailsFieldDescriptor, item: TimelineDetailsItem, error: string | null) => {
    const value = currentDraft(field.id);
    const disabled = isSaving;

    if (field.kind === "html") {
      return React.createElement(DetailsPanelRichTextField, {
        label: field.name,
        value: field.editable ? value : readDetailsFieldValue(field, item, catalogTimeline),
        editable: field.editable,
        disabled,
        onChange: (nextHtml: string) => updateDraft(field.id, nextHtml)
      });
    }

    if (!field.editable) {
      const display = readDetailsFieldValue(field, item, catalogTimeline);
      const numeric = field.kind === "date" || field.kind === "derived" || field.kind === "double" || field.kind === "integer";
      return React.createElement(
        "div",
        {
          className: ["timeline-details-readonly-value", numeric ? "timeline-details-number" : ""].filter(Boolean).join(" "),
          title: display
        },
        display.length > 0 ? display : React.createElement("span", { className: "timeline-details-value-empty" }, "—")
      );
    }

    const options = resolveSelectOptions(field, value, stateOptions.map((option) => option.name), assigneeNames);
    if (options) {
      const selectValue = field.kind === "identity" && value.trim().length === 0 ? UNASSIGNED_OPTION : value;
      return React.createElement(
        "select",
        {
          className: "timeline-details-input",
          "aria-label": field.name,
          disabled,
          value: selectValue,
          onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
            const next = event.target.value;
            updateDraft(field.id, field.kind === "identity" && next === UNASSIGNED_OPTION ? "" : next);
          }
        },
        ...options.map((option) =>
          React.createElement("option", { key: option.value, value: option.value }, option.label)
        )
      );
    }

    if (field.kind === "multiline") {
      return React.createElement("textarea", {
        className: "timeline-details-input timeline-details-textarea",
        "aria-label": field.name,
        rows: 3,
        placeholder: "—",
        disabled,
        value,
        onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => updateDraft(field.id, event.target.value)
      });
    }

    if (field.kind === "date") {
      return React.createElement("input", {
        type: "datetime-local",
        className: "timeline-details-input timeline-details-number",
        "aria-label": field.name,
        disabled,
        value,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => updateDraft(field.id, event.target.value)
      });
    }

    const numeric = field.kind === "double" || field.kind === "integer";
    return React.createElement("input", {
      type: "text",
      className: [
        "timeline-details-input",
        numeric ? "timeline-details-number" : "",
        error ? "timeline-details-input-invalid" : ""
      ]
        .filter(Boolean)
        .join(" "),
      "aria-label": field.name,
      "aria-invalid": error ? "true" : "false",
      "aria-describedby": error ? toErrorId(field.id) : undefined,
      inputMode: field.kind === "double" ? "decimal" : field.kind === "integer" ? "numeric" : undefined,
      placeholder: "—",
      disabled,
      value,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => updateDraft(field.id, event.target.value)
    });
  };

  return React.createElement(
    "aside",
    {
      "aria-label": "timeline-details-panel",
      className: [
        "timeline-details-panel-surface",
        contentHidden ? "timeline-details-panel-surface-content-hidden" : "",
        configOpen && !contentHidden ? "timeline-details-panel-surface-config-open" : ""
      ]
        .filter(Boolean)
        .join(" ")
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
                disabled: !canSave
              },
              isSaving ? "Saving..." : "Save"
            )
      ),
      contentHidden
        ? null
        : React.createElement(
            "div",
            { className: "timeline-details-head-actions", ref: configAreaRef },
            selected ? renderWorkItemPill(selected.workItemId, azureLink) : null,
            React.createElement(
              "button",
              {
                type: "button",
                ref: configToggleRef,
                className: "timeline-details-config-toggle",
                "aria-label": "Configure details fields",
                title: "Configure fields",
                "aria-expanded": configOpen,
                "aria-haspopup": "dialog",
                onClick: () => setConfigOpen((current) => !current)
              },
              React.createElement(GearIcon, { className: "timeline-details-config-toggle-icon" })
            ),
            configOpen
              ? React.createElement(DetailsPanelFieldConfigMenu, {
                  catalog,
                  shownIds: shownIds.value,
                  onChangeShownIds: shownIds.update,
                  onReset: () => shownIds.update([...DEFAULT_DETAILS_PANEL_FIELD_IDS])
                })
              : null
          )
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
              "div",
              { className: "timeline-details-field-grid" },
              ...layoutDetailsFields(visibleFields).map(({ field, width }) => renderField(field, width))
            ),
            activeSaveError
              ? React.createElement("p", { className: "timeline-update-error", role: "status" }, `Save failed: ${activeSaveError}`)
              : null
          )
        : React.createElement("p", { className: "timeline-details-muted" }, "Select a work item to edit its fields."),
    contentHidden ? null : React.createElement("pre", { className: "timeline-details-raw", "aria-hidden": "true" }, lines.join("\n"))
  );
}

function useDetailsPanelFieldIds(): { value: string[]; update: (next: string[]) => void } {
  const [value, setValue] = React.useState<string[]>(() => loadDetailsPanelFields() ?? [...DEFAULT_DETAILS_PANEL_FIELD_IDS]);

  React.useEffect(() => {
    hydrateDetailsPanelFieldsPreference((fieldIds) => setValue(fieldIds));
  }, []);

  const update = React.useCallback((next: string[]) => {
    const unique = [...new Set(next)];
    setValue(unique);
    saveDetailsPanelFields(unique);
  }, []);

  return { value, update };
}

function useFieldDefinitions(
  timeline: TimelineReadModel | null,
  activeQueryId: string | null,
  fetchDefinitions: TimelineDetailsPanelProps["onFetchWorkItemFieldDefinitions"]
): FieldDefinitionsState {
  const workItemTypes = React.useMemo(() => listWorkItemTypes(timeline), [timeline]);
  const key = `${activeQueryId ?? ""}\u0000${workItemTypes.join("\u0000")}`;
  const [state, setState] = React.useState<FieldDefinitionsState>({ key: "", status: "loading" });

  React.useEffect(() => {
    if (workItemTypes.length === 0) {
      setState({ key, status: "ready", fields: [] });
      return;
    }
    if (!fetchDefinitions) {
      setState({ key, status: "failed" });
      return;
    }

    let cancelled = false;
    setState({ key, status: "loading" });
    fetchDefinitions({ workItemTypes })
      .then((fields) => {
        if (!cancelled) {
          setState({ key, status: "ready", fields });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ key, status: "failed" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [key, fetchDefinitions]);

  return state.key === key ? state : { key, status: "loading" };
}

function useServerStateOptions(
  workItemId: number | null,
  fetchStateOptions: TimelineDetailsPanelProps["onFetchWorkItemStateOptions"]
): Array<{ name: string; color: string | null }> {
  const [options, setOptions] = React.useState<Array<{ name: string; color: string | null }>>([]);
  const fetchedRef = React.useRef(false);

  React.useEffect(() => {
    if (fetchedRef.current || workItemId === null || !fetchStateOptions) {
      return;
    }

    let cancelled = false;
    fetchedRef.current = true;
    fetchStateOptions({ targetWorkItemId: workItemId })
      .then((states) => {
        if (!cancelled) {
          setOptions(states.filter((state) => state.name.trim().length > 0));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOptions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchStateOptions, workItemId]);

  return options;
}

function resolveSelectOptions(
  field: DetailsFieldDescriptor,
  value: string,
  stateOptionNames: string[],
  assigneeNames: string[]
): Array<{ value: string; label: string }> | null {
  let names: string[] | null = null;
  let allowEmpty = true;
  if (field.id === DETAILS_FIELD_IDS.state) {
    names = stateOptionNames;
    allowEmpty = false;
  } else if (field.kind === "identity") {
    names = [UNASSIGNED_OPTION, ...assigneeNames];
    allowEmpty = false;
  } else if (field.kind === "boolean") {
    names = [...BOOLEAN_OPTIONS];
  } else if (field.kind === "picklist") {
    names = field.allowedValues;
  }

  if (!names) {
    return null;
  }

  const options = names.map((name) => ({ value: name, label: name }));
  if (value.trim().length > 0 && !names.includes(value)) {
    options.unshift({ value, label: value });
  }
  if (allowEmpty && value.trim().length === 0) {
    options.unshift({ value: "", label: "—" });
  }
  return options;
}

function hasStoredFieldValue(item: TimelineDetailsItem, referenceName: string): boolean {
  const value = item.details.fieldValues?.[referenceName];
  return value !== null && value !== undefined && String(value).trim().length > 0;
}

function resolveWriteFieldRef(fieldId: string, scheduleFieldRefs: { start: string; endOrTarget: string }): string {
  if (fieldId === DETAILS_FIELD_IDS.start) {
    return scheduleFieldRefs.start;
  }
  if (fieldId === DETAILS_FIELD_IDS.end) {
    return scheduleFieldRefs.endOrTarget;
  }
  return fieldId;
}

function toErrorId(fieldId: string): string {
  return `timeline-details-field-error-${fieldId.replace(/[^A-Za-z0-9_-]/g, "-")}`;
}

function isIterationFallbackField(fieldId: string, item: TimelineDetailsItem): boolean {
  const fallback = "iterationFallback" in (item.schedule ?? {}) ? (item.schedule as { iterationFallback?: string }).iterationFallback : undefined;
  if (!fallback) {
    return false;
  }
  if (fieldId === DETAILS_FIELD_IDS.start) {
    return fallback === "start" || fallback === "both";
  }
  if (fieldId === DETAILS_FIELD_IDS.end) {
    return fallback === "end" || fallback === "both";
  }
  return false;
}

function renderWorkItemPill(workItemId: number, azureLink: string | null): React.ReactElement {
  if (!azureLink) {
    return React.createElement("span", { className: "timeline-details-work-item-id" }, `#${workItemId}`);
  }

  return React.createElement(
    "a",
    {
      className: "timeline-details-work-item-id timeline-details-work-item-link",
      href: azureLink,
      target: "_blank",
      rel: "noreferrer"
    },
    `#${workItemId}`,
    React.createElement(
      "svg",
      { className: "timeline-details-work-item-link-icon", viewBox: "0 0 16 16", "aria-hidden": "true" },
      React.createElement("path", {
        d: "M6 10 11.5 4.5M8.5 4.5h3v3M10.5 8.5v2a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 10.5V7a1.5 1.5 0 0 1 1.5-1.5h2",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "1.6",
        strokeLinecap: "round",
        strokeLinejoin: "round"
      })
    )
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

function resolveSelectedWorkItem(timeline: TimelineReadModel | null, selectedWorkItemId: number | null): TimelineDetailsItem | null {
  if (!timeline || selectedWorkItemId === null) {
    return null;
  }

  return (
    timeline.bars.find((bar) => bar.workItemId === selectedWorkItemId) ??
    timeline.unschedulable.find((item) => item.workItemId === selectedWorkItemId) ??
    null
  );
}
