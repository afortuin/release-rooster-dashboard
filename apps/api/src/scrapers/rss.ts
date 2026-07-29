import Parser from 'rss-parser'
import type { Source } from '@release-rooster/shared'
import { fetchText } from '../fetch.js'
import { finalizeItems, type ScrapedDraft } from '../util.js'

const parser = new Parser({
  timeout: 20000,
  headers: {
    'User-Agent':
      'ReleaseRoosterDashboard/0.1 (+https://github.com/afortuin/release-rooster-dashboard)',
  },
})

function stripHtml(html?: string): string | undefined {
  if (!html) return undefined
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400)
}

export async function scrapeRss(source: Source) {
  const xml = await fetchText(source.url, {
    accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
  })
  const feed = await parser.parseString(xml)
  const drafts: ScrapedDraft[] = (feed.items ?? []).slice(0, 40).map((item) => ({
    areaId: source.areaId,
    sourceId: source.id,
    title: item.title?.trim() || 'Untitled',
    url: item.link?.trim() || item.guid || source.url,
    summary: stripHtml(item.contentSnippet || item.content || item.summary),
    imageUrl: extractImage(item),
    publishedAt: item.isoDate || (item.pubDate ? new Date(item.pubDate).toISOString() : undefined),
  }))
  return finalizeItems(drafts, source.interestIds)
}

function extractImage(item: Parser.Item): string | undefined {
  const enclosure = item.enclosure?.url
  if (enclosure) return enclosure
  const media = (item as { 'media:content'?: { $?: { url?: string } } })['media:content']?.$?.url
  if (media) return media
  const extra = item as { content?: string; 'content:encoded'?: string }
  const content = extra.content || extra['content:encoded']
  if (typeof content === 'string') {
    const match = content.match(/<img[^>]+src=["']([^"']+)["']/i)
    if (match?.[1]) return match[1]
  }
  return undefined
}
