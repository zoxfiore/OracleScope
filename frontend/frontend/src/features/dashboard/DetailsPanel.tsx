import type { DetailRow, Details } from './buildGraph.ts'
import { formatTime } from './format.ts'

function Rows({ rows }: { rows: DetailRow[] }) {
  return (
    <dl className="detail-rows">
      {rows.map((row) => (
        <div key={`${row.label}:${row.value}`}>
          <dt>
            {row.label}
            {row.kind === 'calculated' && <span className="label-calculated">Calculated</span>}
          </dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function DetailsPanel({ details }: { details: Details }) {
  return (
    <aside className="details" aria-label="Details">
      <h2>{details.title}</h2>

      <section>
        <span className="label label-measured">Measured</span>
        {details.error ? (
          <div className="form-error" role="alert">
            <strong>Oracle could not provide this data.</strong>
            <span>{details.error}</span>
          </div>
        ) : (
          <Rows rows={details.rows} />
        )}
        <p className="detail-source">
          Source: <code>{details.source}</code> at {formatTime(details.collectedAt)}
        </p>
      </section>

      <section>
        <span className="label label-explained">Explained</span>
        <p className="detail-explanation">{details.explanation}</p>
      </section>

      {details.extras && (
        <section>
          <h3>{details.extras.title}</h3>
          {details.extras.note && <p className="detail-note">{details.extras.note}</p>}
          <Rows rows={details.extras.rows} />
        </section>
      )}
    </aside>
  )
}
