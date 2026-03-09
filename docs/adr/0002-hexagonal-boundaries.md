# ADR 0002: Hexagonal ports/adapters boundary

- Status: Accepted
- Date: 2026-03-09

## Context

The rewrite must enforce maintainable architecture with clear isolation between business logic and infrastructure.

## Decision

Define all infrastructural dependencies as `application/ports` interfaces and implement them in `adapters/*`.

## Consequences

- Pros: testability, swapability of infrastructure, explicit dependency direction.
- Cons: extra interface/types and composition wiring overhead.
- Mitigation: keep ports minimal and colocate adapter tests with each adapter.
