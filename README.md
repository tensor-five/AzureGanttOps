# Azure GanttOps

Local-first Azure DevOps timeline tooling with a small HTTP backend and React UI shell.

## License

This project is licensed under the MIT License. See [`LICENSE`](./LICENSE).

## Prerequisites

- Node.js 20+ and npm
- Azure CLI (`az`)
- Azure DevOps Azure CLI extension (`azure-devops`)
- Authenticated Azure CLI session (`az login`)

Install extension if needed:

```bash
az extension add --name azure-devops
```

## Quick start

```bash
npm install
npm run dev:local
```

The local server listens on `http://127.0.0.1:8080` by default.

## Configuration

Copy `.env.example` values into your environment as needed.

Key variables:

- `PORT`: local HTTP port
- `ADO_PAT` or `AZURE_DEVOPS_EXT_PAT`: optional PAT auth (otherwise Azure CLI token is used)
- `ADO_VERBOSE_LOGS`: verbose runtime and preflight logs (`1` or `0`)
- `ADO_WRITE_ENABLED`: enables writeback routes (`1` or `0`)
- `ADO_AZ_CLI_PATH`: optional manual Azure CLI executable path (for environments where `az` is not on `PATH`)

If Azure CLI is not found at runtime, the Query tab supports:
- auto-detecting CLI path via `Get-Command az` / `where`
- manually setting an `az.cmd` path

## Operational assumptions

- This app expects users to have Azure CLI installed and usable in `PATH`.
- Azure DevOps context (organization/project) is user-specific and persisted under:
  - `~/.azure-ganttops/ado-context.json`

## Architecture and operations docs

- C4 light:
  - [`docs/c4/context.md`](./docs/c4/context.md)
  - [`docs/c4/container.md`](./docs/c4/container.md)
  - [`docs/c4/component.md`](./docs/c4/component.md)
- ADRs: [`docs/adr/README.md`](./docs/adr/README.md)
- Runbook: [`docs/runbook/local-operations.md`](./docs/runbook/local-operations.md)
