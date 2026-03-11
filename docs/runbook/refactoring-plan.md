# Refactoring Plan

## 1. Zweck und Zielbild

Dieser Plan beschreibt ein mehrstufiges, risikoarmes Refactoring des bestehenden Codes mit Fokus auf:

- Reduktion von Logik-Duplikaten
- Klare Verantwortlichkeiten pro Modul
- Bessere Testbarkeit
- Geringeres Regressionsrisiko bei zukünftigen Features

Primäres Ziel ist nicht "alles neu", sondern eine schrittweise Verbesserung entlang klarer Schnittstellen und mit messbaren Akzeptanzkriterien.

## 2. Leitplanken

### 2.1 Architektur

- Hexagonale Grenzen respektieren (Domain/Application/Adapter/UI).
- Keine Verlagerung von UI-Logik in Adapter.
- Keine neue Persistenz-Technologie einführen: `lowdb` bleibt führend für nutzerbezogene Persistenz.

### 2.2 Persistenz

- Führende Quelle für Nutzer-Preferences bleibt API `/phase2/user-preferences` via `lowdb`.
- `localStorage` bleibt Fallback-/Kompatibilitätsschicht im UI.
- Schema-/Sanitizing-Regeln müssen zentral und konsistent sein.

### 2.3 Delivery

- In kleinen, reviewbaren PR-Schritten arbeiten.
- Pro Schritt: Code + Tests + kurze technische Notiz im PR.
- Kein Big-Bang-Refactor.

## 3. Priorisierte Refactoring-Arbeitspakete

## 3.1 Paket A (Priorität 1): Preferences-Schema und Sanitizing deduplizieren

Status: ✅ Abgeschlossen (2026-03-11)

### Problem

`sanitizePreferences`, `sanitizeSavedQueryPreference`, `clamp` und Teile der Typdefinition sind derzeit doppelt vorhanden:

- `src/shared/user-preferences/user-preferences.client.ts`
- `src/adapters/persistence/settings/lowdb-user-preferences.adapter.ts`

Risiko: Drift zwischen Client- und Adapter-Semantik, inkonsistente Daten, schwerere Wartung.

### Ziel

Eine zentrale, wiederverwendbare Preferences-Schema-/Sanitizing-Schicht, die sowohl Client als auch LowDB-Adapter verwenden.

### Konkrete Umsetzung

1. Neues Shared-Modul erstellen, z. B.:
   - `src/shared/user-preferences/user-preferences.schema.ts`
2. Dort zentralisieren:
   - `UserPreferences`-Typen (sofern sinnvoll)
   - `sanitizeUserPreferences(value: unknown): UserPreferences`
   - `sanitizeSavedQueryPreference(...)`
   - `clamp`/Hilfsfunktionen (nur falls wirklich wiederverwendet)
3. In Client und LowDB-Adapter die lokale Sanitizing-Implementierung entfernen und nur noch Shared-Funktionen importieren.
4. Tests ergänzen/angleichen:
   - Unit-Tests für Schema-Modul (happy paths + invalid input + edge cases)
   - Bestehende Client-/Adapter-Tests auf Regression prüfen
5. Verhalten unverändert halten (kein Schema-Breaking in diesem Schritt).

### Akzeptanzkriterien

- Kein doppelter Sanitizing-Code mehr in Client und Adapter.
- Alle bisherigen Tests grün.
- Neue Schema-Tests vorhanden.
- Roundtrip GET/POST `/phase2/user-preferences` verhält sich unverändert.

### Risiko & Mitigation

- Risiko: subtiler Behavior-Drift bei Sanitizing.
- Mitigation: Golden-Tests mit repräsentativen Payloads vor/nach Refactor.

---

## 3.2 Paket B (Priorität 2): Generische Preference-Store-Factory im Gantt-Bereich

Status: ✅ Abgeschlossen (2026-03-11, inkl. schrittweiser Migration)

### Problem

Mehrere Dateien implementieren dasselbe Muster für `load/save/hydrate/clear`, Memory-Cache, LocalStorage-Fallback und API-Persistenz.

Beispiele:

