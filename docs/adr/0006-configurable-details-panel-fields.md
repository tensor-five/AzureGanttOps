# ADR 0006: Configurable details panel fields

- Status: Accepted
- Date: 2026-11-09
- Contract: `docs/contracts/details-panel-field-configuration.v1.html` (DPF-01 … DPF-22)

## Context

The details panel showed a fixed set of fields: Title, State and Description as inputs, plus a read-only row list. Users could not see or edit other Azure DevOps fields such as Story Points, and could not decide which information appears or in which order.

## Decision

1. **Field catalog from live definitions.** A new port `WorkItemFieldDefinitionsPort` is implemented by `AzureFieldDefinitionsAdapter`. The adapter reads project field metadata (`_apis/wit/fields`) and the per-type field lists (`_apis/wit/workitemtypes/{type}/fields?$expand=allowedValues`) for the work item types of the active query. The BFF exposes this as `GET /phase2/work-item-field-definitions`. The UI never calls Azure DevOps directly.
2. **Built-ins plus definitions, no duplicates.** The catalog combines built-in fields (Title, State, Description, Assigned To, Start, End, ID, Work Item Type, Dependencies) with Azure fields. Start and End replace the mapped schedule fields. If the definitions cannot be loaded, fields found in the loaded work items are offered read-only.
3. **Width is derived, not configured.** `details-panel-field-catalog.ts` classifies each field by type (contract section 3). A pairing rule places two directly following half-width fields in one row. A CSS container query switches to one column below 280 px content width.
4. **Generic write path.** `POST /phase2/work-item-details-update` accepts `fields` (reference name → value; `null` removes the value) and turns them into one JSON Patch.
   - Reference names are validated against a strict pattern.
   - Only primitive values are accepted.
   - Title and State cannot be cleared.
   - HTML values are sanitized for `System.Description` and for every reference the client declares in `htmlFields`.
   - The legacy `title`/`descriptionHtml`/`state` payload is still accepted.
5. **Global preference.** The ordered list of field ids is stored as `detailsPanelFields` in the lowdb user preferences, not per query. The working style should not change when the user switches queries.
6. **Optimistic timeline update.** After a save, `applyWorkItemFieldsUpdate` patches title, state, description, assignee and `fieldValues`. Bar labels, filters, color coding and the left column therefore reflect the new value without a reload. If a save fails, the panel keeps the confirmed baseline, so the draft and the Save button remain.

## Consequences

- Each new query (or set of work item types) triggers one definitions request per type and one project field request.
- Azure boolean field values are now flattened to `"True"`/`"False"` during hydration, so they can be shown and filtered.
- DateTime, path, multi-line text, tags and identities other than Assigned To stay read-only in the panel (out of contract scope).

## Amendment (contract v2, 2026-11-09)

- Fields are no longer hidden per work item type, and every field is editable except Azure DevOps system fields. The REST API decides on save whether a field fits the work item type; the UI shows no warning beforehand.
- System fields are recognized by the Azure `readOnly` flag. When definitions are unavailable, the fixed list `SYSTEM_READ_ONLY_FIELD_REFS` is used instead.
- Start/End are written to the mapped schedule fields. `applyWorkItemFieldsUpdate` moves the bar and keeps iteration-inherited boundaries that were not edited.
- Work item patch failures carry the Azure error text (`buildAzureResponseErrorMessage`). The BFF strips the technical prefix and redacts bearer tokens, JWTs and key/value credentials before the text reaches the UI.
