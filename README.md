# Azure GanttOps

Local-first Azure DevOps timeline tooling with a small HTTP backend and React UI shell.

## License

This project is licensed under the Azure GanttOps Attribution License. It is
MIT-like, but requires visible attribution to TensorFive GmbH. See
[`LICENSE`](./LICENSE).

## Contributing and Security

- Contribution guide: [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- Code of Conduct: [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)
- Security policy and private vulnerability reporting: [`SECURITY.md`](./SECURITY.md)

## Scope and Non-Goals

Scope:

- Local-first timeline tooling for Azure DevOps work items
- Query-driven read workflows, timeline rendering, and optional writeback flows
- User-specific local persistence for context and preferences

Non-goals:

- Multi-tenant hosted SaaS operation
- Centralized cloud persistence for user settings
- Replacing Azure DevOps project/process administration capabilities

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

## One-click local start (Mac + Windows)

Prerequisites on the user machine:
- Node.js 20+
- Azure CLI (`az`)

Then use one of these launchers from the project root:
- macOS: `Start Azure GanttOps.command` (double-click)
- Windows: `Start Azure GanttOps.cmd` (double-click)

What the launcher does:
- checks `node` and `az`
- installs `azure-devops` CLI extension if missing
- runs `npm install` once when `node_modules` is missing
- runs `npm run build` if build artifacts are missing
- starts the app server and opens the browser at `http://127.0.0.1:8080`

CLI alternative:

```bash
npm run app:start
```

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
- User preferences are persisted under:
  - `~/.azure-ganttops/user-preferences.json`

## Privacy and Data Handling

- The app stores user-specific settings locally under `~/.azure-ganttops/`.
- Azure DevOps data access is performed from the local backend process using your local auth context.
- The UI currently loads a webfont from an external provider (Fontshare) during app load.

## Trademark Notice

Azure and Azure DevOps are trademarks of Microsoft. This project is an independent open source project and is not affiliated with, endorsed by, or sponsored by Microsoft.

## Architecture and operations docs

- C4 light:
  - [`docs/c4/context.md`](./docs/c4/context.md)
  - [`docs/c4/container.md`](./docs/c4/container.md)
  - [`docs/c4/component.md`](./docs/c4/component.md)
- ADRs: [`docs/adr/README.md`](./docs/adr/README.md)
- Runbook: [`docs/runbook/local-operations.md`](./docs/runbook/local-operations.md)

## Troubleshooting

For common local operation failures and recovery steps, see:

- [`docs/runbook/local-operations.md`](./docs/runbook/local-operations.md#troubleshooting)
