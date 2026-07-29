import type { FeedItem, ScrapeResult, Source } from '@release-rooster/shared'
import { countItemsForSource, recordSourceRun, upsertItems } from '../db/index.js'
import { nowIso } from '../util.js'
import { scrapeHtml } from './html.js'
import { scrapeRss } from './rss.js'

export type Scraper = (source: Source) => Promise<FeedItem[]>

const registry: Record<string, Scraper> = {
  rss: scrapeRss,
  html: scrapeHtml,
}

export function registerScraper(type: string, scraper: Scraper): void {
  registry[type] = scraper
}

export function getScraper(type: string): Scraper | undefined {
  return registry[type]
}

export async function runSource(source: Source): Promise<ScrapeResult> {
  const scraper = getScraper(source.type)
  if (!scraper) {
    const error = `No scraper registered for type "${source.type}"`
    recordSourceRun({
      sourceId: source.id,
      areaId: source.areaId,
      name: source.name,
      lastScrapedAt: nowIso(),
      lastError: error,
      itemCount: countItemsForSource(source.id),
    })
    return { sourceId: source.id, ok: false, inserted: 0, updated: 0, error }
  }

  try {
    const items = await scraper(source)
    const { inserted, updated } = upsertItems(items)
    recordSourceRun({
      sourceId: source.id,
      areaId: source.areaId,
      name: source.name,
      lastScrapedAt: nowIso(),
      lastError: null,
      itemCount: countItemsForSource(source.id),
    })
    return { sourceId: source.id, ok: true, inserted, updated }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    recordSourceRun({
      sourceId: source.id,
      areaId: source.areaId,
      name: source.name,
      lastScrapedAt: nowIso(),
      lastError: error,
      itemCount: countItemsForSource(source.id),
    })
    return { sourceId: source.id, ok: false, inserted: 0, updated: 0, error }
  }
}

export async function runSources(sources: Source[]): Promise<ScrapeResult[]> {
  const results: ScrapeResult[] = []
  for (const source of sources) {
    results.push(await runSource(source))
  }
  return results
}
