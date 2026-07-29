export type Interest = {
  id: string
  label: string
  keywords?: string[]
}

export type SourceType = 'rss' | 'html' | string

export type HtmlScrapeOptions = {
  itemSelector: string
  titleSelector: string
  titleAttribute?: string
  linkSelector?: string
  linkAttribute?: string
  summarySelector?: string
  imageSelector?: string
  imageAttribute?: string
  baseUrl?: string
}

export type Source = {
  id: string
  areaId: string
  name: string
  type: SourceType
  url: string
  interestIds: string[]
  options?: HtmlScrapeOptions & Record<string, unknown>
}

export type Area = {
  id: string
  name: string
  interests: Interest[]
  sources: Source[]
}

export type AreasConfig = {
  areas: Area[]
}

export type FeedItem = {
  id: string
  areaId: string
  sourceId: string
  title: string
  url: string
  summary?: string
  imageUrl?: string
  publishedAt?: string
  matchedInterestIds: string[]
  scrapedAt: string
}

export type SourceStatus = {
  sourceId: string
  areaId: string
  name: string
  lastScrapedAt: string | null
  lastError: string | null
  itemCount: number
}

export type ScrapeResult = {
  sourceId: string
  ok: boolean
  inserted: number
  updated: number
  error?: string
}
