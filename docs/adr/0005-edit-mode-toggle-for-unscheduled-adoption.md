# ADR 0005: Explicit edit mode for unscheduled-task adoption

- Status: Accepted
- Date: 2026-04-21

## Context

The original behaviour for unscheduled work items was implicit: when a
scheduled bar was selected, clicking an unscheduled item copied the
selected bar's start/end onto it as a side effect of the click. This
caused two problems:

1. Accidental writes when users only intended to inspect an
   unscheduled item.
2. No undo affordance — the schedule was applied immediately, with no
   way to see *which* dates were about to be written before committing.

The first iteration-dates PR replaced this with a single
"adopt from above" button bound to the unschedulable item's tree
parent (whichever scheduled task sat above it in the hierarchy). That
worked for items whose parent had dates, but it scaled poorly: only
one item at a time, and it forced the user into a tree-driven mental
model when in practice the user wants to copy *the same* dates onto a
batch of items they pick themselves.

## Decision

The Unscheduled-tasks panel introduces an **Edit-mode toggle**. Drag-
and-drop and the per-item adopt arrows are inert until edit mode is
on. When edit mode is on **and** a scheduled bar is selected:

- A purple ↑ button is rendered next to *every* unscheduled item.
- Clicking it copies the selected bar's start/end onto that item.
- The selected bar stays selected so the user can apply the same dates
  to several items in succession.

An always-visible (i) button next to the toggle opens a rendered help
popover explaining both interactions. The popover anchors above the
icon so it never gets clipped by short Unscheduled lists. An inline
hint shows the dates that will be applied while edit mode is on and a
scheduled bar is selected.

## Consequences

- Pros: Explicit, two-step write — destructive-by-accident risk is
  removed. Dates are visible before being applied. Batch adoption is
  fast (select once, click ↑ N times). Help popover is discoverable
  whether edit mode is on or off.
- Cons: One extra click (toggle Edit mode) before the workflow becomes
  available. Users coming from the previous PR's tree-parent model
  need to relearn the flow.
- Mitigation: The (i) popover contains a 3-step recipe so a first-time
  user does not need to read the changelog.

## Alternatives considered

- **Always-on per-item arrows.** Rejected — clutters the panel during
  normal browsing and re-enables the accidental-write risk.
- **Drag-only.** Rejected — drag-and-drop is fiddly when there are
  many items and the user wants to apply identical dates; the arrow
  is a deliberate fast path for the batch case.
- **Modal "apply to multiple" dialog.** Rejected — heavyweight and
  hides the work item list during the operation, defeating the point
  of seeing what is being scheduled.

## Out of scope

- Persisting `editMode` across sessions (currently in-memory; revisit
  if users routinely want it to stay on).
- Undo for an applied adoption — the standard write path produces a
  pending mutation that can already be cleared via the existing
  "Clear changes" button.
