# Azure DevOps Query-Driven Gantt

## What This Is

A query-driven system that executes Azure DevOps saved queries and visualizes resulting work items as a trustworthy Gantt timeline for PM/PO-led planning. v1 is read-only and emphasizes correctness, transparent state handling, and reliable dependency visualization. The architecture is intentionally prepared for v2 write-back capabilities without breaking the read model.

## Core Value

PM/POs can select a saved query and get a trustworthy, dependency-correct timeline fast, with clear freshness and failure transparency.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] v1 remains read-only while preserving a clean command boundary for v2 write-back.
- [ ] Saved queries are executed by stable query ID and mapped into a canonical planning model.
- [ ] Timeline shows work items with correct predecessor/successor links as arrows between bars.
- [ ] Dependency links are visualized as Finish-to-Start semantics for Azure dependency data in v1.
- [ ] System keeps and displays last-known-good timeline on refresh failure (strict fail behavior).
- [ ] Data loading is fast for typical sets and API calls are parallelized where safe.
- [ ] UX exposes freshness/source metadata and distinct states (loading/empty/auth/query/partial failure).

### Out of Scope

- Inline write-back in v1 — deferred to v2 to protect reliability of read foundation.
- In-app WIQL editor in v1 — saved query flow is primary source in v1.
- Browser-only direct Azure DevOps auth/API calls — core calls stay behind local BFF/adapters.
- Automatic fabrication of missing scheduling dates — timeline must not invent planning facts.
- Baseline/version comparison — deferred beyond v1 scope.
- Resource/capacity planning — deferred beyond v1 scope.
- Critical path calculation — deferred beyond v1 scope.
- Multi-project/portfolio view — deferred beyond v1 scope.

## Context

- Product direction is a greenfield rewrite; legacy code is not a compatibility target.
- Architecture pillars are non-negotiable: Hexagonal/Clean/SOLID/DDD boundaries, maintainability focus, no cyclical dependencies.
- Data pipeline priority is Query -> IDs/Relations -> Hydration -> Mapping -> Timeline, with correctness before UI gimmicks.
- Primary v1 user profile: PM/PO.
- Important UX trust behavior: on refresh failure, keep last-known-good timeline and show clear error state.

## Constraints

- **Architecture**: Hexagonal + Clean boundaries are mandatory — ensures long-term maintainability and v2 extensibility.
- **Scope**: v1 read-only — avoids premature write complexity while delivering dependable timeline value.
- **Dependency Rendering**: Azure dependency data shown as Finish-to-Start in v1 — Azure relation type model does not expose full PM dependency types here.
- **Performance**: Favor fast interaction and safe parallelized fetching — user expectation is “hauptsache schnell”.
- **Data Integrity**: No fabricated dates or fake logic — trust depends on source-accurate rendering.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep v1 read-only | Reduce delivery risk and establish reliable ingestion/mapping foundation first | — Pending |
| Use strict fail with last-known-good timeline | Preserve user trust during transient/API failures while still surfacing errors clearly | — Pending |
| Render Azure dependencies as Finish-to-Start arrows in v1 | Aligns with available Azure dependency semantics for current scope | — Pending |
| Defer interactive dependency editing to v2 | Enables v1 focus while keeping command/write boundary explicit | — Pending |

---
*Last updated: 2026-03-04 after initialization*