- `timeline-density-preference.ts`
- `timeline-color-coding-preference.ts`
- `timeline-viewport-preference.ts`
- `timeline-details-width-preference.ts`
- `timeline-sidebar-width-preference.ts`
- `timeline-label-fields-preference.ts`
- `timeline-sidebar-fields-preference.ts`

### Ziel

Boilerplate reduzieren, Verhalten vereinheitlichen, neue Preferences günstiger machen.

### Konkrete Umsetzung

1. Generischen Baustein einführen, z. B. `createUserPreferenceStore<T>(...)`.
2. Parameterisieren über:
   - `storageKey`
   - `readFromServerCache(preferences)`
   - `sanitize(value)`
   - `serialize/deserialize` (JSON/string)
   - `patchBuilder` für `persistUserPreferencesPatch`
3. Bestehende Module schrittweise migrieren (nicht alle auf einmal).
4. Pro Migration gezielte Tests.

### Akzeptanzkriterien

- Deutlich weniger Duplikat-Code in den Preference-Dateien.
- Verhalten (Hydration/Fallback/Persistenz) bleibt gleich.
- Alle betroffenen Tests grün.

---

## 3.3 Paket C (Priorität 3): `TimelinePane` in domänenspezifische Hooks und Subcomponents schneiden

Status: 🟡 Teilweise abgeschlossen (2026-03-11, erste Hooks/Subcomponents extrahiert)

### Problem

`timeline-pane.tsx` ist sehr groß und vereint viele Verantwortlichkeiten:

- Viewport-/Zoom-/Scroll-Management
- Drag/Resize/Pan
- Dependency-Editing
- Filter-/Label-/Color-Coding-UI
- Persistenznahe Seiteneffekte

### Ziel

Komplexität reduzieren, Local Reasoning verbessern, testbare Einheiten schaffen.

### Konkrete Umsetzung

1. Verantwortungsblöcke extrahieren:
   - `useTimelineViewport(...)`
   - `useScheduleDragging(...)`
   - `useDependencyEditing(...)`
   - `useTimelineFilters(...)`
2. UI-Blöcke als Präsentations-Komponenten kapseln:
   - Toolbar/Controls
   - Sidebar-Bereich
   - Chart-Layer
   - Details-Panel-Anbindung
3. Bestehende Prop-Verträge stabil halten.
4. Schrittweise extrahieren und je Schritt testen.

### Akzeptanzkriterien

- `TimelinePane` wird primär Orchestrator.
- Komplexe Interaktionen sind über Hook-Tests oder Komponenten-Tests abgesichert.
- Keine Regression in E2E-Flows.

---

## 3.4 Paket D (Priorität 4): `ui-client.tsx` auf Bootstrapping reduzieren

Status: ✅ Abgeschlossen (2026-03-11)

### Problem

`ui-client.tsx` bündelt Bootstrapping, Persistenzdetails, Theme-Handling, Query-Context-Fallbacks und Timeline-Mutationslogik.

### Ziel

Sauberere Start-/Orchestrierungsschicht; Logik in dedizierten Services/Utilities.

### Konkrete Umsetzung

1. Persistenz-Helfer auslagern (Query-Context, UI-Shell-State, Theme).
2. Timeline-Mutationen in eigenes UI-Domain-Modul verschieben.
3. `ui-client.tsx` auf Composition/Rendering reduzieren.

### Akzeptanzkriterien

- Reduzierte Dateigröße/Komplexität.
- Gleiches Laufzeitverhalten.
- Bestehende Integrations- und UI-Tests grün.

---

## 3.5 Folgepakete E (abgeschlossen)

Status: ✅ Abgeschlossen (2026-03-11)

### Checkliste

- [x] Paket E1: `TimelinePane` weiter modularisieren (`useScheduleDragging`, `useDependencyEditing`, `useTimelineFilters`) und gezielte Hook-Tests ergänzen.
- [x] Paket E2: `timeline-color-coding-preference.ts` auf `createUserPreferenceStore<T>` migrieren (inkl. Field-Config-Persistenzpfad), Verhalten unverändert halten.
- [x] Paket E3: Restliche Orchestrierungslogik aus `ui-client.tsx` weiter auslagern (Header-Query-Flow, Runtime-State-Color-Enrichment).
- [x] Paket E4: Unit-Tests für neue Utility-Module ergänzen:
  - `src/app/bootstrap/ui-client-storage.ts`
  - `src/app/bootstrap/ui-client-theme.ts`
  - `src/app/bootstrap/ui-client-timeline-mutations.ts`
