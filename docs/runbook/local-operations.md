# Operational Runbook (Local)

## Prerequisites

- Node.js 20+
- Azure CLI (`az`)
- Azure DevOps extension (`az extension add --name azure-devops`)
- Valid Azure login (`az login`)

## Start

```bash
npm install
npm run dev:local
```

Server default: `http://127.0.0.1:8080`

## Required context

The app expects Azure DevOps organization and project context. Context is persisted at:

- `~/.azure-ganttops/ado-context.json`

## Auth modes

- Preferred: Azure CLI token flow
- Optional fallback: `ADO_PAT` or `AZURE_DEVOPS_EXT_PAT`

## Useful environment variables

- `PORT` (default `8080`)
- `ADO_VERBOSE_LOGS` (`1` or `0`)
- `ADO_WRITE_ENABLED` (`1` or `0`)
- `ADO_AZ_CLI_PATH` (optional path override, e.g. `C:\\...\\az.cmd`)

## Troubleshooting

1. `CLI_NOT_FOUND`
   - Verify `az --version` and shell `PATH`.
2. `MISSING_EXTENSION`
   - Run `az extension add --name azure-devops`.
3. `SESSION_EXPIRED`
   - Run `az login` and retry.
4. `CONTEXT_MISMATCH`
   - This only occurs when Azure DevOps defaults are explicitly set to a different org/project.
   - Update org/project in app settings or align Azure DevOps defaults.
5. `ADO_AUTH_REQUIRED`
   - Set PAT env var or refresh Azure CLI login.
6. Azure CLI path resolution fails (`CLI_NOT_FOUND` despite installed CLI)
   - Open Query tab and click "Auto-detect with Get-Command".
   - If needed, set the manual Azure CLI path (`az.cmd`) with "Apply CLI path".
   - Then use "Sign in with Azure CLI" and retry query intake.

## Local quality gate

```bash
npm run typecheck
npm run check:cycles
npm test
```
