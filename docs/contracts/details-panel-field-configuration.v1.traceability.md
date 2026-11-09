# Traceability-Matrix: Konfigurierbare Detail-Seitenleiste v1

Referenz: `docs/contracts/details-panel-field-configuration.v1.html`
(SHA-256 `fe6b37f79d6bf2404cc1f280449e5df3fb0e583c0d016afc0162d8fc5b47c536`, freigegeben am 09.11.2026).

Testdateien:

- **E2E**: `tests/e2e/details-panel-field-configuration.spec.ts` (Playwright, Runtime-Harness mit gebautem App-CSS)
- **API**: `src/app/bootstrap/http-server.details-fields.spec.ts` (Vitest, lokaler BFF mit gefälschtem Azure-DevOps-HTTP-Client)
- Harness-Erweiterung: `tests/e2e/runtime-harness.ts` (Felddefinitionen, Erfassung der Speicheraufrufe, simulierte Speicherfehler)

Testnamen werden über ihr Präfix referenziert, zum Beispiel E2E „DPF-12“.

| Anforderung | Teilklausel | Tests |
|---|---|---|
| DPF-01 | Zahnrad rechts neben ID-Pille, 32 × 32 px | E2E „DPF-01“ |
| | aria-label „Configure details fields“, Tooltip „Configure fields“ | E2E „DPF-01“ |
| | sichtbar ohne Auswahl | E2E „DPF-01“, E2E „DPF-16“ |
| | ausgeblendet bei verborgenem Inhalt | E2E „DPF-01“ |
| DPF-02 | öffnet unterhalb, rechtsbündig; aria-expanded | E2E „DPF-02“ |
| | schließen per erneutem Klick, Esc, Außenklick | E2E „DPF-02“ |
| | Änderungen live, kein Übernehmen-Button | E2E „DPF-02“, E2E „DPF-03 DPF-08“ |
| DPF-03 | „Shown“ mit Anzahl im Abschnittskopf | E2E „DPF-03 DPF-08“ |
| | „Available“ alphabetisch mit Suchfeld „Search field“ | E2E „DPF-03 DPF-08“ |
| DPF-04 | Built-ins vollständig, je genau einmal | E2E „DPF-04“ |
| | Azure-Felder der Query-Typen, live angefragt | E2E „DPF-04“, API „DPF-04 DPF-17“ |
| | keine Duplikate; Start/End ersetzen die gemappten Schedule-Felder (kein „Start Date“/„Target Date“), ID/Work Item Type nicht doppelt | E2E „DPF-04“, API „DPF-04 DPF-17“ (Title nur einmal) |
| | Story Points sichtbar, auch ohne Wert | E2E „DPF-04“ |
| | Name, Typ, Schreibschutz, Auswahlwerte aus Azure | API „DPF-04 DPF-17“ |
| DPF-05 | Fallback auf geladene Felder, Built-ins weiter einmalig und bearbeitbar | E2E „DPF-05“ |
| | Zusatzfelder schreibgeschützt und volle Breite | E2E „DPF-05“ |
| | Hinweistext | E2E „DPF-05“ |
| | Fehlerantwort des BFF | API „DPF-05“ (ergänzt um eine Prüfung aus der Projekt-Sicherheitsregel, keine Vertragsklausel) |
| DPF-06 | Griff, Name, Referenz bzw. „Built-in“ | E2E „DPF-06“ |
| | Badge „½“/„Full“, Badge „Edit“ | E2E „DPF-06“, E2E „DPF-12“, E2E „DPF-17“ |
| | ↑/↓/× und Deaktivierung am Rand | E2E „DPF-06“ |
| DPF-07 | Drag & Drop mit Einfügelinie in Primärfarbe | E2E „DPF-07“ |
| | ↑/↓-Buttons | E2E „DPF-07“ |
| | Alt+↑/↓, Fokus bleibt | E2E „DPF-07“ |
| DPF-08 | „+“ hängt ans Ende an, Remove zurück | E2E „DPF-03 DPF-08“ |
| | Suche nach Name und Referenz, ohne Beachtung der Schreibweise | E2E „DPF-03 DPF-08“ |
| | „No matching field.“ | E2E „DPF-03 DPF-08“ |
| DPF-09 | Reset to default | E2E „DPF-09 DPF-20“ |
| DPF-10 | Position bleibt, ausgegraut, „Not in current query“, entfernbar, nicht angezeigt | E2E „DPF-10“ |
| DPF-11 | ein Feld-Grid, alte Zeilenliste entfällt | E2E „DPF-11 DPF-15“ |
| DPF-12 | Breitentabelle: Zahl, Datum, Boolean, Auswahlliste/State/Typ, Identität, abgeleitet → ½ | E2E „DPF-12“, E2E „DPF-06“ |
| | Breitentabelle: Text, HTML, Pfade, Tags, unbekannter Typ → Voll | E2E „DPF-12“ |
| | Paarung nur mit dem direkt folgenden sichtbaren halben Feld, sonst volle Breite | E2E „DPF-12“, E2E „DPF-14“ (ausgeblendetes Feld dazwischen) |
| DPF-13 | einspaltig unter 280 px Inhaltsbreite, inklusive Grenzwerte 275/285 px | E2E „DPF-13“ |
| | live beim Ziehen, ohne Neuladen | E2E „DPF-13“ |
| DPF-14 | „—“ in gedämpfter Farbe: Eingabefelder, Read-only-Felder, HTML-Felder | E2E „DPF-14“ |
| | für den Typ nicht definierte Felder ausgeblendet | E2E „DPF-14“ |
| DPF-15 | gestrichelte Wertbox ohne Eingabe | E2E „DPF-14“, E2E „DPF-11 DPF-15“ |
| | Kürzung mit „…“ und Tooltip | E2E „DPF-11 DPF-15“ |
| | Datumsformat lokal, „from iteration“, Dependencies-Text | E2E „DPF-11 DPF-15“ |
| DPF-16 | Hinweistext ohne Auswahl, Zahnrad nutzbar | E2E „DPF-16“ |
| DPF-17 | Text, Zahl, Auswahlliste/State, Boolean, Assigned To, HTML (auch Nicht-Built-in) bearbeitbar | E2E „DPF-17“ |
| | Azure-Schreibschutz respektiert | E2E „DPF-17“ (External Ref), API „DPF-04 DPF-17“ |
| | andere Identitäten, Start/End, Pfade, Tags, ID, Typ, Dependencies schreibgeschützt | E2E „DPF-17“, E2E „DPF-11 DPF-15“ |
| DPF-18 | Punkt/Komma, ≥ 0, max. 2 Nachkommastellen (inklusive „1,25“) | E2E „DPF-18“ |
| | Integer ≥ 0 (inklusive „-1“, „2.5“) | E2E „DPF-18“ |
| | Leeren entfernt den Wert | E2E „DPF-18“, API „DPF-19“ (remove) |
| | rote Umrandung, Fehlertexte, Save gesperrt | E2E „DPF-18“ |
| DPF-19 | Punkt in Primärfarbe am Label | E2E „DPF-19 dirty“ |
| | Save-Button und Cmd/Ctrl+S, ein Speichervorgang für alle Änderungen | E2E „DPF-19 dirty“, API „DPF-19“ |
| | ohne Neuladen aktualisiert: Seitenleiste, linke Spalte | E2E „DPF-19 dirty“ |
| | ohne Neuladen aktualisiert: Balkenbeschriftung, Farbcodierung | E2E „DPF-19 saved values update bar labels…“ |
| | ohne Neuladen aktualisiert: Filter | E2E „DPF-19 saved values re-evaluate…“ |
| | Fehler: „Save failed: …“, Entwurf bleibt | E2E „DPF-19 dirty“ |
| | Schutz ungespeicherter Änderungen für neue Felder | E2E „DPF-19 dirty“ (nur Story Points geändert) |
| DPF-20 | Standardreihenfolge | E2E „DPF-09 DPF-20“ |
| DPF-21 | global (nicht pro Query) in Nutzerpräferenzen | E2E „DPF-21“, API „DPF-21“ |
| | nach Neustart und Query-Wechsel angewendet | E2E „DPF-21“ |
| DPF-22 | Light- und Dark-Theme-Tokens | E2E „DPF-22“ |
| | Tastaturbedienung, sichtbarer Fokus, ARIA-Beschriftungen | E2E „DPF-22“, E2E „DPF-07“ |
