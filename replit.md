# Workspace

## Älä riko näitä

Nämä ominaisuudet ovat hajonneet toistuvasti muiden muutosten yhteydessä. Tarkista jokainen kohta ennen kuin merkitset tehtävän valmiiksi.

### Maksuliikennekysymys joka käynnistyskerralla

- **Ominaisuus**: `WelcomeScreen` näytetään joka käynnistyskerralla riippumatta siitä, onko käyttäjä aiemmin vastannut maksuliikennekysymykseen.
- **Tiedostot**: `artifacts/upanapu-selain/src/main/index.ts`, `artifacts/upanapu-selain/src/renderer/src/WelcomeScreen.tsx`
- **Miten toimii**: `app.whenReady()`:ssä kutsutaan `saveSettings({ firstRun: true })` ennen ikkunan luomista — tämä nollaa `firstRun`-arvon aina käynnistettäessä. `blockPayments`-asetus tallennetaan **vain session ajaksi** (ei electron-storeen); `deviceId` ja `syncEnabled` sen sijaan muistetaan pysyvästi storen kautta.
- **Toistuva virhe**: `firstRun`-logiikka korvataan tai `blockPayments` tallennetaan storeen pysyvästi, jolloin maksuliikennekysymys näkyy vain kerran eikä joka käynnistyksellä.

### Zoomauspainikkeet näytön katselunäkymässä

- **Ominaisuus**: Portaalin `ScreenView`-komponentissa on `−` / `+` painikkeet zoomaukseen sekä zoomitason prosenttinäyttö.
- **Tiedosto**: `artifacts/omainen-portaali/src/ScreenView.tsx`
- **Toistuva virhe**: Komponentti refaktoroidaan tai korvataan ilman zoomauspainikkeiden säilyttämistä, jolloin ominaisuus katoaa kokonaan.

---

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/upanapu-selain` (`@workspace/upanapu-selain`)

Electron-pohjainen työpöytäsovellus — Upa'n Apu Virtuaaliselain. Turvallinen, yksinkertainen nettiselain vanhemmille käyttäjille Upa'n Apu -brändillä.

- **Stack**: Electron 33, React 19, Tailwind CSS v4, electron-vite, electron-builder
- **Main process**: `src/main/index.ts` — BrowserWindow + WebContentsView, IPC-käsittelijät, asetukset
- **Preload**: `src/preload/index.ts` — kontekstisilta rendererille (contextBridge)
- **Renderer**: `src/renderer/src/` — React UI (NavBar, SettingsPage), Tailwind CSS, Lucide-kuvakkeet
- **Settings**: Tallennetaan JSON-tiedostona `app.getPath('userData')`-hakemistoon
  - Fields: `homeUrl`, `tutorMode`, `fontSize`, `firstRun`, `blockPayments`, `deviceId`, `pairCode`, `syncEnabled`
- **Remote management**: `src/main/device-sync.ts` — registers device on first run, polls settings every 30s
  - NavBar has a 🔗 button that shows the 6-digit pairing code in a modal
  - `src/main/device-sync.ts` uses `VITE_API_URL` env var for the API base (defaults to production URL)
- **IPC channels for device sync**: `device:getStatus`, `device:getPairCode`
- **Build**: `pnpm --filter @workspace/upanapu-selain run build` — electron-vite bundle
- **Paketti macOS**: `pnpm --filter @workspace/upanapu-selain run dist:mac` → `.dmg`
- **Paketti Windows**: `pnpm --filter @workspace/upanapu-selain run dist:win` → `.exe` (NSIS)
- **Standalone-käyttö**: `cd artifacts/upanapu-selain && npm install && npm run dev`
- Electron-binääri ei käynnisty Replit-ympäristössä (ei näyttöä), mutta rakennus ja tyypitarkistus toimivat

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /healthz`
- Device remote management routes (`src/routes/devices.ts`):
  - `POST /api/devices/register` — creates a new device, returns `deviceId` and 6-digit `pairCode`
  - `GET /api/devices/:code/settings` — returns device settings (for the family portal)
  - `PUT /api/devices/:code/settings` — updates device settings (family portal changes them)
  - `POST /api/devices/:code/heartbeat` — updates `last_seen` timestamp
  - Rate limiting: 50 requests per 15 minutes per IP (express-rate-limit)
  - Codes expire after 30 days of no heartbeat
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `artifacts/omainen-portaali` (`@workspace/omainen-portaali`)

Family remote management web portal. Simple React+Vite SPA, no login required — uses device pair code.

- **URL**: `/omainen-portaali/`
- **View 1 (connect)**: Enter 6-digit device pair code → fetches device from API
- **View 2 (settings)**: Toggle tutorMode, blockPayments, set homeUrl and fontSize. Saves to API.
  - Shows "last seen" device status (formatted as "X min sitten")
  - Changes sync to the Electron browser within 30 seconds (poll interval)
- No backend logic in the portal — all API calls go to `/api/devices/:code/*`

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/devices.ts` — `devices` table: `device_id` (PK), `pair_code` (unique), `settings` (JSONB), `last_seen`, `created_at`, `active`
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
