import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FeedItem, SourceStatus } from '@release-rooster/shared'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function dbPath(): string {
  return process.env.DATABASE_PATH ?? resolve(__dirname, '../../../../data/rooster.db')
}

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db
  const path = dbPath()
  mkdirSync(dirname(path), { recursive: true })
  db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      area_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      summary TEXT,
      image_url TEXT,
      published_at TEXT,
      matched_interest_ids TEXT NOT NULL,
      scraped_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_items_area ON items(area_id);
    CREATE INDEX IF NOT EXISTS idx_items_source ON items(source_id);
    CREATE INDEX IF NOT EXISTS idx_items_published ON items(published_at DESC);

    CREATE TABLE IF NOT EXISTS source_runs (
      source_id TEXT PRIMARY KEY,
      area_id TEXT NOT NULL,
      name TEXT NOT NULL,
      last_scraped_at TEXT,
      last_error TEXT,
      item_count INTEGER NOT NULL DEFAULT 0
    );
  `)
  return db
}

function rowToItem(row: Record<string, unknown>): FeedItem {
  return {
    id: String(row.id),
    areaId: String(row.area_id),
    sourceId: String(row.source_id),
    title: String(row.title),
    url: String(row.url),
    summary: row.summary ? String(row.summary) : undefined,
    imageUrl: row.image_url ? String(row.image_url) : undefined,
    publishedAt: row.published_at ? String(row.published_at) : undefined,
    matchedInterestIds: JSON.parse(String(row.matched_interest_ids)) as string[],
    scrapedAt: String(row.scraped_at),
  }
}

export function upsertItems(items: FeedItem[]): { inserted: number; updated: number } {
  const database = getDb()
  const existing = database.prepare('SELECT id FROM items WHERE id = ?')
  const insert = database.prepare(`
    INSERT INTO items (
      id, area_id, source_id, title, url, summary, image_url, published_at, matched_interest_ids, scraped_at
    ) VALUES (
      @id, @areaId, @sourceId, @title, @url, @summary, @imageUrl, @publishedAt, @matchedInterestIds, @scrapedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      url = excluded.url,
      summary = excluded.summary,
      image_url = excluded.image_url,
      published_at = COALESCE(excluded.published_at, items.published_at),
      matched_interest_ids = excluded.matched_interest_ids,
      scraped_at = excluded.scraped_at
  `)

  let inserted = 0
  let updated = 0
  const tx = database.transaction((batch: FeedItem[]) => {
    for (const item of batch) {
      const was = existing.get(item.id)
      insert.run({
        id: item.id,
        areaId: item.areaId,
        sourceId: item.sourceId,
        title: item.title,
        url: item.url,
        summary: item.summary ?? null,
        imageUrl: item.imageUrl ?? null,
        publishedAt: item.publishedAt ?? null,
        matchedInterestIds: JSON.stringify(item.matchedInterestIds),
        scrapedAt: item.scrapedAt,
      })
      if (was) updated += 1
      else inserted += 1
    }
  })
  tx(items)
  return { inserted, updated }
}

export function queryItems(opts: {
  areaId?: string
  interestId?: string
  limit?: number
}): FeedItem[] {
  const database = getDb()
  const limit = opts.limit ?? 100
  let sql = `SELECT * FROM items WHERE 1=1`
  const params: unknown[] = []
  if (opts.areaId) {
    sql += ` AND area_id = ?`
    params.push(opts.areaId)
  }
  if (opts.interestId) {
    sql += ` AND matched_interest_ids LIKE ?`
    params.push(`%"${opts.interestId}"%`)
  }
  sql += ` ORDER BY COALESCE(published_at, scraped_at) DESC LIMIT ?`
  params.push(limit)
  const rows = database.prepare(sql).all(...params) as Record<string, unknown>[]
  return rows.map(rowToItem)
}

export function recordSourceRun(status: SourceStatus): void {
  getDb()
    .prepare(
      `
    INSERT INTO source_runs (source_id, area_id, name, last_scraped_at, last_error, item_count)
    VALUES (@sourceId, @areaId, @name, @lastScrapedAt, @lastError, @itemCount)
    ON CONFLICT(source_id) DO UPDATE SET
      last_scraped_at = excluded.last_scraped_at,
      last_error = excluded.last_error,
      item_count = excluded.item_count,
      name = excluded.name,
      area_id = excluded.area_id
  `,
    )
    .run({
      sourceId: status.sourceId,
      areaId: status.areaId,
      name: status.name,
      lastScrapedAt: status.lastScrapedAt,
      lastError: status.lastError,
      itemCount: status.itemCount,
    })
}

export function listSourceStatuses(areaId?: string): SourceStatus[] {
  const database = getDb()
  const rows = areaId
    ? (database.prepare('SELECT * FROM source_runs WHERE area_id = ?').all(areaId) as Record<
        string,
        unknown
      >[])
    : (database.prepare('SELECT * FROM source_runs').all() as Record<string, unknown>[])
  return rows.map((row) => ({
    sourceId: String(row.source_id),
    areaId: String(row.area_id),
    name: String(row.name),
    lastScrapedAt: row.last_scraped_at ? String(row.last_scraped_at) : null,
    lastError: row.last_error ? String(row.last_error) : null,
    itemCount: Number(row.item_count ?? 0),
  }))
}

export function countItemsForSource(sourceId: string): number {
  const row = getDb().prepare('SELECT COUNT(*) as c FROM items WHERE source_id = ?').get(sourceId) as {
    c: number
  }
  return row.c
}
