# ADR 0004: IterationsPort placement and per-use-case caching

- Status: Accepted
- Date: 2026-04-21

## Context

Phase 3 introduced an iteration-based scheduling fallback: work items
without explicit start/end inherit dates from their iteration when the
iteration itself is dated. This requires the application to know about
iteration metadata, which is not part of the work-item hydration
response and must be fetched from a separate Azure DevOps REST endpoint
(`classificationnodes/Iterations`).

The iteration-dates PR landed the supporting code with the port
interface declared inside the adapter module
(`adapters/azure-devops/iterations/azure-iterations.adapter.ts`). The
`BuildTimelineViewUseCase` imported `IterationsPort` from there, which
puts an `application -> adapter` import edge and violates the inward
dependency rule from ADR 0002.

The PR also called `listIterations()` on every timeline build, even
when the active context (organization/project) had not changed —
turning every interactive refresh, mapping fix, or projection rebuild
into an extra REST call.

## Decision

1. **Port placement.** The interface lives in
   `application/ports/iterations.port.ts`. The Azure adapter implements
   it; the use case depends on the port. Composition wires the
   concrete adapter in `app/composition/phase1-query-flow.ts`. This
   restores the inward dependency direction required by ADR 0002.

2. **Per-use-case caching.** `BuildTimelineViewUseCase` keeps a
   single-slot cache (`{ value, fetchedAt }`) with a 60 s TTL. Cache
   miss triggers a fetch; cache hit reuses the previous map. On fetch
   failure the use case keeps serving the stale value if it has one,
   otherwise it returns `null` so the projection still produces
   schedulable bars from explicit dates only. Cache is invalidated
   explicitly via `invalidateIterationCache()` when needed (e.g. when
   the active query changes context — wired in a follow-up).

## Consequences

- Pros: Hexagonal boundaries restored. Repeated rebuilds are free
  inside the TTL window. Failure mode degrades gracefully instead of
  breaking the projection.
- Cons: Cache lives on the use case instance, so cross-context data
  could leak if the same instance were reused across orgs/projects;
  composition only ever creates one instance per context, so this is
  safe today but worth a follow-up if the composition shape changes.
- Trade-off: 60 s TTL is a starting point — short enough that newly
  created iterations show up on the next refresh, long enough that
  bursts of rebuilds in the same UI session don't multiply REST traffic.

## Alternatives considered

- **Module-level cache** in the adapter: simpler but harder to
  invalidate per use case and bypasses dependency-injection semantics.
- **TanStack Query in the UI** for iteration metadata: would solve
  caching but pulls infra concern into the feature layer; the
  application use case still needs the data for the projection.