- [x] Paket E5: Query-/Header-Workflow in dedizierten State-Container/Service schneiden, damit Render- und Ablauf-Logik klar getrennt sind.

### Ergebnisnotiz

- E1-E5 wurden ohne beabsichtigte Verhaltensänderung umgesetzt.
- `timeline-pane.tsx` nutzt extrahierte Hooks (`useScheduleDragging`, `useDependencyEditing`, `useTimelineFilters`) und hat zusätzliche Hook-Tests.
- Color-Coding-Preferences sind auf die generische Store-Factory migriert, Persistenzpfad für Field-Config blieb stabil.
- `ui-client.tsx` wurde weiter entkoppelt (Header-Query-Service + Runtime-State-Color-Enrichment in dedizierte Module).

---

## 3.6 Neue offene Folgepakete F (Roadmap)

Status: 🔄 Offen

### Paket F1 (Priorität 1): `TimelinePane` final in Orchestrator + Fachmodule schneiden

### Problem

`src/features/gantt-view/timeline-pane.tsx` ist trotz E1 weiterhin sehr groß und trägt noch mehrere technische Verantwortungen gleichzeitig.

### Ziel

`TimelinePane` auf klaren Orchestrator reduzieren, interaktive Kernlogik in dedizierte Hooks/Services aufteilen.

### Konkrete Umsetzung

1. Neue Hooks extrahieren und anbinden:
   - `useTimelineViewport(...)` (Zoom/Scroll/Viewport-Persistenz)
   - `useTimelineResizing(...)` (Sidebar-/Details-Resize inkl. Pointer-Handling)
   - `useTimelineColorCoding(...)` (Color-Mode + Field-Config UI-State)
2. UI-Blöcke in Subcomponents schneiden:
   - Toolbar/Controls
   - Filter-/Label-/Color-Menüs
   - Dependency-Layer
3. Gemeinsame Hilfsfunktionen in Utility-Dateien auslagern (insb. URL-Filter-Serialisierung und geometrische Helfer).
4. Schrittweise pro Block liefern (max. 1-2 neue Verantwortungen pro PR).

### Akzeptanzkriterien

- `timeline-pane.tsx` signifikant reduziert, primär Composition/Orchestrierung.
- Extrahierte Hooks/Subcomponents haben eigene Unit-/Komponententests.
- Bestehende `timeline-pane` Regressionstests bleiben grün.

### Risiken & Mitigation

- Risiko: feine Interaktionsregressionen (Drag/Resize/Dependency).
- Mitigation: Interaktions-Golden-Tests und gezielte Pointer-Flow-Tests je extrahiertem Hook.

---

### Paket F2 (Priorität 1): `ui-client.tsx` weiter entschlacken (Bootstrapping-only)

### Problem

`src/app/bootstrap/ui-client.tsx` enthält weiterhin umfangreiche Ablaufsteuerung, Polling, Header-Workflow und Recovery-Entscheidungen.

### Ziel

`ui-client.tsx` als schlanke Bootstrapping-/Composition-Schicht etablieren.

### Konkrete Umsetzung

1. Header-Query-Workflow vollständig in dedizierten State-Container überführen:
   - z. B. `useHeaderQueryState(...)` oder service+reducer-basierter Container.
2. ADO-Comm-Log-Polling in eigenes Modul kapseln:
   - z. B. `useAdoCommLogPolling(...)`.
3. Query-Run/Refresh-Orchestrierung in separatem Modul bündeln:
   - z. B. `ui-client-query-flow.ts`.
4. `UiShellApp` reduziert auf State-Komposition + Rendering.

### Akzeptanzkriterien

- `ui-client.tsx` deutlich kleiner und lesbarer.
- Flow-Logik testbar ohne DOM-Renderschicht.
- Verhalten in Query/Mapping/Timeline/Diagnostics unverändert.

### Risiken & Mitigation

- Risiko: Reihenfolge-/Timing-Fehler bei Async-Flows.
- Mitigation: deterministische Unit-Tests mit kontrollierten Mocks und In-Flight-Schutztests.

---

