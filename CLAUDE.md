# CLAUDE.md

## Rolle und Auftrag
Du bist ein **Senior Software Architect + Staff Engineer** und sollst dieses Projekt als **Greenfield-Neuentwicklung** umsetzen.

Wichtig: Ursprünglich war geplant, das alte Projekt weiterzuverwenden. Diese Entscheidung ist geändert.
**Neue Vorgabe:** Das bisherige Legacy-Projekt wird **nicht** weiterverwendet. Keine Rücksicht auf Backward Compatibility im Altcode nötig.

Dein Ziel ist, eine neue, robuste, wartbare Lösung zu bauen für:
**Azure DevOps Query-Driven Gantt (v1)**.

---

## Entscheidungsgrundlage (verbindlich)

- Das bestehende Codebase-Design verletzt zentrale Architekturprinzipien (Hexagonal/Clean/SOLID/DDD) und ist nicht die Grundlage für den Neustart.
- Das neue Projekt wird als **strukturierter Rewrite** umgesetzt (kein Big-Bang ohne Plan, sondern phasenweise Lieferung).
- Fokus auf **verlässliche Datenpipeline** (Query → IDs/Relations → Hydration → Mapping → Timeline), nicht auf UI-first-Bastellösungen.

---

## Produktziel

Baue ein System, das Azure DevOps Saved Queries zuverlässig ausführt und Work Items als vertrauenswürdige Gantt-Timeline visualisiert:

- query-driven
- v1 mit klar steuerbaren Read/Write-Capabilities
- klare Freshness-/Error-/State-Transparenz
- saubere Grundlage für spätere Write-back-Funktionen (v2)

---

## Verbindliche Architektur- und Qualitäts-Pillars (Non-negotiable)

Diese Regeln müssen **immer** eingehalten werden:

1. Hexagonal Architecture (Ports & Adapters)
2. Clean Architecture
3. SOLID
4. Tactical DDD / bounded-context-oriented module boundaries
5. Twelve-Factor App mindset
6. C4-model documentation mindset
7. Maintainability-Fokus (ISO/IEC 25010)
8. Quality Gate Ziel:
   - Sonar Rating A
   - Coverage >= 80%
   - Keine zyklischen Abhängigkeiten

Zusätzlich aus Projektvorgaben:

- Keine Dummy-/Fake-/Placeholder-Produktlogik einbauen.
- Live-Berechnung statt Hardcoded/Dummy-Logik.
- Wenn etwas noch fehlt: explizit `[@TODO] not yet implemented` statt Fake-Verhalten.
- Probleme nicht direkt in Containern patchen; Code ändern und Umgebung sauber neu bauen.

---

## Business Scope

## v1 (MUSS)

### Authentication & Session
- AUTH-01: Lokale Azure CLI Session validierbar vor Datenladung.
- AUTH-02: Azure DevOps Organization/Project Kontext setzbar.

### Query Source & Selection
- QRY-01: Saved Queries aus freigegebenem Scope listen.
- QRY-02: Query-Auswahl per stabiler Query-ID.
- QRY-03: Query-Wechsel triggert vollständiges Timeline-Reload.

### Data Ingestion
- ING-01: Ausgewählte Query ausführen, IDs + Relations erfassen.
- ING-02: Work Item Details in bounded batches laden (**max 200 IDs/Request**).
- ING-03: Transiente Fehler mit Backoff behandeln; klare Fehlerkommunikation.

### Field Mapping
- MAP-01: Mapping für mindestens ID, Title, Start Date, End/Target Date.
- MAP-02: Required Mappings validieren, klare Mapping-Fehler.
- MAP-03: Mapping lokal persistieren und beim nächsten Start anwenden.

### Timeline Rendering
- GNT-01: Gantt aus Query-Ergebnis anzeigen.
- GNT-02: Pro Task mapped ID + Titel sichtbar.
- GNT-03: Keine erfundenen Datumswerte bei fehlenden Feldern.
- GNT-04: Parent/Child + Dependency-Semantik korrekt erhalten.

### Reliability & UX Trust
- REL-01: Klare Zustände (loading/empty/auth failure/query failure/partial failure).
- REL-02: Freshness-Metadaten (z. B. last refresh + active query source).
- REL-03: Typische Results < ~200 Items zuverlässig interaktiv nutzbar.

## v2 (DEFERRED)
- WRT-01..WRT-05 (Write-back inkl. Optimistic Concurrency)
- QRYX-01 (In-App WIQL Authoring)

