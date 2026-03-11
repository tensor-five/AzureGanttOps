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

## 4. Empfohlene Reihenfolge und Meilensteine

1. M1: Paket A abschließen (Schema zentralisieren)
2. M2: Paket B in 2-3 Teil-PRs (erst einfache Preferences, dann komplexe wie Color-Coding/Viewport)
3. M3: Paket C iterativ (pro Hook/Subcomponent ein PR)
4. M4: Paket D als abschließendes Orchestrierungs-Refactor

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