### Paket F3 (Priorität 2): Testsuite für Timeline nach Domänen aufteilen

### Problem

`timeline-pane.spec.tsx` ist umfangreich und erschwert schnelle lokale Analyse bei Fehlschlägen.

### Ziel

Tests domänenspezifisch strukturieren, ohne Abdeckungsverlust.

### Konkrete Umsetzung

1. Bestehende Tests logisch trennen, z. B.:
   - `timeline-pane.dependencies.spec.tsx`
   - `timeline-pane.filters.spec.tsx`
   - `timeline-pane.dragging.spec.tsx`
   - `timeline-pane.layout.spec.tsx`
2. Gemeinsame Fixtures/Test-Builder in eigene Helper-Datei auslagern.
3. Namenskonvention vereinheitlichen (`given/when/then`-lesbare Titel).

### Akzeptanzkriterien

- Gleiche Abdeckung bei besserer Wartbarkeit.
- Schnellere Fehlerlokalisierung in CI und lokal.

### Risiken & Mitigation

- Risiko: Testflaky durch unvollständig isolierte Fixtures.
- Mitigation: zentrale Fixture-Fabrik + saubere `afterEach`-Resets.

---

### Paket F4 (Priorität 2): Query-Intake Controller weiter in pure Mapping-/Flow-Module schneiden

### Problem

`query-intake.controller.ts` vereint Request-Orchestrierung, Fehlerabbildung und Response-Building.

### Ziel

Bessere Trennung von Ablaufsteuerung und Datentransformation.

### Konkrete Umsetzung

1. Response-/ViewModel-Builder in pure Funktionen auslagern.
2. Fehlerzuordnung (`toUserMessage`, Statusmapping) in dediziertes Modul schneiden.
3. Diagnostics-Emission-Hilfen kapseln.

### Akzeptanzkriterien

- Controller fokussiert auf Use-Case-Aufruf und Ablauf.
- Mehr Unit-Tests ohne schweren Integrations-Setup.

### Risiken & Mitigation

- Risiko: subtile Drift in Fehlertexten/Statuscodes.
- Mitigation: Snapshot-/Golden-Tests für repräsentative Fehlerfälle.

---

### Paket F5 (Priorität 3): HTTP-Server nach Route-Domänen modularisieren

### Problem

`http-server.ts` ist groß und bündelt viele Endpunkte/Seiteneffekte.

### Ziel

Routen klar trennen und Wartbarkeit erhöhen.

### Konkrete Umsetzung

1. Routenmodule nach Domäne schneiden:
   - Query
   - Timeline Writes
   - User Preferences
   - Diagnostics/Health
2. Gemeinsame HTTP-Utilities zentralisieren:
   - Response-Writer
   - Fehlerformatierung
   - Input-Parsing
3. Bestehendes API-Verhalten 1:1 beibehalten.

### Akzeptanzkriterien

- Niedrigere Komplexität pro Modul.
- Unveränderte API-Verträge.
- Bestehende `http-server.spec.ts` und betroffene Integrationspfade grün.

### Risiken & Mitigation

- Risiko: Routing-Reihenfolge oder Header-Verhalten verändert sich.
- Mitigation: route-spezifische Regressionstests + Contract-Checks.

---

### Paket F6 (Priorität 3): CSS-/Design-Struktur konsolidieren

### Problem

`local-ui.css` wächst als zentrale Sammeldatei und erschwert langfristige UI-Wartung.

### Ziel

Klarere CSS-Struktur entlang UI-Domänen bei gleichbleibendem Erscheinungsbild.

### Konkrete Umsetzung

1. Styles thematisch splitten (z. B. shell, timeline, diagnostics, controls).
2. Design-Tokens/Variablen zentralisieren (Farben, Spacing, Typografie).
3. Selektor-Komplexität reduzieren und Konventionen dokumentieren.
4. `Design_Concept.md` als visuelle Referenz strikt einhalten.

### Akzeptanzkriterien

- Keine sichtbaren UI-Regressionen.
- Wartbarere, nachvollziehbare Stylestruktur.
- Mobile/Desktop-Verhalten unverändert.

### Risiken & Mitigation

- Risiko: unbemerkte visuelle Seiteneffekte.
- Mitigation: Screenshot-basierte Vorher/Nachher-Prüfung der Kernseiten.

