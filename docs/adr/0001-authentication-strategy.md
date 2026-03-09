# ADR 0001: Local Azure CLI as primary auth strategy

- Status: Accepted
- Date: 2026-03-09

## Context

The app must run locally and authenticate against Azure DevOps without embedding long-lived secrets in browser code.

## Decision

Use Azure CLI session/token flow as primary auth mechanism, with optional PAT via environment variables for operational fallback.

## Consequences

- Pros: no browser token handling for core calls, aligns with local operator workflows, simpler token lifecycle handling.
- Cons: requires `az` availability and valid local login.
- Mitigation: explicit preflight states (`CLI_NOT_FOUND`, `SESSION_EXPIRED`, `MISSING_EXTENSION`, `CONTEXT_MISMATCH`).
