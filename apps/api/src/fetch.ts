const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export async function fetchText(
  url: string,
  opts: { timeoutMs?: number; accept?: string } = {},
): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 20_000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': DEFAULT_UA,
        Accept: opts.accept ?? 'application/rss+xml, application/atom+xml, application/xml, text/html, */*',
      },
      redirect: 'follow',
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`)
    }
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}