## 4. Empfohlene Reihenfolge und Meilensteine

1. [x] M1: Paket A abschließen (Schema zentralisieren)
2. [x] M2: Paket B in 2-3 Teil-PRs (erst einfache Preferences, dann komplexe wie Color-Coding/Viewport)
3. [ ] M3: Paket C iterativ abschließen (pro Hook/Subcomponent ein PR)
4. [x] M4: Paket D als abschließendes Orchestrierungs-Refactor
5. [x] M5: Paket E1/E2 abschließen (TimelinePane + Color-Coding-Store vereinheitlichen)
6. [x] M6: Paket E3/E4/E5 abschließen (UI-Orchestrierung final entkoppeln + Testabdeckung schließen)
7. [ ] M7: Paket F1/F2 abschließen (`timeline-pane` und `ui-client` weiter entschlacken)
8. [ ] M8: Paket F3 abschließen (Timeline-Testsuite modularisiert)
9. [ ] M9: Paket F4/F5 abschließen (Controller + HTTP-Server modularisiert)
10. [ ] M10: Paket F6 abschließen (CSS-Struktur konsolidiert)

## 5. Teststrategie pro Paket

- Unit:
  - Sanitizer/Schema, Utility-Funktionen, Hook-Logik
- Integration:
  - `/phase2/user-preferences` GET/POST Verhalten
  - Hydration-Fallbacks zwischen Cache, API und localStorage
- UI/E2E:
  - Query laden -> Timeline rendern
  - Density/Color/Label/Sidebar-Settings setzen und wiederfinden
  - Drag/Resize/Dependency-Flows

## 6. Definition of Done (gesamt)

- Duplikate in kritischen Kernpfaden signifikant reduziert.
- Keine funktionalen Regressionen in Kernflüssen.
- Refactoring-Schritte sind dokumentiert und nachvollziehbar.
- Neue Struktur erleichtert zukünftige Feature-Erweiterungen messbar.

## 7. Start mit Paket A (konkreter Arbeitsauftrag)

Erster technischer Schritt:

1. `user-preferences.schema.ts` anlegen
2. Sanitizer und Typen dorthin verschieben
3. Client und LowDB-Adapter auf Shared-Schema umstellen
4. Tests für das Schema hinzufügen

## 8. Umsetzungsstatus (Checkliste)

- [x] Paket A umgesetzt
- [x] Paket B umgesetzt
- [x] Paket D umgesetzt
- [ ] Paket C vollständig abgeschlossen (in Arbeit, erste Extraktionen erledigt)
- [x] Folgepakete E1-E5 umgesetzt
- [ ] Folgepaket F1 offen
- [ ] Folgepaket F2 offen
- [ ] Folgepaket F3 offen
- [ ] Folgepaket F4 offen
- [ ] Folgepaket F5 offen
- [ ] Folgepaket F6 offen

## 9. Koordinationsstand Folgepakete F (Stand: 11. März 2026)

### 9.1 Fortschritt (Schätzung)

- Gesamtfortschritt F1-F6: ca. **70 %**
- Restaufwand F1-F6: ca. **30 %**

### 9.2 Paketweise Schätzung

- F1: ca. 60 % (Resize-Block extrahiert; weitere Kernblöcke in `timeline-pane.tsx` offen)
- F2: ca. 75 % (Polling/Flow-Entscheidungen ausgelagert; weitere Orchestrierung in `ui-client.tsx` offen)
- F3: ca. 35 % (Test-Split begonnen; Monolith-Spec noch nicht domänenscharf aufgeteilt)
- F4: ca. 90 % (Mapping/Error/Diagnostics-Pure-Functions extrahiert; Feinschliff möglich)
- F5: ca. 80 % (Parsing/Resolver ausgelagert; Route-Domänenhandler noch weiter trennbar)
- F6: ca. 80 % (CSS-Datei strukturell gesplittet; visuelle Härtung noch offen)

### 9.3 Offene Refactoring-Punkte

1. F1 `timeline-pane.tsx` weiter entkoppeln:
   - `useTimelineViewport(...)` extrahieren (Zoom/Scroll/Fit/Persistenz)
   - `useTimelineColorCoding(...)` extrahieren (Mode/Field-Config/Settings-UI-State)
   - Toolbar/Filter/Label/Color-Blöcke weiter in Subcomponents schneiden
