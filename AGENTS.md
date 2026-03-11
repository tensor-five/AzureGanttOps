# AGENTS.md

## Verbindliche Design-Referenz

- Nutze [`Design_Concept.md`](/Users/chris/Azure%20GanttOps/Design_Concept.md) als verpflichtende UI-/CSS-Referenz.
- Die Klasse `timeline-details-input` ist gemäß `Design_Concept.md` für Timeline-Detail-Eingabefelder zu verwenden.

## Verbindliche Persistenz-Referenz

- Nutzerbezogene lokale Einstellungen werden über `lowdb` persistiert (Datei: `~/.azure-ganttops/user-preferences.json`, API: `/phase2/user-preferences`).
- Relevante Implementierung: `src/adapters/persistence/settings/lowdb-user-preferences.adapter.ts`.
- `localStorage` ist nur Fallback/Kompatibilitätsschicht im UI, nicht die führende Persistenzquelle.

## Wann Datenbank sinnvoll ist

- Datenbank (hier: lokale `lowdb`) nutzen für persistente, nutzerbezogene Einstellungen wie `themeMode`, `timelineColorCoding`, `timelineDensity`, gespeicherte `filters` und `views`.
- Keine eigene Datenbankstruktur nutzen für rein flüchtige Laufzeitdaten (z. B. Polling-Zwischenstände, temporäre UI-Flags); dafür In-Memory-State verwenden.
- Keinen separaten Cache-Layer einführen, solange das Datenvolumen klein bleibt und keine Performance-Anforderungen bestehen.

## Clean-Code-Prinzipien (verbindlich)

- Refactor-only bedeutet: kein geändertes Laufzeitverhalten ohne expliziten Feature-Auftrag.
- Kleine, klar benannte Module statt großer Sammeldateien.
- Eine Datei hat eine primäre Verantwortung.
- Logik nicht duplizieren; gemeinsame Logik in Utility/Service/Factory zentralisieren.
- UI-Orchestrierung und Fachlogik trennen: Komponenten koordinieren, Services berechnen.
- Persistenzzugriff kapseln (Store/Adapter), nicht ad hoc in beliebigen Komponenten streuen.
- Jede Änderung braucht passende Tests im betroffenen Bereich (Unit + ggf. Integration).
- Vor Abschluss immer `typecheck`, betroffene Tests und relevante Regressionen ausführen.

## Architektur-Landkarte (Wo finde ich was?)

- `src/features/gantt-view/`
  - Timeline-UI und Interaktionen.
  - `timeline-pane.tsx` ist Orchestrator, keine neue monolithische Logik aufbauen.
  - Interaktions-/State-Teile über dedizierte Hooks kapseln (z. B. Dragging, Dependencies, Filter).
- `src/features/gantt-view/create-user-preference-store.ts`
  - Standard-Factory für UI-Preferences mit Memory-Cache, LocalStorage-Fallback und Server-Patch.
  - Neue Preference-Module grundsätzlich darauf aufbauen.
- `src/app/bootstrap/`
  - App-Start und UI-Shell-Orchestrierung.
  - `ui-client.tsx` bleibt Kompositionsebene; Workflow-/Berechnungslogik in dedizierte Module auslagern.
  - `ui-client-storage.ts`, `ui-client-theme.ts`, `ui-client-timeline-mutations.ts` enthalten wiederverwendbare Utilities.
- `src/shared/ui-state/`
  - Wiederverwendbare UI-State-Mapping-/Service-Logik ohne React-Rendering.
  - Gute Zielzone für extrahierte, testbare Ablauf-/Transformationslogik.
- `src/shared/user-preferences/`
  - Zentrale Preferences-Modelle/Sanitizing/Clientzugriff.
- `src/adapters/persistence/settings/`
  - LowDB-Adapter als führende Persistenzimplementierung.

## Verbindliche Umsetzungsmuster

### 1) TimelinePane und Gantt-Interaktionen

- `timeline-pane.tsx` nur als Orchestrator weiterentwickeln.
- Neue komplexe State-Blöcke zuerst als Hook unter `src/features/gantt-view/` anlegen.
- Hook-Namen nach Domäne wählen (`use...Dragging`, `use...Editing`, `use...Filters`).
- Präsentationsnahe Teilbereiche bei Bedarf als Subcomponent auslagern.
- Bestehende Props, ARIA-Labels und UX-Flows stabil halten.

### 2) Preferences

- Für neue/angepasste Preferences immer `createUserPreferenceStore<T>` nutzen.
- `sanitize` und `buildPatch` sind Pflicht und müssen Verhalten explizit absichern.
- Persistenzpfade/Feldnamen in `/phase2/user-preferences` dürfen nicht stillschweigend geändert werden.
- `localStorage` nur als Fallback/Kompatibilität, nicht als Source of Truth.

### 3) UI-Client Entkopplung

- `ui-client.tsx` darf koordinieren, aber keine wachsende fachliche Detail-Logik aufnehmen.
- Header-/Query-Workflow, Runtime-Enrichment und Transformationslogik in Services/State-Container verschieben.
- Reine Logikmodule bevorzugt ohne React-Abhängigkeit bauen.

## Testkonventionen

- Für neue `.spec.ts` mit DOM-Zugriff: `// @vitest-environment jsdom` setzen.
- Jede ausgelagerte Utility/Service-Datei bekommt eigene Unit-Tests.
- Bei Timeline-Refactors immer relevante `timeline-pane` Regressionen mitlaufen lassen.
- Testnamen beschreiben Verhalten, nicht Implementierungsdetails.

## Guardrails gegen zukünftiges Chaos

- Keine Datei gleichzeitig für mehrere große Refactoring-Pakete verwenden.
- Keine stillen Strukturbrüche: bei größeren Schnitten `docs/runbook/refactoring-plan.md` aktualisieren.
- Keine Abkürzungen per Workaround, wenn Paketabhängigkeiten blockieren: stoppen und Blocker dokumentieren.
- Wenn unklar ist, wo neue Logik hingehört: zuerst in kleiner Utility/Hook kapseln, dann integrieren.

## Feature Implementation Checklist (bei jedem Feature verpflichtend)

- Scope und Zielverhalten schriftlich klären: Was wird geändert, was bleibt unverändert?
- Zuständigkeit festlegen: In welches Modul gehört die Logik (UI-Orchestrator, Hook, Service, Store, Shared)?
- Bestehende Patterns wiederverwenden (`createUserPreferenceStore`, `ui-client-*` Utilities, `shared/ui-state` Services), keine parallelen Sonderlösungen bauen.
- Persistenz prüfen: `lowdb`/`/phase2/user-preferences` als führende Quelle respektieren; `localStorage` nur als Fallback.
- UI/UX-Konformität gegen [`Design_Concept.md`](/Users/chris/Azure%20GanttOps/Design_Concept.md) prüfen (inkl. relevanter Klassen wie `timeline-details-input`).
- Tests ergänzen/aktualisieren: Unit-Tests für neue Logik, Regressionstests für betroffene Kernflows.
- Qualitätsgates vor Abschluss ausführen: mindestens `npm run typecheck`, `npm run lint` und betroffene Tests.
- Doku synchron halten: falls Struktur/Verantwortungen geändert wurden, `docs/runbook/refactoring-plan.md` und ggf. `AGENTS.md` aktualisieren.
