# Contributing

Thanks for contributing to Azure GanttOps.

## Prerequisites

- Node.js 20+
- npm
- Azure CLI (`az`)
- Azure DevOps Azure CLI extension (`azure-devops`)

Install extension if needed:

```bash
az extension add --name azure-devops
```

## Local Setup

```bash
npm install
npm run dev:local
```

Server default: `http://127.0.0.1:8080`

## Quality Gates

Before opening a PR, run:

```bash
npm run typecheck
npm run check:cycles
npm test
```

If your change touches E2E behavior, also run:

```bash
npm run test:e2e
```

## Pull Request Guidelines

- Keep PRs focused and small.
- Add or update tests for behavior changes.
- Update docs when behavior, setup, or operations change.
- Use clear commit messages and PR descriptions (problem, change, validation).

## Design and Persistence Conventions

- UI/CSS changes should align with `Design_Concept.md`.
- For timeline detail inputs, use class `timeline-details-input`.
- User-specific local settings are persisted via `lowdb` (`/phase2/user-preferences`), with `localStorage` only as compatibility fallback.

## Branching

- Open PRs against `main`.
- Ensure CI is green before requesting review.

## Code of Conduct

By participating in this project, you agree to follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