2. F2 `ui-client.tsx` auf Bootstrapping reduzieren:
   - Header-Query-CRUD-Flow in Hook/Service verschieben
   - Refresh/Retry-Orchestrierung in separates Flow-Modul verschieben
   - Writeback-/Sync-Orchestrierung weiter kapseln
3. F3 Timeline-Testsuite final splitten:
   - `timeline-pane.spec.tsx` in Domänenspecs aufteilen (`dependencies`, `filters`, `dragging`, `color-coding`, `layout`)
   - gemeinsame Fixtures/Builder in zentrale Helper-Datei auslagern
4. F5 HTTP-Server domänenscharf schneiden:
   - Route-Handler pro Domäne (`query`, `timeline-writes`, `preferences`, `diagnostics/health`)
   - `http-server.ts` auf Wiring/Dispatch reduzieren
5. F6 visuelle Härtung:
   - visuelle Smoke-/Snapshot-Checks nach CSS-Split
   - kurze Dokumentation der CSS-Struktur/Tokens ergänzen

### 9.4 Empfohlene Reihenfolge (nächste PR-Wellen)

1. F1 fertigziehen (höchster Komplexitätshebel, Interaktionsrisiko früh absichern)
2. F3 direkt danach (Tests parallel zur neuen Struktur stabilisieren)
3. F2 final entschlacken
4. F5 Route-Domänenhandler finalisieren
5. F6 visuelle Abnahme + Abschlussdoku

## 10. Trigger-Prompt für weitere Umsetzung

```text
Du koordinierst mehrere unabhängige Coding-Agenten zur Abarbeitung der offenen Refactoring-Restarbeiten aus `docs/runbook/refactoring-plan.md`, Abschnitt 9.3 (Stand 11. März 2026).

Ziel:
- Refactor-only umsetzen (kein Feature-Change, kein UX-/API-Verhalten ändern).
- Wo möglich parallel arbeiten.
- Keine Datei darf gleichzeitig von zwei Agenten geändert werden.
- Jede Änderung PR-ready liefern (Code + Tests + kurze Doku-Notiz).

Globale Regeln:
1) Strict Scope je Agent, keine Workarounds außerhalb des Scopes.
2) No overlap: keine Dateiüberschneidungen zwischen Agenten.
3) Bei Abhängigkeit sofort STOP + BLOCKER melden (Datei, Vorarbeit, Grund).
4) AGENTS.md strikt einhalten (inkl. lowdb als Source of Truth, Design_Concept.md-Konformität).
5) Qualität je Agent: `npm run typecheck`, `npm run lint`, betroffene Test-Slices.

Batch A (parallel):
- Agent A1 (F1): `timeline-pane.tsx` weiter Richtung Orchestrator schneiden; `useTimelineViewport`, `useTimelineColorCoding`, weitere Subcomponents.
- Agent A2 (F2): `ui-client.tsx` auf Bootstrapping reduzieren; Header-Query-Flow + Refresh/Retry + Sync-Orchestrierung weiter auslagern.
- Agent A5 (F5): `http-server.ts` in Route-Domänenhandler schneiden; API-Verträge 1:1 stabil halten.

Batch B (nach A1):
- Agent A3 (F3): `timeline-pane.spec.tsx` weiter in Domänen-Dateien splitten + gemeinsame Fixtures zentralisieren.

Batch C (nach A1/A2):
- Agent A6 (F6): visuelle Smoke-/Snapshot-Härtung nach CSS-Split + kurze CSS-Struktur-Doku.

Output je Agent:
- Summary (5-10 Zeilen)
- Changed files (absolute Pfade)
- Tests run (konkrete Commands + Ergebnis)
- Risks / Follow-ups
- Blocker (oder `none`)

Koordinator-Abnahme:
1) Agent-Outputs sammeln
2) Datei-Overlap prüfen (muss 0 sein)
3) Gesamtlauf: `npm run typecheck`, `npm run lint`, zielgerichtete Regressionen
4) `docs/runbook/refactoring-plan.md` Status nur aktualisieren, wenn Pakete wirklich abgeschlossen sind
```
