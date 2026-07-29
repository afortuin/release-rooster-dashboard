import * as cheerio from 'cheerio'
import type { HtmlScrapeOptions, Source } from '@release-rooster/shared'
import { fetchText } from '../fetch.js'
import { absolutize, finalizeItems, type ScrapedDraft } from '../util.js'

function optsOf(source: Source): HtmlScrapeOptions {
  const o = (source.options ?? {}) as HtmlScrapeOptions
  return {
    itemSelector: o.itemSelector || '.product, .product-item, article, li',
    titleSelector: o.titleSelector || 'a, h2, h3, .title',
    titleAttribute: o.titleAttribute,
    linkSelector: o.linkSelector || 'a',
    linkAttribute: o.linkAttribute || 'href',
    summarySelector: o.summarySelector,
    imageSelector: o.imageSelector || 'img',
    imageAttribute: o.imageAttribute || 'src',
    baseUrl: o.baseUrl || source.url,
  }
}

export async function scrapeHtml(source: Source) {
  const html = await fetchText(source.url, { accept: 'text/html, */*' })
  const $ = cheerio.load(html)
  const opts = optsOf(source)
  const drafts: ScrapedDraft[] = []
  const seen = new Set<string>()

  $(opts.itemSelector).each((_, el) => {
    if (drafts.length >= 40) return false
    const root = $(el)
    const titleEl = root.find(opts.titleSelector).first()
    const titleFromAttr = opts.titleAttribute
      ? titleEl.attr(opts.titleAttribute)?.trim()
      : undefined
    const title =
      titleFromAttr || titleEl.text().trim() || root.text().trim().split('\n')[0]?.trim()
    if (!title || title.length < 3) return

    const linkEl = root.find(opts.linkSelector!).first()
    const href =
      linkEl.attr(opts.linkAttribute!) ||
      titleEl.attr('href') ||
      root.find('a').first().attr('href')
    const url = absolutize(href, opts.baseUrl!) || source.url
    const key = `${title}|${url}`
    if (seen.has(key)) return
    seen.add(key)

    const imgEl = opts.imageSelector ? root.find(opts.imageSelector).first() : null
    const imageRaw =
      imgEl?.attr(opts.imageAttribute || 'src') ||
      imgEl?.attr('data-src') ||
      imgEl?.attr('data-lazy-src')
    const imageUrl = absolutize(imageRaw, opts.baseUrl!)

    let summary: string | undefined
    if (opts.summarySelector) {
      summary = root.find(opts.summarySelector).first().text().trim().slice(0, 400) || undefined
    }

    drafts.push({
      areaId: source.areaId,
      sourceId: source.id,
      title,
      url,
      summary,
      imageUrl,
    })
  })

  if (drafts.length === 0) {
    throw new Error(
      `HTML scraper found 0 items for ${source.id} using selector "${opts.itemSelector}". Update options in config/areas.yaml.`,
    )
  }

  return finalizeItems(drafts, source.interestIds)
}
