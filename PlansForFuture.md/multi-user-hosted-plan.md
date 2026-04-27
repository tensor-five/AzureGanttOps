# Multi-User / Hosted Variante von AzureGanttOps

## 1. Context & Ziel

Die aktuelle Anwendung ist als **lokaler Single-User-BFF** auf `127.0.0.1:8080` gebaut:
- User-Identität wird vom OS abgeleitet (`process.env.USER`)
- Auth läuft über `az login` oder einen `ADO_PAT` aus der Umgebung
- Persistenz ist eine einzelne lowdb-JSON-Datei unter `~/.azure-ganttops/`
- Modul-globaler Token-Cache ist single-user-only (Cross-Tenant-Bug, falls man stumpf ins Web stellt)

**Ziel:** Die App auf einem VPS in Docker hosten, sodass mehrere User sich per Browser einloggen, sich gegen **Microsoft Entra ID** authentifizieren, und jeweils ihre eigenen Queries / Mappings / Views / Themes haben.

## 2. Festgelegte Entscheidungen

| Entscheidung | Wahl | Begründung |
|---|---|---|
| **Auth-Modell** | Microsoft Entra ID OAuth 2.0 (Authorization Code + PKCE) | User loggen sich mit demselben MS-Account ein, mit dem sie auch ADO Web nutzen. Keine PATs, kein manuelles Token-Management. Refresh-Tokens 90 Tage gültig. |
| **Tenancy** | Eine geteilte ADO-Org/Project, User-isolierte Prefs | Internes Tool: alle arbeiten in derselben Org, jeder hat eigene Queries/Mappings/Views/Themes. ADO-Permissions kommen vom User-Token, kein eigenes Permission-System nötig. |
| **Hosting** | Single-VPS, Docker Compose Stack | Pragmatisch für 100–1000 User. Kein K8s, kein Cloud-Vendor-Lockin. |
| **Persistenz** | Postgres 16 (Tier 1) | Sweet Spot zwischen Einfachheit und Headroom. SQLite reicht nur bis ~100 User; Postgres trägt bis Tier 2 ohne Datenmigration. |

## 3. Aufwandseinschätzung

**~2–3 Wochen fokussierte Arbeit** für ein deploybares MVP.

Die Hexagonal-Architektur zahlt sich aus: **Domain + Application bleiben praktisch unverändert.** Der Umbau konzentriert sich auf:
- Auth/Session Layer (neu)
- Persistenz-Adapter (lowdb → Postgres)
- Token-Routing (modul-global → per-User)
- BFF Bootstrap (CLI-getrieben → HTTP-Session-getrieben)

Kein Rewrite. Alle bestehenden Ports bleiben.

---

## 4. Hexagonal-Mapping (was ändert sich wo)

### Domain (`src/domain/`) — **0% geändert**
- `planning-model/`, `query-runtime/`, `mapping/` → unverändert
- Domain weiß nichts über Auth/User/Persistenz, nur über Work Items, Relations, Iterations, Mappings

### Application (`src/application/`) — **~20% additiv**
**Bestehende Ports unverändert.** Drei neue Ports kommen dazu:
- `IdentityProviderPort` — fragt User-Identität + Tokens ab
- `SessionStorePort` — Session-Lifecycle
- `AdoTokenProviderPort` — vorher implizite Closure in `local-server.ts`, wird zum expliziten Port hochgezogen

`UserPreferencesPort` minimal refaktoriert: `userId` wandert aus Konstruktor in Methodensignaturen (`getPreferences(userId)` statt `getPreferences()`).

Use Cases & DTOs unverändert; bekommen `userId` als zusätzlichen Eingabewert wo Persistenz im Spiel ist.

### Adapters (`src/adapters/`) — **größter Brennpunkt, aber chirurgisch**

