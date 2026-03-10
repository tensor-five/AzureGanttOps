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
