import { useState } from 'react'
import { formatBytes, formatDuration, formatNumber, formatTime } from '../dashboard/format.ts'
import {
  BACKGROUND_EXPLAIN,
  explainOperation,
  STATISTIC_LABELS,
  WAIT_EXPLAIN,
} from './explanations.ts'
import { PlanTree } from './PlanTree.tsx'
import { estimateGap, mainOperation, mainStepId } from './planSummary.ts'
import type { ExecutionRecord } from './types.ts'

function formatStatistic(name: string, change: number) {
  return name === 'redo size' ? formatBytes(change) : formatNumber(change)
}

function percentChange(before: number, after: number) {
  if (before === 0) return null
  const change = Math.round(((after - before) / before) * 100)
  return `${change > 0 ? '+' : ''}${change}%`
}

function Metric({
  label,
  value,
  before,
  beforeText,
  after,
}: {
  label: string
  value: string
  before?: number | null
  beforeText?: string
  after?: number | null
}) {
  const hasComparison = before !== undefined && before !== null && after !== undefined && after !== null
  const change = hasComparison ? percentChange(before, after) : null

  return (
    <div className="card">
      <span className="card-label">{label}</span>
      <strong className="card-value">{value}</strong>
      {hasComparison && (
        <span className="card-note">
          Was {beforeText}
          {change && ` (${change})`}
        </span>
      )}
    </div>
  )
}