## Out of Scope in v1
- In-App WIQL Editor
- Browser-only direkte Azure DevOps Auth/API Calls
- Automatisches Erfinden fehlender Schedulings

---

## Zielarchitektur (konkret)

Implementiere eine klare Trennung in Domäne, Anwendung, Adapter, UI.

Vorschlag für Zielstruktur:

```text
src/
  app/
    composition/
    config/
    bootstrap/
  domain/
    planning-model/
      entities/
      value-objects/
      services/
      policies/
    mapping/
    query-runtime/
  application/
    use-cases/
    ports/
    dto/
  adapters/
    azure-devops/
      rest-client/
      auth/
      queries/
      work-items/
    persistence/
      settings/
      cache/
    telemetry/
  features/
    query-switching/
    field-mapping/
    gantt-view/
    diagnostics/
  shared/
    types/
    utils/
    errors/
```

### Pflichtprinzipien für die Architektur

- UI kennt nur Application Use Cases, niemals Azure DTOs direkt.
- Azure-spezifische Details bleiben in Adaptern.
- Domain-Modell ist Azure-agnostisch.
- Read model und späteres Write-back strikt getrennt (Command-Seite isoliert vorbereiten).

---

## Datenpipeline (verbindlich)

Implementiere den Flow exakt so:

1. Saved Query via ID ausführen
2. IDs + Relations normalisieren (flat/tree/one-hop berücksichtigen)
3. Work Item Details in Chunks laden (max 200 IDs pro Call)
4. Field Mapping + Validierung
5. Canonical Planning Model erzeugen
6. Timeline rendern
7. Freshness + Source Health aktualisieren

### Kritische Fehler, die zu vermeiden sind

1. WIQL/Query-Result als finales Rendering-Payload behandeln
2. Query-Namen/Path statt stabiler ID als Identität nutzen
3. Hierarchie/Dependencies beim Mapping verlieren
4. Zeitzonen-/DST-Drift nicht absichern
5. Breite Refreshes ohne Rate-Limit-Strategie

---

## Technische Leitplanken (Stack-Orientierung)

Empfohlene Richtung (anpassbar mit Begründung):

- Node.js 22 LTS
- TypeScript 5.9
- React 19 + Vite 7
- Lokaler BFF (z. B. Fastify 5)
- Azure DevOps REST API 7.1
- Azure CLI + azure-devops extension für lokale Session/Auth
- Zod für Runtime-Validierung
- Query-State-Management (z. B. TanStack Query)

Wenn du von diesen Entscheidungen abweichst, dokumentiere die Abweichung via ADR inkl. Trade-off.

---

## Roadmap (neu, auf Rewrite angepasst)

## Phase 0 — Greenfield Foundation

Liefern:
- Neues Repository-/Workspace-Layout (saubere Layer)
- Tooling: lint/format/typecheck/test
- CI-Quality-Gates (Coverage, Sonar, cycle checks)
- C4-Doku-Skeleton + ADR-Skeleton

Akzeptanz:
- Build reproduzierbar
- Mindest-Qualitätsgates technisch verdrahtet

## Phase 1 — Integration Foundation & Ingestion Contract

Liefern:
- Auth preflight (AUTH-01, AUTH-02)
- Query listing/selection by ID (QRY-01, QRY-02)
- Zwei-Stufen-Ingestion-Skelett (ING-01 Start)
- Adapter-Ports fixiert

Akzeptanz:
- End-to-end happy path: Query-ID -> IDs/Relations sichtbar

## Phase 2 — Hydration, Normalisierung, Stabilität

Liefern:
- Chunked Hydration <=200 IDs (ING-02)
- Retry/Backoff + Fehlerbilder (ING-03)
- Normalisierung flat/tree/one-hop
- Query switch reload path (QRY-03)

Akzeptanz:
- Robust gegen transiente API-Fehler
- Semantik bleibt erhalten

## Phase 3 — Mapping & Timeline

Liefern:
- Mapping-Konfiguration + Persistenz (MAP-01..03)
- Canonical Planning Model
- Gantt Rendering (GNT-01..04)

Akzeptanz:
- Keine fabricated dates
- Mapped fields vollständig und validiert

## Phase 4 — UX Trust & Resilience

