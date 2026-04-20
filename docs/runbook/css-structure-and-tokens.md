# CSS Structure and Tokens (Refactoring F6)

Date: 2026-03-11

## Entry and layering

- `src/app/bootstrap/local-ui.css` is the single entrypoint.
- Import order is fixed and intentional:
  1. `local-ui-tokens.css`
  2. `local-ui-base.css`
  3. `local-ui-shell.css`

## Responsibilities

- `local-ui-tokens.css`: design tokens and theme variables (light/dark mappings via `data-theme` attributes).
- `local-ui-base.css`: global reset/base element defaults.
- `local-ui-shell.css`: feature and component selectors (`ui-shell`, `timeline-*`, diagnostics, header query picker).

## Guardrails

- Keep `timeline-details-input` in `local-ui-shell.css` as the canonical selector for timeline detail inputs.
- New color/spacing/typography values must be introduced as tokens first, then consumed in shell/base.
- Do not import feature CSS directly from component TSX files in bootstrap shell; extend the split files instead.

## Smoke coverage

- `src/app/bootstrap/local-ui-css-structure.spec.ts` checks:
  - entrypoint import order,
  - required selectors (`.timeline-pane-actions`, `.gantt-sync-status`, `.timeline-details-input`),
  - required token contract presence (`--color-bg`, `--color-text`, `--space-2`).