| Adapter | Status |
|---|---|
| `azure-devops/queries/azure-query-runtime.adapter.ts` | **unverändert** |
| `azure-devops/work-items/write-command.azure.adapter.ts` | **unverändert** |
| `azure-devops/iterations/azure-iterations.adapter.ts` | **unverändert** |
| `azure-devops/auth/azure-cli-preflight.adapter.ts` | entfernt (oder lokal-only Feature-Flag) |
| `persistence/settings/lowdb-user-preferences.adapter.ts` | für Local-Dev refaktoriert, in Prod abgelöst durch pg-Adapter |
| `persistence/settings/file-context-settings.adapter.ts` | abgelöst durch `EnvContextSettingsAdapter` |
| **NEU** `adapters/auth/entra-oauth.adapter.ts` | OAuth Code+PKCE Flow |
| **NEU** `adapters/auth/session-cookie.adapter.ts` | signiertes HttpOnly Cookie ↔ Session-Record |
| **NEU** `adapters/auth/per-user-token-provider.adapter.ts` | implementiert `AdoTokenProviderPort`, key by userId |
| **NEU** `adapters/persistence/postgres/pg-pool.ts` | Connection-Pool |
| **NEU** `adapters/persistence/postgres/pg-user-preferences.adapter.ts` | implementiert `UserPreferencesPort` |
| **NEU** `adapters/persistence/postgres/pg-user-tokens.adapter.ts` | verschlüsselte Refresh-Token-Speicherung |
| **NEU** `adapters/persistence/postgres/pg-session-store.adapter.ts` | implementiert `SessionStorePort` |

**Wichtigste Beobachtung:** Die ADO-REST-Adapter bleiben vollständig unberührt. Sie bekommen `AdoContext` und einen Authorization-Header reingereicht und scheren sich nicht darum, woher die kommen. Genau dafür ist Hexagonal gebaut.

### Composition / Bootstrap (`src/app/`) — **substantieller Umbau**
- `bootstrap/local-server.ts` → bleibt für Local-Dev
- **NEU** `bootstrap/hosted-server.ts` → Prod-Entry
- `bootstrap/http-server.ts` → Session-Middleware vor `/phase2/*`, neue `/auth/*` Routes, CSRF an Session gebunden, `resolveLocalUserId()` raus
- `composition/phase1-query-flow.ts` → bekommt `userId` als Eingabe
- `config/ado-context.store.ts` → liest nur noch `ADO_ORGANIZATION` + `ADO_PROJECT` aus Env

### Features (`src/features/`) — **unverändert**
Field-Mapping-Logik ist user-agnostisch.

### Shared (`src/shared/`) — **wenig**
- `user-preferences/user-preferences.schema.ts` → unverändert (wird als JSONB-Spalte gespeichert)
- `utils/azure-cli-path.ts` → entfernt (nur lokal relevant)

---

## 5. API Call Flow (ohne Azure CLI)

Die Azure CLI ist nur ein **lokaler Token-Lieferant**. Im Hosting fällt sie weg, ersetzt durch OAuth. Die ADO-REST-API selbst ist identisch — sie validiert nur einen `Authorization: Bearer <token>` Header.

### Login (einmalig pro Session)

```
Browser              BFF                    Microsoft Entra ID         Postgres
   │                  │                            │                      │
   │  GET /auth/login │                            │                      │
   │ ───────────────▶ │                            │                      │
   │ ◀─── 302 → /authorize?client_id=…&PKCE        │                      │
   │                                               │                      │
   │  GET /authorize?…                             │                      │
   │ ─────────────────────────────────────────────▶│                      │
   │            (User loggt sich bei Microsoft ein,│                      │
   │             consentet "Access Azure DevOps")  │                      │
   │ ◀── 302 → /auth/callback?code=ABC ────────────│                      │
   │                                               │                      │
   │  GET /auth/callback?code=ABC                  │                      │
   │ ───────────────▶ │                            │                      │
   │                  │  POST /token (code+secret+verifier)               │
   │                  │ ──────────────────────────▶│                      │
   │                  │ ◀── { access_token, refresh_token, id_token }    │
   │                  │  upsert user, store encrypted refresh_token       │
   │                  │ ───────────────────────────────────────────────▶ │
   │ ◀─ 302 → /  Set-Cookie: session=…; HttpOnly; Secure                  │
```

### Jeder ADO-API-Call danach

```
Browser              BFF                    Microsoft               Azure DevOps
   │  GET /phase2/query-intake                                            │
   │  Cookie: session=…                                                   │
   │ ───────────────▶ │                                                   │
   │                  │  validate session → userId = user_42              │
   │                  │  Token-Cache[user_42]?                            │
   │                  │     ├─ frisch  → use                              │
   │                  │     └─ stale  → POST /token grant_type=refresh   │
   │                  │ ────────────────────────▶│                       │
   │                  │ ◀── { access_token (new) }                       │
   │                  │                                                   │
   │                  │  GET dev.azure.com/<org>/<project>/_apis/wit/wiql │
   │                  │  Authorization: Bearer <access_token user_42>     │
   │                  │ ─────────────────────────────────────────────────▶│
   │                  │ ◀── { workItems: [...] } ─────────────────────────│
   │ ◀── { timeline: …}                                                   │
```

### Implikationen

