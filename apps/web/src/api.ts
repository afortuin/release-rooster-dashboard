import type { Area, FeedItem, SourceStatus } from '@release-rooster/shared'

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function fetchAreas() {
  return json<{ areas: Area[] }>('/api/areas')
}

export function fetchItems(areaId: string, interestId?: string) {
  const params = new URLSearchParams({ areaId, limit: '100' })
  if (interestId) params.set('interestId', interestId)
  return json<{ items: FeedItem[] }>(`/api/items?${params}`)
}

export function fetchStatuses(areaId: string) {
  return json<{ statuses: SourceStatus[] }>(`/api/sources/status?areaId=${encodeURIComponent(areaId)}`)
}

export function triggerScrape(body: { areaId?: string } = {}) {
  return json<{ results: { sourceId: string; ok: boolean; error?: string }[] }>('/api/scrape', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
