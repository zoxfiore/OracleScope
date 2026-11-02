import { useEffect, useMemo, useRef, useState } from 'react'
import { Navbar } from '../../components/Navbar.tsx'
import { closeConnection } from '../connections/api.ts'
import { InspectorPage } from '../inspector/InspectorPage.tsx'
import type { StoredConnection } from '../connections/storage.ts'
import { ConnectionLostError, fetchOverview } from './api.ts'
import { ArchitectureGraph } from './ArchitectureGraph.tsx'
import { buildGraph, DEFAULT_EXPANDED, ROOT_ID } from './buildGraph.ts'
import type { GraphItem } from './buildGraph.ts'
import { DetailsPanel } from './DetailsPanel.tsx'
import { formatBytes, formatTime } from './format.ts'
import type { Overview } from './types.ts'

function SummaryCards({ overview, sessionChange }: { overview: Overview; sessionChange: number | null }) {
  const allocated = overview.pga.data?.find((row) => row.name === 'total PGA allocated')
  const files = overview.storage.data?.containers.reduce((sum, item) => sum + item.bytes, 0)
  const unavailable = 'Unavailable'

  let change: string | undefined
  if (sessionChange !== null) {
    change =
      sessionChange === 0
        ? 'No change since last refresh'
        : `${sessionChange > 0 ? '+' : ''}${sessionChange} since last refresh`
  }

  const cards = [
    { label: 'Oracle version', value: overview.instance.data?.version_full ?? unavailable },
    {
      label: 'User sessions',
      value: overview.sessions.data?.user_total ?? unavailable,
      note: change,
      highlight: Boolean(sessionChange),
    },
    {
      label: 'Background processes',
      value: overview.processes.data?.background_total ?? unavailable,
    },
    {
      label: 'SGA',
      value: overview.sga.data ? formatBytes(overview.sga.data.total_bytes) : unavailable,
    },
    { label: 'PGA allocated', value: allocated ? formatBytes(allocated.value) : unavailable },
    { label: 'Files on disk', value: files !== undefined ? formatBytes(files) : unavailable },
  ]

  return (
    <div className="cards">
      {cards.map((card) => (
        <div className={`card${card.highlight ? ' card-highlight' : ''}`} key={card.label}>
          <span className="card-label">{card.label}</span>
          <strong className="card-value">{card.value}</strong>
          {card.note && <span className="card-note">{card.note}</span>}
        </div>
      ))}
    </div>
  )
}

export function Dashboard({
  connection,
  onDisconnected,
}: {
  connection: StoredConnection
  onDisconnected: (notice?: string) => void
}) {
  const [view, setView] = useState<'architecture' | 'sql'>('architecture')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [sessionChange, setSessionChange] = useState<number | null>(null)
  const [expanded, setExpanded] = useState(() => new Set(DEFAULT_EXPANDED))
  const [selectedId, setSelectedId] = useState(ROOT_ID)
  const lastUserTotal = useRef<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    fetchOverview(connection.id, controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return

        const userTotal = next.sessions.data?.user_total ?? null
        if (lastUserTotal.current !== null && userTotal !== null) {
          setSessionChange(userTotal - lastUserTotal.current)
        }
        lastUserTotal.current = userTotal
        setOverview(next)
        setError(null)
        setRefreshing(false)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        if (err instanceof ConnectionLostError) {
          onDisconnected(err.message)
          return
        }
        setError(err instanceof Error ? err.message : 'Could not load the overview.')
        setRefreshing(false)
      })

    return () => controller.abort()
  }, [connection.id, refreshKey, onDisconnected])

  const items = useMemo(
    () => (overview ? buildGraph(overview, expanded) : []),
    [overview, expanded],
  )
  const selected = items.find((item) => item.id === selectedId) ?? items[0]

  function handleSelect(item: GraphItem) {
    setSelectedId(item.id)
    if (!item.hasChildren) return

    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(item.id)) next.delete(item.id)
      else next.add(item.id)
      return next
    })
  }

  function handleRefresh() {
    setRefreshing(true)
    setRefreshKey((key) => key + 1)
  }

  async function handleDisconnect() {
    // The connection may already be dead, and the form is the right next step either way.
    await closeConnection(connection.id).catch(() => undefined)
    onDisconnected()
  }

  return (
    <>
      <Navbar>
        <nav className="tabs" aria-label="Views">
          <button
            type="button"
            className={view === 'architecture' ? 'is-active' : undefined}
            onClick={() => setView('architecture')}
          >
            Architecture
          </button>
          <button
            type="button"
            className={view === 'sql' ? 'is-active' : undefined}
            onClick={() => setView('sql')}
          >
            SQL Inspector
          </button>
          <a href="#/presentation">Presentation</a>
        </nav>
        <span className="connection-status">
          <span className="connection-dot" aria-hidden="true" />
          <span>
            {connection.username} @ <code>{connection.target}</code>
          </span>
        </span>
        {view === 'architecture' && (
          <button
            type="button"
            className="nav-button nav-button-primary"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        )}
        <button type="button" className="nav-button" onClick={handleDisconnect}>
          Disconnect
        </button>
      </Navbar>

      {view === 'sql' && (
        <InspectorPage connectionId={connection.id} onConnectionLost={onDisconnected} />
      )}

      <main className="dashboard" hidden={view === 'sql'}>
        {error && (
          <div className="form-error" role="alert">
            <strong>Could not refresh the data.</strong>
            <span>{error}</span>
          </div>
        )}

        {!overview && !error && <p className="dashboard-loading">Reading from Oracle…</p>}

        {view === 'architecture' && overview && selected && (
          <>
            <SummaryCards overview={overview} sessionChange={sessionChange} />
            <div className="dashboard-heading">
              <h1>Architecture</h1>
              <span>
                Click a node for details. Nodes marked + or − expand and collapse. Updated{' '}
                {formatTime(overview.instance.collected_at)}.
              </span>
            </div>
            <div className="workspace">
              <div className="graph-frame">
                <ArchitectureGraph
                  items={items}
                  selectedId={selected.id}
                  onSelect={handleSelect}
                />
              </div>
              <DetailsPanel details={selected.details} />
            </div>
          </>
        )}
      </main>
    </>
  )
}