- Keine `az login` auf Server oder Client. Microsoft-Account-Login im Browser reicht.
- Kein PAT-Setup. Refresh-Token ist 90 Tage gültig (Entra-default), wird transparent erneuert.
- ADO-Adapter unverändert — sie kennen nur einen `AdoTokenProviderPort` der einen Authorization-Header liefert.
- ADO-Permissions liegen beim User. OAuth gibt nur Delegation, nie mehr Rechte als der User selbst hat.

### Entra ID Setup (einmalig in `portal.azure.com`)

1. Entra ID → App Registrations → New Registration. Redirect URI: `https://<deine-domain>/auth/callback`
2. API Permissions → Add → Azure DevOps → Delegated → `user_impersonation` + `offline_access`. Admin Consent erteilen.
3. Certificates & Secrets → neuer Client Secret. Wert kopieren.
4. Tenant ID, Client ID, Secret in `.env` der Compose:
   ```
   ENTRA_TENANT_ID=...
   ENTRA_CLIENT_ID=...
   ENTRA_CLIENT_SECRET=...
   ```

---

## 6. Skalierungspfad (Tier-Strategie)

| Tier | Skala | Stack | Container |
|---|---|---|---|
| **0** | <100 User | SQLite + 1 Node-Prozess + externe TLS | 1 Container |
| **1** | 100–1000 User | **Postgres + Node + Caddy auf einem VPS** ← Default | 3 Container, 1 Compose-Stack |
| **2** | 1000+ DAU oder HA-Anforderung | Postgres + Multi-Instance-BFF + Redis (Sessions/Token/Response-Cache) | Mehrere Instanzen, eine LB |
| **3** | 10k+ concurrent / echtes SaaS | Managed Postgres + Managed Redis + Container-Plattform + CDN + OTel | Cloud-native |

**Wichtigste Skalierungs-Erkenntnis:** Bei dieser App ist der Engpass die **ADO-API-Rate-Limit-Quota**, nicht unser BFF. Bei steigender Last hilft Caching (Response-Cache, kürzere TTLs, Background-Refresh) deutlich mehr als mehr Hardware. Die App macht heute jeden Query-Switch zu einem voll-Reload (CLAUDE.md QRY-03) — bei Tier 2 muss hier Cache-Aside rein.

**Übergang Tier 1 → Tier 2** ist drei Adapter-Tausche (`in-memory-session-store` → `redis-session-store`, etc.). Domain/Application bleiben unangetastet. Genau hier zahlt sich Hexagonal nochmal aus.

---

## 7. Tier-1-Aufbau im Detail

```
                    ┌──── VPS ───────────────────────────────────────┐
                    │  (4 vCPU, 8 GB RAM, 80 GB SSD, Ubuntu 24 LTS)  │
                    │                                                 │
   Internet ──:443──┼─►┌──────────────────────────────────────────┐   │
                    │  │ caddy:2-alpine                            │   │
                    │  │  • TLS terminieren (Let's Encrypt)        │   │
                    │  │  • HTTP→HTTPS redirect                     │   │
                    │  │  • / → bff:8080 (reverse-proxy)           │   │
                    │  │  • /dist/* statisch ausliefern            │   │
                    │  └────────┬──────────────────────────────────┘   │
                    │           │ internal:8080                         │
                    │           ▼                                        │
                    │  ┌──────────────────────────────────────────┐    │
                    │  │ bff (Node 22, dein Image)                │    │
                    │  │  • /auth/* (OAuth-Flow)                   │    │
                    │  │  • /phase2/* (API für Frontend)           │    │
                    │  │  • Cluster-Mode: 2 Worker                 │    │
                    │  │  • In-Memory: Token-Cache, LRU Resp-Cache │    │
                    │  └────────┬─────────────────────────────────┘    │
                    │           │ internal:5432                         │
                    │           ▼                                        │
                    │  ┌──────────────────────────────────────────┐    │
                    │  │ postgres:16-alpine                        │    │
                    │  │  • users, user_preferences,               │    │
                    │  │    sessions, user_ado_tokens              │    │
                    │  │  • Volume: pgdata                          │    │
                    │  └──────────────────────────────────────────┘    │
                    │                                                    │
                    │  Volumes (auf VPS-Disk):                          │
                    │   ├─ pgdata          (Postgres-State)             │
                    │   ├─ caddy_data      (TLS-Zertifikate)            │
                    │   └─ caddy_config                                  │
                    └────────────────────────────────────────────────────┘
```

