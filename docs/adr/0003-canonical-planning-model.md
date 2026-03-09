# ADR 0003: Canonical planning model between ingestion and UI

- Status: Accepted
- Date: 2026-03-09

## Context

Azure query responses vary in shape and cannot be used directly as stable rendering input.

## Decision

Normalize query results and hydrated work items into a canonical planning/timeline read model before rendering.

## Consequences

- Pros: deterministic UI behavior, easier validation/mapping checks, safer evolution for write commands.
- Cons: transformation layer adds implementation complexity.
- Mitigation: cover normalization/mapping behavior with unit and e2e tests.
