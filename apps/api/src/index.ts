import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getArea, listAreas, listSources } from './config.js'
import { getDb, listSourceStatuses, queryItems } from './db/index.js'
import { runSources } from './scrapers/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = new Hono()

app.use('/api/*', cors())

app.get('/api/health', (c) => c.json({ ok: true }))

app.get('/api/areas', (c) => {
  const areas = listAreas().map(({ id, name, interests, sources }) => ({
    id,
    name,
    interests,
    sources: sources.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      url: s.url,
      interestIds: s.interestIds,
    })),
  }))
  return c.json({ areas })
})

app.get('/api/items', (c) => {
  const areaId = c.req.query('areaId') || undefined
  const interestId = c.req.query('interestId') || undefined
  const limit = Number(c.req.query('limit') || 100)
  const items = queryItems({ areaId, interestId, limit: Number.isFinite(limit) ? limit : 100 })
  return c.json({ items })
})

app.get('/api/sources/status', (c) => {
  const areaId = c.req.query('areaId') || undefined
  const configured = listSources(areaId)
  const runs = listSourceStatuses(areaId)
  const byId = new Map(runs.map((r) => [r.sourceId, r]))
  const statuses = configured.map((s) => {
    const run = byId.get(s.id)
    return (
      run ?? {
        sourceId: s.id,
        areaId: s.areaId,
        name: s.name,
        lastScrapedAt: null,
        lastError: null,
        itemCount: 0,
      }
    )
  })
  return c.json({ statuses })
})

app.post('/api/scrape', async (c) => {
  const body = await c.req.json().catch(() => ({} as { areaId?: string; sourceId?: string }))
  let sources = listSources(body.areaId)
  if (body.sourceId) {
    sources = sources.filter((s) => s.id === body.sourceId)
  }
  if (body.areaId && !getArea(body.areaId)) {
    return c.json({ error: `Unknown area: ${body.areaId}` }, 404)
  }
  const results = await runSources(sources)
  return c.json({ results })
})

const webDist = resolve(__dirname, '../../web/dist')
if (existsSync(webDist)) {
  app.use('/*', serveStatic({ root: webDist }))
  app.get('*', serveStatic({ root: webDist, path: 'index.html' }))
}

const port = Number(process.env.PORT || 8787)
getDb()

const intervalMs = Number(process.env.SCRAPE_INTERVAL_MS || 0)
if (intervalMs > 0) {
  console.log(`Auto-scrape every ${intervalMs}ms`)
  setInterval(() => {
    void runSources(listSources()).then((results) => {
      const failed = results.filter((r) => !r.ok).length
      console.log(`Scheduled scrape done: ${results.length - failed} ok, ${failed} failed`)
    })
  }, intervalMs)
}

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Release Rooster API on http://localhost:${info.port}`)
})