### Container-Begründung
- **Caddy eigener Container:** automatischer Let's-Encrypt-Cert-Refresh + Static-Asset-Serving + Security-Headers — spezialisierte Software, in 5 Zeilen Config statt in Node nachgebaut.
- **BFF eigener Container:** 2 Worker im Cluster-Mode geben Resilienz; bei I/O-bound Last ausreichend bis weit jenseits 1000 User. Token-Cache je Worker → akzeptable Doppel-Refreshes bei Tier 1; in Tier 2 löst Redis das.
- **Postgres eigener Container:** App-Update ohne DB-Restart, DB-Update ohne App-Build, sauberer DB-Shutdown unabhängig vom App-Lifecycle, `pg_dump`-Backup ohne App-Pause.

### Networking
Compose erzeugt internes Bridge-Network. Container erreichen sich per DNS-Hostnames (`bff`, `postgres`). Nur Caddy ist von außen sichtbar (`:443`, `:80` für ACME).

### Deployment-Workflow
```bash
# einmalig
git clone … && cd deploy
cp .env.example .env  # ENTRA_*, ADO_ORGANIZATION, SESSION_SECRET, …
docker compose up -d

# App-Update (DB läuft durch)
docker compose pull bff && docker compose up -d bff

# DB-Migration
docker compose run --rm bff npm run migrate

# Backup
docker compose exec -T postgres pg_dump -U app ganttops | gzip > backup-$(date +%F).sql.gz
```

---

## 8. Phasenplan

### Phase A — Identitäts-Refactor (Vorbereitung) [~2 Tage]

Wiring-Assumption brechen, dass es einen einzigen `userId` pro Prozess gibt — ohne Auth-Mechanismus zu ändern. Lokal lauffähig wie bisher.

1. `LowdbUserPreferencesAdapter`: `userId` raus aus Konstruktor, rein in Methoden. Datenstruktur (`users: Record<string, UserPreferences>`) ist bereits dafür ausgelegt.
2. Neuer Port `UserPreferencesPort` mit userId-pro-Call-Signatur.
3. `http-server.ts`-Handler: `userId` aus Request-Kontext (vorerst weiter aus `resolveLocalUserId()`).
4. `createAdoAuthHeaderProvider` kapseln in expliziten Port `AdoTokenProviderPort`.

**Ergebnis:** Code ist multi-user-ready, verhält sich aber lokal identisch.

### Phase B — Postgres-Migration [~2–3 Tage]

5. Postgres-Schema (siehe §10).
6. `pg-user-preferences.adapter.ts` — selbe Schnittstelle wie lowdb-Adapter, JSONB-Spalte hält `UserPreferences` 1:1.
7. `pg-pool.ts` — `pg`-Library, `DATABASE_URL`.
8. Composition-Root: Env-Switch `PERSISTENCE_BACKEND=postgres|lowdb`.

**Ergebnis:** App läuft lokal mit Postgres in Docker, identisches Verhalten.

### Phase C — Entra ID OAuth + Sessions [~3–5 Tage]

9. App-Registrierung in Entra ID (siehe §5; dokumentiert in `docs/operations/entra-setup.md`).
10. `entra-oauth.adapter.ts`:
    - `/auth/login` → 302 zu `login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize` mit PKCE
    - `/auth/callback` → Code → Tokens tauschen, User upserten, Session erzeugen, Cookie setzen
    - `/auth/logout` → Session löschen
    - `/auth/me` → aktuelle User-Identität
11. `session-middleware.ts` — Cookie validieren, `req.userId` setzen, ablaufende Sessions verwerfen.
12. `per-user-token-provider.ts` — pro `userId` ein `Bearer <accessToken>`. Bei Ablauf: Refresh-Token aus DB → erneuern → DB-Update.
13. `/phase2/*` mit Session-Middleware schützen. CSRF an Session, Frontend sendet Header `X-CSRF`.
14. Frontend: `<LoginGate>`-Wrapper, bei 401 → `/auth/login`. Logout-Button im Header.

**Ergebnis:** Mehrere User parallel im Browser eingeloggt, jeder mit eigenem ADO-Token.

### Phase D — Hosting & Hardening [~2–3 Tage]

15. `Dockerfile` (multi-stage: build → slim runtime).
16. `docker-compose.yml` — `bff`, `postgres`, `caddy`. Volumes, Secrets via `.env` (`DATABASE_URL`, `ENTRA_*`, `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY`, `ADO_ORGANIZATION`, `ADO_PROJECT`).
17. `Caddyfile` mit Let's-Encrypt.
18. Per-User-Rate-Limiting (Token-Bucket pro `userId` für `/phase2/*`).
19. Strukturiertes Logging mit `userId` in jedem Eintrag, ohne Tokens/PII.
20. `/health` erweitern: DB-Reachability + Entra-Discovery.

