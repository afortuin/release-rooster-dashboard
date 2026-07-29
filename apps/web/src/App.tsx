import { useEffect, useMemo, useState } from 'react'
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import type { Area, FeedItem, SourceStatus } from '@release-rooster/shared'
import { fetchAreas, fetchItems, fetchStatuses, triggerScrape } from './api'

function formatWhen(iso?: string | null): string {
  if (!iso) return 'never'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function ItemCard({ item, sourceName }: { item: FeedItem; sourceName: string }) {
  return (
    <a
      className={`card${item.imageUrl ? '' : ' no-image'}`}
      href={item.url}
      target="_blank"
      rel="noreferrer"
    >
      {item.imageUrl ? (
        <img className="thumb" src={item.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
      ) : null}
      <div className="card-body">
        <h2>{item.title}</h2>
        {item.summary ? <p>{item.summary}</p> : null}
        <div className="card-meta">
          <span className="badge">{sourceName}</span>
          <span>{formatWhen(item.publishedAt ?? item.scrapedAt)}</span>
        </div>
      </div>
    </a>
  )
}

function AreaPage({ areas }: { areas: Area[] }) {
  const { areaId = '' } = useParams()
  const [search, setSearch] = useSearchParams()
  const area = areas.find((a) => a.id === areaId)
  const interestId = search.get('interest') || undefined

  const [items, setItems] = useState<FeedItem[]>([])
  const [statuses, setStatuses] = useState<SourceStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [scraping, setScraping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sourceNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of area?.sources ?? []) map.set(s.id, s.name)
    return map
  }, [area])

  const load = async () => {
    if (!area) return
    setLoading(true)
    setError(null)
    try {
      const [itemsRes, statusRes] = await Promise.all([
        fetchItems(area.id, interestId),
        fetchStatuses(area.id),
      ])
      setItems(itemsRes.items)
      setStatuses(statusRes.statuses)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaId, interestId])

  if (!area) {
    return <Navigate to={`/${areas[0]?.id ?? ''}`} replace />
  }

  const lastScraped = statuses
    .map((s) => s.lastScrapedAt)
    .filter(Boolean)
    .sort()
    .at(-1)

  const onRefresh = async (scope: 'area' | 'all') => {
    setScraping(true)
    setError(null)
    try {
      await triggerScrape(scope === 'area' ? { areaId: area.id } : {})
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setScraping(false)
    }
  }

  const setInterest = (id?: string) => {
    const next = new URLSearchParams(search)
    if (id) next.set('interest', id)
    else next.delete('interest')
    setSearch(next, { replace: true })
  }

  return (
    <>
      <div className="toolbar">
        <div className="chips">
          <button
            type="button"
            className={`chip${!interestId ? ' active' : ''}`}
            onClick={() => setInterest(undefined)}
          >
            All
          </button>
          {area.interests.map((interest) => (
            <button
              key={interest.id}
              type="button"
              className={`chip${interestId === interest.id ? ' active' : ''}`}
              onClick={() => setInterest(interest.id)}
            >
              {interest.label}
            </button>
          ))}
        </div>
        <div className="meta">Last scraped: {formatWhen(lastScraped)}</div>
      </div>

      <div className="actions" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={scraping}
          onClick={() => void onRefresh('area')}
        >
          {scraping ? 'Refreshing…' : 'Refresh this area'}
        </button>
        <button type="button" className="btn" disabled={scraping} onClick={() => void onRefresh('all')}>
          Refresh all
        </button>
      </div>

      {error ? <div className="error">{error}</div> : null}
      {loading ? <div className="loading">Loading feed…</div> : null}
      {!loading && !error && items.length === 0 ? (
        <div className="empty">
          <p>No items yet for this view.</p>
          <p>
            Hit <strong>Refresh this area</strong>, or add sources in <code>config/areas.yaml</code>.
          </p>
        </div>
      ) : null}

      <div className="feed">
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            sourceName={sourceNames.get(item.sourceId) ?? item.sourceId}
          />
        ))}
      </div>

      <section className="status-panel">
        <h3>Sources</h3>
        <div className="status-list">
          {statuses.map((s) => (
            <div key={s.sourceId} className="status-row">
              <span>
                {s.name} · {s.itemCount} items · {formatWhen(s.lastScrapedAt)}
              </span>
              <span className={s.lastError ? 'err' : 'ok'}>
                {s.lastError ? s.lastError : 'ok'}
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

export function App() {
  const [areas, setAreas] = useState<Area[] | null>(null)
  const [bootError, setBootError] = useState<string | null>(null)

  useEffect(() => {
    fetchAreas()
      .then((res) => setAreas(res.areas))
      .catch((err) => setBootError(err instanceof Error ? err.message : String(err)))
  }, [])

  if (bootError) {
    return (
      <div className="app-shell">
        <div className="error">Could not load areas: {bootError}</div>
      </div>
    )
  }

  if (!areas) {
    return (
      <div className="app-shell">
        <div className="loading">Starting Release Rooster…</div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="brand-row">
        <div className="brand">
          <h1>Release Rooster</h1>
          <p>New releases and news across your hobbies — comics, board games, and video games.</p>
        </div>
      </header>

      <nav className="tabs">
        {areas.map((area) => (
          <AreaTab key={area.id} area={area} />
        ))}
      </nav>

      <Routes>
        <Route path="/" element={<Navigate to={`/${areas[0].id}`} replace />} />
        <Route path="/:areaId" element={<AreaPage areas={areas} />} />
      </Routes>
    </div>
  )
}

function AreaTab({ area }: { area: Area }) {
  const { pathname } = useLocation()
  const active = pathname === `/${area.id}` || pathname.startsWith(`/${area.id}/`)
  return (
    <Link className={`tab${active ? ' active' : ''}`} to={`/${area.id}`}>
      {area.name}
    </Link>
  )
}
