# C4 Container

## Containers

```mermaid
flowchart TB
  subgraph LocalMachine[User Machine]
    UI[UI Shell\nReact]
    BFF[Local HTTP Server\nNode.js]
    CFG[(Context + Mapping\nJSON files)]
  end

  UI -->|POST /phase2/query-intake| BFF
  UI -->|POST /phase2/work-item-schedule-adopt| BFF
  BFF -->|REST 7.1| ADO[Azure DevOps]
  BFF -->|az commands| AZ[Azure CLI]
  BFF --> CFG
```

## Responsibilities

- UI Shell: interaction, state rendering, diagnostics surface.
- Local HTTP Server: composition root, transport validation, capability enforcement.
- Azure adapters: auth preflight, query runtime, write commands.
- Persistence adapters: context and mapping profile storage.
