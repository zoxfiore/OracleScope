export interface PlanStep {
  id: number
  parent_id: number | null
  operation: string
  options: string | null
  object_name: string | null
  estimated_rows: number | null
  starts: number | null
  actual_rows: number | null
  buffer_gets: number | null
  disk_reads: number | null
  elapsed_us: number | null
  access_predicates: string | null
  filter_predicates: string | null
}

export interface ExecutionRecord {
  id: number
  sql: string
  status: 'ok' | 'error'
  executed_at: string
  error: string | null
  elapsed_ms: number | null
  columns: string[]
  rows: unknown[][]
  rows_fetched: number
  fully_fetched: boolean
  sql_id: string | null
  child_number: number | null
  plan: PlanStep[]
  statistics: { name: string; change: number }[]
  waits: { event: string; wait_class: string; waits: number; time_us: number }[]
  background: { process: string; event: string; waits: number; time_us: number }[]
  process: {
    sid: number
    serial: number
    username: string | null
    oracle_pid: number
    os_pid: string
  } | null
  warnings: string[]
}
