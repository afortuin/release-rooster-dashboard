import { createHash } from 'node:crypto'
import type { FeedItem } from '@release-rooster/shared'

export function itemId(sourceId: string, url: string, title: string): string {
  return createHash('sha256').update(`${sourceId}|${url}|${title}`).digest('hex').slice(0, 32)
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function absolutize(href: string | undefined, baseUrl: string): string | undefined {
  if (!href) return undefined
  try {
    return new URL(href, baseUrl).toString()
  } catch {
    return href
  }
}

export type ScrapedDraft = Omit<FeedItem, 'id' | 'scrapedAt' | 'matchedInterestIds'> & {
  matchedInterestIds?: string[]
}

export function finalizeItems(
  drafts: ScrapedDraft[],
  interestIds: string[],
  scrapedAt = nowIso(),
): FeedItem[] {
  return drafts
    .filter((d) => d.title?.trim() && d.url?.trim())
    .map((d) => ({
      ...d,
      title: d.title.trim(),
      url: d.url.trim(),
      id: itemId(d.sourceId, d.url.trim(), d.title.trim()),
      matchedInterestIds: d.matchedInterestIds ?? interestIds,
      scrapedAt,
    }))
}