Liefern:
- Distinkte UI states (REL-01)
- Freshness/source metadata (REL-02)
- Performance für typische <200 Datensätze (REL-03)
- Cache-Strategie + rate-limit-aware Verhalten

Akzeptanz:
- Zuverlässiger produktiver Flow im Zielkorridor

## Phase 5 — v1.x Hardening + v2 Readiness

Liefern:
- Diagnostics/Source health
- Optional Mapping-Templates
- Saubere Write-back command boundary

Akzeptanz:
- v1 stabil, v2 vorbereitet ohne Architekturbruch

---

## Qualitätsstrategie und Definition of Done

Eine Phase gilt nur als „done“, wenn:

1. Funktionale Anforderungen der Phase erfüllt sind.
2. Automatisierte Tests vorhanden sind (Unit + Integrations-/Contract-Tests, ggf. E2E für Kernpfade).
3. Coverage-Richtung eingehalten wird (Road to >=80%).
4. Lint/Format/Typecheck ohne Fehler.
5. Keine zyklischen Abhängigkeiten.
6. Relevante Architekturentscheidung dokumentiert (ADR bei Trade-offs).
7. Sicherheitsrisiken adressiert (Input/Output, API Errors, XSS/Injection-Vermeidung).
8. Keine Dummy-Implementierungen im Produktverhalten.

---

## Sicherheits- und Robustheitsanforderungen

- Keine Secrets im Code/Repo.
- Keine Browser-seitigen direkten Azure Tokens für Core-Calls.
- Fehler müssen nachvollziehbar, aber ohne sensitive Daten ausgegeben werden.
- Explizite Behandlung von:
  - Rate limiting
  - API timeouts
  - Partial data failures
  - Invalid mappings

---

## Dokumentation (MUSS)

Halte parallel zur Implementierung folgende Doku aktuell:

1. **C4 light**
   - Context
   - Container
   - Component (für Kernmodule)
2. **ADRs** für nicht-triviale Entscheidungen
3. **Requirements Traceability** (REQ-ID → Phase → Implementierung/Tests)
4. **Operational runbook** (lokale Auth, Start, Troubleshooting)
5. **Design-Umsetzungs-Checkliste**
   - Verwende [`DESIGN_IMPLEMENTATION_CHECKLIST.md`](/Users/chris/Azure%20GanttOps/DESIGN_IMPLEMENTATION_CHECKLIST.md) als zentrales Tracking-Dokument.
   - Design-Änderungen gelten nur dann als abgeschlossen, wenn die entsprechenden `[MUST]`-Punkte und `Phase-DoD` dort abgehakt sind.

---

## Arbeitsmodus / Umsetzungsregeln für den ausführenden Agent

- Arbeite phasenweise und liefere lauffähige Inkremente.
- Keine unnötige Over-Engineering-Abstraktion.
- Keine stillen Annahmen: offene Punkte explizit markieren.
- Bei fehlender Umsetzbarkeit: `[@TODO] not yet implemented` mit klarer Begründung.
- Bevorzugt einfache, klare Lösungen, solange sie die Pillars nicht verletzen.

---

## Git- und Delivery-Konventionen

- Commit-Style: `feat:` / `fix:` mit klarer Aussage.
- Trailer in Commit-Nachrichten:

`Co-Authored-By: T5.Code <code@tensorfive.com>`

- Keine Claude/AI-Attribution, keine Emojis, keine Tool-Referenzen in Commit Messages.
- Für abgeschlossene Änderungen gehören Commit + Push zum Done-State.

---

## Konkrete Startaufgabe (jetzt ausführen)

1. Lege Greenfield-Architekturstruktur und Build-/Test-/Quality-Skeleton an.
2. Implementiere minimalen End-to-End-Flow für:
   - Auth Preflight
   - Saved Query Listing + Query by ID
   - IDs/Relations sichtbar machen
3. Schreibe die ersten Contract-Tests für Adapter und Ingestion-Pipeline.
4. Dokumentiere die ersten 2–3 ADRs (Auth-Ansatz, Adaptergrenzen, Canonical Model).
5. Liefere eine kurze Gap-Liste der offenen Anforderungen (REQ-IDs).

---

## Erfolgskriterium des gesamten Projekts

Das Projekt ist erfolgreich, wenn v1 als Query-driven Gantt **fachlich korrekt, technisch stabil und architektonisch sauber** betrieben werden kann — mit belastbarer Grundlage für spätere Write-back-Funktionalität, ohne erneuten Architektur-Neustart.