function PlanStepDetails({ record, selectedId }: { record: ExecutionRecord; selectedId: number }) {
  const step = record.plan.find((candidate) => candidate.id === selectedId) ?? record.plan[0]
  const gap = estimateGap(step)

  return (
    <div className="step-details">
      <h4>
        {step.operation} {step.options}
        {step.object_name && <code>{step.object_name}</code>}
      </h4>
      <div className="step-details-grid">
        <div>
          <span className="label label-explained">Explained</span>
          <p>{explainOperation(step.operation, step.options)}</p>
        </div>
        <div>
          <span className="label label-measured">Measured</span>
          {step.access_predicates && (
            <p>
              Used to find rows: <code>{step.access_predicates}</code>
            </p>
          )}
          {step.filter_predicates && (
            <p>
              Used to discard rows: <code>{step.filter_predicates}</code>
            </p>
          )}
          <p>Ran {formatNumber(step.starts)} time(s).</p>
          {gap && (
            <p className="estimate-note">
              The optimizer’s estimate was about {formatNumber(gap)} times off the actual row
              count.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export function RecordDetails({
  record,
  previous,
}: {
  record: ExecutionRecord
  previous: ExecutionRecord | null
}) {
  const [selectedStep, setSelectedStep] = useState(() => mainStepId(record))

  if (record.status === 'error') {
    return (
      <div className="record">
        <pre className="record-sql">{record.sql}</pre>
        <div className="form-error" role="alert">
          <strong>Oracle rejected this query.</strong>
          <span>{record.error}</span>
        </div>
      </div>
    )
  }

  const root = record.plan[0]
  const previousRoot = previous?.plan[0]
  const operation = mainOperation(record)
  const previousOperation = previous && mainOperation(previous)
  const planChanged = previousOperation && operation && previousOperation !== operation

  return (
    <div className="record">
      <pre className="record-sql">{record.sql}</pre>
      <p className="record-meta">
        Run at {formatTime(record.executed_at)}
        {record.sql_id && (
          <>
            {' · '}SQL ID <code>{record.sql_id}</code>, child {record.child_number}
          </>
        )}
        {previous && ` · Compared with run #${previous.id}`}
      </p>

      {record.warnings.map((warning) => (
        <div className="notice" key={warning}>
          {warning}
        </div>
      ))}

      {planChanged && (
        <div className="plan-change">
          <strong>Oracle changed its plan.</strong> The main step went from{' '}
          <code>{previousOperation}</code> to <code>{operation}</code>.
        </div>
      )}

      <div className="cards cards-four">
        <Metric
          label="Time"
          value={formatDuration(root?.elapsed_us ?? null)}
          before={previousRoot?.elapsed_us}
          beforeText={formatDuration(previousRoot?.elapsed_us ?? null)}
          after={root?.elapsed_us}
        />
        <Metric
          label="Buffer gets"
          value={formatNumber(root?.buffer_gets ?? null)}
          before={previousRoot?.buffer_gets}
          beforeText={formatNumber(previousRoot?.buffer_gets ?? null)}
          after={root?.buffer_gets}
        />
        <Metric
          label="Disk reads"
          value={formatNumber(root?.disk_reads ?? null)}
          before={previousRoot?.disk_reads}
          beforeText={formatNumber(previousRoot?.disk_reads ?? null)}
          after={root?.disk_reads}
        />
        <Metric label="Rows returned" value={formatNumber(record.rows_fetched)} />
      </div>

      {record.plan.length > 0 && (
        <section className="record-section">
          <div className="record-heading">
            <h3>Steps Oracle took</h3>
            <span className="label label-measured">Measured</span>
          </div>
          <p className="record-note">
            Source: <code>V$SQL_PLAN_STATISTICS_ALL</code>. Each row includes the work of the steps
            below it. A plan is a tree of operators, so the order shown is typical, not an exact
            timeline. Click a step to learn what it does.
          </p>
          <PlanTree plan={record.plan} selectedId={selectedStep} onSelect={setSelectedStep} />
          <PlanStepDetails record={record} selectedId={selectedStep} />
        </section>
      )}

      <div className="record-columns">
        <section className="record-section">
          <div className="record-heading">
            <h3>Server process</h3>
            <span className="label label-measured">Measured</span>
          </div>
          <p className="record-note">
            This process ran your query on behalf of your session. Source:{' '}
            <code>V$SESSION, V$PROCESS</code>.
          </p>
          {record.process && (
            <dl className="detail-rows">
              <div>
                <dt>Session (SID, serial)</dt>
                <dd>
                  {record.process.sid}, {record.process.serial}
                </dd>
              </div>
              <div>
                <dt>Oracle PID</dt>
                <dd>{record.process.oracle_pid}</dd>
              </div>
              <div>
                <dt>OS process ID</dt>
                <dd>{record.process.os_pid}</dd>
              </div>
              <div>
                <dt>Database user</dt>
                <dd>{record.process.username}</dd>
              </div>
            </dl>
          )}
        </section>

        <section className="record-section">
          <div className="record-heading">
            <h3>Total effort</h3>
            <span className="label-calculated">Calculated</span>
          </div>
          <p className="record-note">
            The change in <code>V$MYSTAT</code> before and after the run. It also counts Oracle’s
            parsing and OracleScope’s measuring queries, so it can be higher than the plan’s
            figures.
          </p>
          <dl className="detail-rows">
            {record.statistics
              .filter((statistic) => statistic.change !== 0)
              .map((statistic) => (
                <div key={statistic.name}>
                  <dt>{STATISTIC_LABELS[statistic.name] ?? statistic.name}</dt>
                  <dd>{formatStatistic(statistic.name, statistic.change)}</dd>
                </div>
              ))}
          </dl>
        </section>

        <section className="record-section">
          <div className="record-heading">
            <h3>What it waited for</h3>
            <span className="label-calculated">Calculated</span>
          </div>
          <p className="record-note">
            The change in <code>V$SESSION_EVENT</code> before and after the run.
          </p>
          {record.waits.length === 0 && <p className="record-note">No waits were recorded.</p>}
          <dl className="detail-rows">
            {record.waits.map((wait) => (
              <div key={wait.event}>
                <dt>{wait.event}</dt>
                <dd>
                  {formatNumber(wait.waits)} time(s), {formatDuration(wait.time_us)}
                </dd>
                {WAIT_EXPLAIN[wait.event] && <dd className="wait-note">{WAIT_EXPLAIN[wait.event]}</dd>}
              </div>
            ))}
          </dl>
        </section>

        <section className="record-section">
          <div className="record-heading">
            <h3>Background activity at the same time</h3>
            <span className="label label-inferred">Inferred</span>
          </div>
          <p className="record-note">
            Background processes serve the whole database, and Oracle does not link their work to
            one query. This only shows what they did while your query ran, so other work may have
            caused it.
          </p>
          {record.background.length === 0 && (
            <p className="record-note">
              <strong>No background I/O was recorded during this run.</strong>
            </p>
          )}
          <dl className="detail-rows">
            {record.background.map((item) => (
              <div key={`${item.process}:${item.event}`}>
                <dt>
                  {item.process} ({BACKGROUND_EXPLAIN[item.process]})
                </dt>
                <dd>
                  {item.event}: {formatNumber(item.waits)} time(s), {formatDuration(item.time_us)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <section className="record-section">
        <div className="record-heading">
          <h3>Result</h3>
        </div>
        <p className="record-note">
          {record.rows.length < record.rows_fetched
            ? `Showing the first ${formatNumber(record.rows.length)} of ${formatNumber(record.rows_fetched)} rows.`
            : `${formatNumber(record.rows_fetched)} row(s).`}
        </p>
        {record.rows.length > 0 && (
          <div className="table-scroll result-scroll">
            <table className="result-table">
              <thead>
                <tr>
                  {record.columns.map((column, index) => (
                    <th key={`${column}:${index}`}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {record.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((value, index) => (
                      <td key={index}>{value === null ? <em>NULL</em> : String(value)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
