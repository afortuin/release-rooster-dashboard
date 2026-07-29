import { listSources } from './config.js'
import { getDb } from './db/index.js'
import { runSources } from './scrapers/index.js'

async function main() {
  getDb()
  const areaId = process.argv[2]
  const sources = listSources(areaId)
  console.log(`Scraping ${sources.length} source(s)${areaId ? ` in ${areaId}` : ''}...`)
  const results = await runSources(sources)
  for (const r of results) {
    if (r.ok) {
      console.log(`✓ ${r.sourceId}: +${r.inserted} / ~${r.updated}`)
    } else {
      console.log(`✗ ${r.sourceId}: ${r.error}`)
    }
  }
  const failed = results.filter((r) => !r.ok).length
  process.exit(failed > 0 && failed === results.length ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
