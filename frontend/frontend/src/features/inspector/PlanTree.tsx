import { formatDuration, formatNumber } from '../dashboard/format.ts'
import { estimateGap } from './planSummary.ts'
import type { PlanStep } from './types.ts'

function depths(plan: PlanStep[]) {
  const result = new Map<number, number>()
  for (const step of plan) {
    result.set(step.id, step.parent_id === null ? 0 : (result.get(step.parent_id) ?? 0) + 1)
  }
  return result
}

// A parent normally runs after the children that supply its rows.
function executionOrder(plan: PlanStep[]) {
  const order = new Map<number, number>()
  let next = 1

  function visit(step: PlanStep) {
    plan.filter((child) => child.parent_id === step.id).forEach(visit)
    order.set(step.id, next++)
  }

  plan.filter((step) => step.parent_id === null).forEach(visit)
  return order
}

export function PlanTree({
  plan,
  selectedId,
  onSelect,
}: {
  plan: PlanStep[]
  selectedId: number
  onSelect: (id: number) => void
}) {
  const depth = depths(plan)
  const order = executionOrder(plan)
  const maxGets = Math.max(...plan.map((step) => step.buffer_gets ?? 0), 1)

  return (
    <div className="table-scroll">
      <table className="plan-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Operation</th>
            <th>Object</th>
            <th className="num">Est. rows</th>
            <th className="num">Actual rows</th>
            <th className="num">Buffer gets</th>
            <th className="num">Disk reads</th>
            <th className="num">Time</th>
          </tr>
        </thead>
        <tbody>
          {plan.map((step) => {
            const gap = estimateGap(step)
            return (
              <tr
                key={step.id}
                className={step.id === selectedId ? 'is-selected' : undefined}
                onClick={() => onSelect(step.id)}
              >
                <td className="plan-order">{order.get(step.id)}</td>
                <td>
                  <button
                    type="button"
                    className="plan-operation"
                    style={{ paddingLeft: (depth.get(step.id) ?? 0) * 16 }}
                    onClick={() => onSelect(step.id)}
                  >
                    {(depth.get(step.id) ?? 0) > 0 && <span aria-hidden="true">└ </span>}
                    <strong>{step.operation}</strong> {step.options}
                  </button>
                </td>
                <td className="plan-object">{step.object_name}</td>
                <td className="num">{formatNumber(step.estimated_rows)}</td>
                <td className="num">
                  {formatNumber(step.actual_rows)}
                  {gap && <span className="estimate-gap">×{formatNumber(gap)} off</span>}
                </td>
                <td className="num">
                  {formatNumber(step.buffer_gets)}
                  <span className="plan-bar" aria-hidden="true">
                    <span style={{ width: `${((step.buffer_gets ?? 0) / maxGets) * 100}%` }} />
                  </span>
                </td>
                <td className="num">{formatNumber(step.disk_reads)}</td>
                <td className="num">{formatDuration(step.elapsed_us)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
