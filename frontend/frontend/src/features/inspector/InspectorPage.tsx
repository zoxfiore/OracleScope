import { useEffect, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { CodeBlock } from '../../components/CodeBlock.tsx'
import { ConnectionLostError } from '../dashboard/api.ts'
import { formatNumber, formatTime } from '../dashboard/format.ts'
import { fetchHistory, runSql } from './api.ts'
import { comparisonFor, mainOperation } from './planSummary.ts'
import { RecordDetails } from './RecordDetails.tsx'
import type { ExecutionRecord } from './types.ts'

const DEMO_QUERY = `SELECT COUNT(*), SUM(amount)
FROM system.scope_orders
WHERE customer_id = 42`

const DEMO_INDEX = 'CREATE INDEX system.scope_orders_ix ON system.scope_orders (customer_id);'

export function InspectorPage({
  connectionId,
  onConnectionLost,
}: {
  connectionId: string
  onConnectionLost: (message: string) => void
}) {
  const [sql, setSql] = useState(DEMO_QUERY)
  const [history, setHistory] = useState<ExecutionRecord[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    fetchHistory(connectionId, controller.signal)
      .then((records) => {
        if (controller.signal.aborted) return
        setHistory(records)
        setSelectedId((current) => current ?? records[0]?.id ?? null)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        if (err instanceof ConnectionLostError) onConnectionLost(err.message)
        else setError(err instanceof Error ? err.message : 'Could not load the history.')
      })

    return () => controller.abort()
  }, [connectionId, onConnectionLost])

  async function handleRun() {
    if (running || !sql.trim()) return
    setRunning(true)
    setError(null)

    try {
      const record = await runSql(connectionId, sql)
      setHistory((current) => [record, ...current])
      setSelectedId(record.id)
    } catch (err) {
      if (err instanceof ConnectionLostError) {
        onConnectionLost(err.message)
        return
      }
      setError(err instanceof Error ? err.message : 'Could not run the query.')
    } finally {
      setRunning(false)
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      void handleRun()
    }
  }

  const selected = history.find((record) => record.id === selectedId) ?? null

  return (
    <main className="inspector">
      <aside className="inspector-side">
        <label className="editor">
          <span>SQL query</span>
          <textarea
            value={sql}
            onChange={(event) => setSql(event.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            rows={7}
          />
        </label>
        <button type="button" className="button-primary" onClick={handleRun} disabled={running}>
          {running ? 'Running…' : 'Run query'}
        </button>
        <p className="form-note">
          Press Ctrl+Enter to run. Only SELECT queries are allowed, inside a read-only transaction.
        </p>

        {error && (
          <div className="form-error" role="alert">
            <span>{error}</span>
          </div>
        )}

        <h2 className="history-title">History</h2>
        {history.length === 0 && (
          <div className="demo-guide">
            <p>
              <strong>Try the index demo.</strong> Run the query above, then create this index in
              SQL*Plus and run the query again:
            </p>
            <CodeBlock code={DEMO_INDEX} />
          </div>
        )}
        <ul className="history">
          {history.map((record) => {
            const operation = mainOperation(record)
            const gets = record.plan[0]?.buffer_gets ?? null
            return (
              <li key={record.id}>
                <button
                  type="button"
                  className={record.id === selectedId ? 'is-selected' : undefined}
                  onClick={() => setSelectedId(record.id)}
                >
                  <span className="history-top">
                    <span>#{record.id}</span>
                    <span>{formatTime(record.executed_at)}</span>
                  </span>
                  <code className="history-sql">{record.sql}</code>
                  {record.status === 'error' ? (
                    <span className="history-error">Failed</span>
                  ) : (
                    <span className="history-summary">
                      {operation ?? 'No plan'}
                      {gets !== null && ` · ${formatNumber(gets)} gets`}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      <div className="inspector-main">
        {selected ? (
          <RecordDetails
            key={selected.id}
            record={selected}
            previous={comparisonFor(selected, history)}
          />
        ) : (
          <div className="inspector-empty">
            <h1>See how Oracle runs your query</h1>
            <p>
              Run a query to see the steps Oracle took, the effort of each step and the process that
              did the work. Every run is kept in your history, so you can compare them.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
