# Release Rooster Dashboard

Local-first dashboard that aggregates **new releases and news** across hobby areas. Tabs group interests (Comics, Board Games, Video Games); each area filters by News / Stores.

## Quick start

```bash
npm install
npm run build -w @release-rooster/shared
npm run dev
```

- UI: http://localhost:5173  
- API: http://localhost:8787  

Click **Refresh this area** (or run a one-shot scrape):

```bash
npm run scrape
# or one area:
npm run scrape -w @release-rooster/api -- comics
```

## Add a new area or source

Edit [`config/areas.yaml`](config/areas.yaml):

1. Add an **area** (becomes a tab) with `interests` (`news`, `stores`, or your own).
2. Add **sources** with `type: rss` (preferred) or `type: html` plus CSS selectors under `options`.
3. Restart the API / refresh the UI.

Custom scrapers: register in `apps/api/src/scrapers/index.ts` via `registerScraper('my-type', fn)`.

## Layout

```
apps/web/          Vite + React dashboard
apps/api/          Hono API + scrapers + SQLite
packages/shared/   Shared types
config/areas.yaml  Areas, interests, sources
data/              SQLite DB (gitignored)
```

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8787` | API port |
| `DATABASE_PATH` | `data/rooster.db` | SQLite file |
| `AREAS_CONFIG_PATH` | `config/areas.yaml` | Config path |
| `SCRAPE_INTERVAL_MS` | unset/`0` | Auto-scrape interval (ms); `0` = manual only |

## Docker (local or later cloud)

```bash
docker compose up --build
```

Then open http://localhost:8787 (API serves the built UI).

For cloud later: deploy the same image to a VPS / Fly / Railway with a persistent volume mounted at `/data`.

## Notes

- News sources use RSS where possible.
- Store pages use HTML list scrapers; selectors may need tuning per site redesign.
- **Game Nerdz** new-releases is currently JS-rendered (Storepass) and will show a source error until a dedicated adapter is added; other sources work without it.
- Video Games has News only for now (no store source).
