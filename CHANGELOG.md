# Changelog

Alle nennenswerten Änderungen an AzureGanttOps werden in dieser Datei dokumentiert.

Hinweis: Historische Versionen vor `1.8.1` sind grob aus den sichtbaren Commit-Schwerpunkten rekonstruiert, da im Repository keine Release-Tags vorhanden sind.

## [1.8.4] - 2026-06-28

### Hinzugefügt

- Tastatur-Symbol neben der Versionsnummer öffnet eine kompakte Übersicht der wichtigsten Timeline-Tastenkombinationen im gemeinsamen Header-Dialog.

## [1.8.3] - 2026-06-27

### Hinzugefügt

- Azure-Query-Aktualisierungen prüfen im Hintergrund, ob auf GitHub eine neuere App-Version verfügbar ist.
- Versionsanzeige zeigt bei verfügbarem Update ein dezentes Ausrufezeichen, das den Changelog mit Update-Hinweis öffnet.
- Neuer lokaler Diagnose-Endpunkt `GET /phase2/app-update-check` liefert den stillen Update-Check ohne HTTP-Cache.

### Geändert

- Header zeigt den Changelog-Einstieg kompakt nur noch als Versionsnummer `v1.8.3`.
- One-Click-Start prüft npm-Abhängigkeiten jetzt gegen `package.json` und `package-lock.json`, damit neue Pakete nach einem Pull automatisch installiert werden.
- npm-Abhängigkeiten aktualisiert, sodass `npm audit` keine bekannten Vulnerabilities mehr meldet.

## [1.8.2] - 2026-06-27

### Geändert

- Changelog-Hinweis im Header öffnet die Release-Notizen jetzt als zugänglichen Dialog in der App.
- Paketversion für die Changelog-Dialog-Verbesserung auf `1.8.2` erhöht.

## [1.8.1] - 2026-06-26

### Hinzugefügt

- Sichtbarer Changelog-Hinweis im Header mit direktem Zugriff auf die Release-Notizen.
- Zentrale Projektmetadaten für App-Version und Changelog-Pfad, damit UI und lokaler Server dieselben Werte verwenden.
- Read-only Route `GET /CHANGELOG.md` mit Markdown-Auslieferung, Sicherheitsheadern und deaktiviertem HTTP-Cache.

### Geändert

- Paketversion explizit auf `1.8.1` gesetzt.

## [1.8.0] - 2026-06-26

### Hinzugefügt

- Erststart-Dialog für die Verbindung einer Azure DevOps Query per vollständiger Query-URL.
- Lokaler Konfigurationsreset aus dem Statusbereich.

### Geändert

- Header-Statusbadge und Theme-Umschaltung kompakter gestaltet.
- Initialer Query-Flow stärker auf URL-Eingabe ausgerichtet.

## [1.7.0] - 2026-06-10

### Hinzugefügt

- PWA-Unterstützung mit Manifest, Icons und Service Worker.
- Verbesserte Hinweise bei abgelaufener Azure-Session.

### Geändert

- Dependency-Writeback korrigiert.
- Kind-Work-Items übernehmen relevante Felder wie zugewiesene Person, Tags und Planungsdaten.
- Gantt-Zieldaten werden lokal konsistent auf 17:00 gesetzt.

## [1.6.0] - 2026-06-03

### Hinzugefügt

- Timeline-Filtergruppen und Datumsbereichsfilter.
- Kontextmenüs für Work Items mit Tastaturbedienung und Viewport-Begrenzung.
- Erstellung von Child Work Items aus dem Kontextmenü mit eingeschränkter Auswahl geeigneter Planungstypen.
- Baumlevel-Badges für sichtbare Query-Ebenen.

### Geändert

- Child-Type-Menü bleibt bei Re-Renders stabil.
- Externe Fontshare-Abhängigkeit aus UI und CSP entfernt.

## [1.5.0] - 2026-05-27

### Hinzugefügt

- Optimistische Duplizierung von Work Items.
- Performance-Logging für Refresh-Pfade.

### Geändert

- Azure-Hydration mit größerer Parallelität und abgestimmter Batch-Größe beschleunigt.
- Duplizierte Work Items übernehmen relevante System- und Planungsfelder.

## [1.4.0] - 2026-05-04

### Hinzugefügt

- Print-Ansicht per `Cmd+P` für den aktuellen Gantt-Snapshot.
- Automatische Standard-Feldzuordnung beim ersten Query-Lauf.
- Iterationsbasierte Datumsableitung für halb geplante Work Items inklusive Hinweis in den Details.

### Geändert

- Node.js-Engine und Lockfile-Angaben präzisiert.
- Verbose-Logging-Konfiguration für Azure DevOps korrigiert.

## [1.3.0] - 2026-04-21

### Hinzugefügt

- Edit-Modus mit per Work Item auslösbarer Übernahme geplanter Daten.
- Quarter- und Year-Zoomlevel sowie Auto-Scroll beim Ziehen von Timeline-Balken.
- Warnungen bei ungespeicherten Timeline-Änderungen vor Refresh oder Tab-Schließen.

### Geändert

- Iterationsdaten werden über einen eigenen Port geladen und gecacht.
- Zoom- und Drag-Verhalten stabilisiert.

## [1.2.0] - 2026-04-13

### Hinzugefügt

- Tree- und One-Hop-Query-Unterstützung mit Erhalt von Hierarchie und Abhängigkeiten.
- Reparenting per Drag-and-drop.
- Verbesserte Dependency-Pfeile und Interaktionen.
- Öffnen gespeicherter Queries direkt in Azure DevOps aus dem Header.

### Geändert

- Query-Dropdown optisch verdichtet und mit Link-Icon versehen.

## [1.1.0] - 2026-03-19

### Hinzugefügt

- Lokale HTTP-UI-Shell mit One-Click-Startup.
- Persistente Timeline-Preferences für Dichte, Farbcodierung, Sidebar, Details, Labels und Viewport.
- Live-Sync-Steuerung für Timeline-Änderungen.
- Timeline-Sortierung, Feldfilter, Auswahlhervorhebung und Overlay-Korrekturen.

### Geändert

- UI-Client und Timeline-Interaktionen modularisiert.
- Lokaler Server-Start und Build-Artefaktprüfung robuster gestaltet.

## [1.0.0] - 2026-03-09

### Hinzugefügt

- Query-driven Gantt-Grundlage mit Azure CLI Preflight, Azure DevOps Kontext, Query-Ausführung und Work-Item-Hydration.
- Mapping-Validierung, Mapping-Persistenz und Canonical Planning Model.
- Timeline-Rendering mit Balken, unschedulable Work Items, Dependency-Darstellung und Trust-/Freshness-Zuständen.
- Diagnostics-Tab, Statusflächen und strukturierte Laufzeitdiagnostik.
- Read/Write-Grenze mit initial deaktiviertem Write-Pfad.

### Geändert

- Phase-6-Runtime, lokale UI und Quality-Gates als lauffähige Basis zusammengeführt.
