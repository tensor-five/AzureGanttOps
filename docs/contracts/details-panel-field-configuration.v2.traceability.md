# Traceability-Matrix: Konfigurierbare Detail-Seitenleiste v2

Referenz: `docs/contracts/details-panel-field-configuration.v2.html`
(SHA-256 `e05e5a363e8802935c9ae209a099bece3941d9a3779f63b1501ecbea7f8db481`, freigegeben am 09.11.2026; ersetzt v1).

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
| | Zusatzfelder als Textfeld bearbeitbar (Badge „Edit“), volle Breite | E2E „DPF-05“ |
| | Systemfelder (DPF-17) bleiben auch im Fallback schreibgeschützt | E2E „DPF-05“ (Created Date) |
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
| | Paarung nur mit dem direkt folgenden sichtbaren halben Feld, sonst volle Breite | E2E „DPF-12“, E2E „DPF-10“ (nicht angezeigtes Feld dazwischen) |
| DPF-13 | einspaltig unter 280 px Inhaltsbreite, inklusive Grenzwerte 275/285 px | E2E „DPF-13“ |
| | live beim Ziehen, ohne Neuladen | E2E „DPF-13“ |
| DPF-14 | „—“ in gedämpfter Farbe: Eingabefelder, Read-only-Felder, HTML-Felder | E2E „DPF-14 every configured field…“ |
| | jedes konfigurierte Feld bei jedem Item, unabhängig vom Typ | E2E „DPF-14 every configured field…“, E2E „DPF-14 DPF-19 fields unknown…“ |
| DPF-15 | gestrichelte Wertbox ohne Eingabe nur für verbleibende Read-only-Felder | E2E „DPF-14 every configured field…“, E2E „DPF-11 DPF-15“ |
| | Kürzung mit „…“ und Tooltip | E2E „DPF-11 DPF-15“ |
| | Datumsformat lokal, „from iteration“, Dependencies-Text | E2E „DPF-11 DPF-15“ |
| DPF-16 | Hinweistext ohne Auswahl, Zahnrad nutzbar | E2E „DPF-16“ |
| DPF-17 | alle Felder bearbeitbar, unabhängig vom Typ | E2E „DPF-17 every field…“, E2E „DPF-14 DPF-19 fields unknown…“ |
| | Controls: Text/Pfad/unbekannt → einzeiliges Textfeld; Tags → einzeiliger Text „a; b“; mehrzeilig → Textbereich; Zahl; Auswahlliste/State; Boolean; HTML → Richtext | E2E „DPF-17 every field…“, E2E „DPF-05“ (Fallback einzeilig) |
| | Personenfelder: Personen der Query, aktueller Wert (auch außerhalb der Query), „Unassigned“ | E2E „DPF-17 every field…“ (Reviewer) |
| | Datum/Uhrzeit: Start/End und weitere schreibbare Datumsfelder als Datum-Uhrzeit-Eingabe, minutengenau, lokale Zeit | E2E „DPF-17 every field…“ (Start, End, Due Date), E2E „DPF-17 DPF-19 Start, End…“ |
| | Azure-Schreibschutz (System) sowie ID, Typ, Dependencies bleiben read-only | E2E „DPF-17 every field…“, E2E „DPF-11 DPF-15“, API „DPF-04 DPF-17“ |
| | geleertes Feld entfernt den Wert | E2E „DPF-18“, API „DPF-19 saves all…“ |
| | Title/State nicht leer speicherbar | E2E „DPF-17 Title and State cannot be saved empty“ |
| | Speichern von Start/End, Due Date, Pfad, Tags, mehrzeiligem Text, Personenfeld | E2E „DPF-17 DPF-19 Start, End…“ |
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
| | Start/End verschieben den Balken | E2E „DPF-17 DPF-19 Start, End…“ |
| | keine Vorwarnung bei typfremden Feldern, Update wird gesendet | E2E „DPF-14 DPF-19 fields unknown…“ |
| | Azure-Fehlermeldung im Wortlaut | E2E „DPF-14 DPF-19 fields unknown…“, API „DPF-19 returns the Azure DevOps error message…“ |
| | Fehlermeldung ohne Zugangsdaten | API „DPF-19 returns the Azure DevOps error message…“ |
| | Schutz ungespeicherter Änderungen für neue Felder | E2E „DPF-19 dirty“ (nur Story Points geändert) |
| DPF-20 | Standardreihenfolge | E2E „DPF-09 DPF-20“ |
| DPF-21 | global (nicht pro Query) in Nutzerpräferenzen | E2E „DPF-21“, API „DPF-21“ |
| | nach Neustart und Query-Wechsel angewendet | E2E „DPF-21“ |
| DPF-22 | Light- und Dark-Theme-Tokens | E2E „DPF-22“ |
| | Tastaturbedienung, sichtbarer Fokus, ARIA-Beschriftungen | E2E „DPF-22“, E2E „DPF-07“ |