### Phase E — Tests & Doku [~2–3 Tage]

21. Integration-Tests Auth-Flow (mock Entra Discovery + Token-Endpoint).
22. Multi-User-Contract-Test: zwei parallele Sessions dürfen sich nicht queruzen.
23. Migration-CLI: bestehende `~/.azure-ganttops/user-preferences.json` → Postgres für expliziten User-Account.
24. Operations-Runbook (`docs/operations/hosted-deployment.md`).
25. ADRs:
    - Entra ID OAuth statt PAT als primärer Auth-Mechanismus
    - Postgres statt lowdb für Multi-User-Persistenz
    - Single-shared-ADO-Org Tenancy-Modell

---

## 9. Kritische Files (Implementierungs-Anker)

| Pfad | Was passiert |
|---|---|
| `src/app/bootstrap/local-server.ts:147–179` | Token-Provider: modul-global → per-User. Shared-Token-Cache muss weg. |
| `src/app/bootstrap/http-server.ts:489–512` | Bootstrapping: file-paths raus, DB-Pool + Session-Middleware rein. CSRF in Session. |
| `src/app/bootstrap/http-server.ts:1116–1126` | `resolveLocalUserId()` → `req.userId` aus Session-Middleware. |
| `src/adapters/persistence/settings/lowdb-user-preferences.adapter.ts` | Bleibt für Local-Dev unter Feature-Flag. Neuer pg-Adapter daneben. |
| `src/adapters/persistence/settings/file-context-settings.adapter.ts` | Wird obsolet — ADO-Context aus Server-Env. Durch `EnvContextSettingsAdapter` ersetzen oder entfernen. |
| `src/adapters/azure-devops/queries/azure-query-runtime.adapter.ts` | **Unverändert.** `AdoContext` aus Env, Token vom Per-User-Token-Provider. |
| `src/shared/user-preferences/user-preferences.schema.ts` | Schema bleibt — wird in JSONB gespeichert, derselbe `sanitizeUserPreferences()`-Pfad. |

---

## 10. Postgres-Schema

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,                     -- intern, generiert
  entra_oid TEXT UNIQUE NOT NULL,          -- Entra ID 'oid' Claim
  email TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_ado_tokens (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_encrypted BYTEA NOT NULL,  -- AES-GCM mit Server-Key
  scope TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,                     -- random 32-byte hex
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

---

## 11. Verifikation (End-to-End)

Nach Phase D sollte folgender Ablauf funktionieren:

1. `docker compose up -d` startet bff + postgres + caddy.
2. Browser auf `https://<domain>/` → Login-Gate → "Login" → Microsoft-Redirect → Login → Callback → Session-Cookie → Gantt-View lädt.
3. **Multi-User-Smoke-Test:** Zwei Browser-Profile mit zwei MS-Accounts, beide speichern eigene Saved Queries, beide sehen nur ihre eigenen.
4. **Token-Refresh-Test:** Access-Token in DB künstlich abgelaufen, Request absetzen, prüfen dass Refresh-Flow greift.
5. **Cross-Tenant-Isolation-Test:** Integrationstest, der User-A-Token niemals für User-B-Request landet (Token-Provider-Logging).
6. `npm run build` sauber. `npm test` grün. Coverage ≥ 80% (CLAUDE.md Quality Gate).

---

## 12. Trade-offs / Out-of-Scope

- **Single-Org-Annahme:** Mehrere Orgs pro User später möglich durch Tabelle `user_ado_workspaces`. `AdoContext` ist schon ein Wertobjekt, das pro Request mitgegeben wird.
- **On-Prem Azure DevOps Server:** Funktioniert nicht mit Entra-OAuth gegen `dev.azure.com`. Falls relevant, später PAT-Fallback nachziehen.
- **Self-Service-Admin-UI:** Kein separater Admin-Bereich — User legen sich beim ersten Login automatisch an. Reicht für MVP.
- **Real-Time-Collaboration:** Out of Scope. Bei zwei gleichzeitigen Edits gewinnt das letzte PATCH (ADO macht Optimistic Concurrency mit `If-Match` ETags).
- **Skalierung über Tier 1 hinaus:** Adapter-Tausche, kein Architektur-Umbau. Im Plan dokumentiert (§6), aber nicht im Scope dieses MVP.
