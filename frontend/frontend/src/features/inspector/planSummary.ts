import type { ExecutionRecord, PlanStep } from './types.ts'

const ESTIMATE_WARNING_RATIO = 10

const DATA_ACCESS = /^(TABLE ACCESS|INDEX|FIXED TABLE)/

// The step that finds the data, preferring an index over the table it leads to.
function mainStep(record: ExecutionRecord) {
  const steps = record.plan.filter((step) => DATA_ACCESS.test(step.operation))
  return steps.find((candidate) => candidate.operation === 'INDEX') ?? steps[0]
}

export function mainOperation(record: ExecutionRecord) {
  const step = mainStep(record)
  return step ? [step.operation, step.options].filter(Boolean).join(' ') : null
}

export function mainStepId(record: ExecutionRecord) {
  return mainStep(record)?.id ?? 0
}

const normalize = (sql: string) => sql.replace(/\s+/g, ' ').trim().toLowerCase()

// Prefer the latest earlier run with a different plan, so re-running a query
// after creating an index keeps comparing against the plan before the index.
export function comparisonFor(record: ExecutionRecord, history: ExecutionRecord[]) {
  const earlier = history.filter(
    (candidate) =>
      candidate.id < record.id &&
      candidate.status === 'ok' &&
      candidate.plan.length > 0 &&
      normalize(candidate.sql) === normalize(record.sql),
  )
  const operation = mainOperation(record)
  return earlier.find((candidate) => mainOperation(candidate) !== operation) ?? earlier[0] ?? null
}

// Returns how many times the optimizer's estimate was off, when the gap is large.
export function estimateGap(step: PlanStep) {
  if (step.estimated_rows === null || step.actual_rows === null) return null

  // The estimate is per start, while the actual count covers all starts.
  const estimated = Math.max(step.estimated_rows * (step.starts ?? 1), 1)
  const actual = Math.max(step.actual_rows, 1)
  const ratio = Math.max(estimated / actual, actual / estimated)
  return ratio >= ESTIMATE_WARNING_RATIO ? Math.round(ratio) : null
}
