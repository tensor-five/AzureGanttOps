# C4 Component

## Core component view (Backend flow)

```mermaid
flowchart LR
  Controller[QueryIntakeController]
  RunIntake[RunQueryIntakeUseCase]
  BuildView[BuildTimelineViewUseCase]
  SubmitWrite[SubmitWriteCommandUseCase]

  AuthPort[AuthPreflightPort]
  QueryPort[QueryRuntimePort]
  MappingPort[MappingSettingsPort]
  WritePort[WriteCommandPort]

  AuthAdapter[AzureCliPreflightAdapter]
  QueryAdapter[AzureQueryRuntimeAdapter]
  MappingAdapter[FileMappingSettingsAdapter]
  WriteAdapters[WriteCommandAzureAdapter / Noop]

  Controller --> RunIntake
  Controller --> SubmitWrite
  RunIntake --> AuthPort
  RunIntake --> QueryPort
  RunIntake --> MappingPort
  RunIntake --> BuildView
  SubmitWrite --> WritePort

  AuthPort --> AuthAdapter
  QueryPort --> QueryAdapter
  MappingPort --> MappingAdapter
  WritePort --> WriteAdapters
```

## Boundary rules

- `domain` and `application` do not import from `app`, `features`, or concrete adapters.
- Adapter contracts are defined in `application/ports`.
- Composition wiring happens in `app/composition`.
