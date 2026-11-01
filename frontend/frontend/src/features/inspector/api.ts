import { ConnectionLostError } from '../dashboard/api.ts'
import type { ExecutionRecord } from './types.ts'

async function check(response: Response) {
  if (response.status === 404) {
    throw new ConnectionLostError('The connection to Oracle was lost. Connect again to continue.')
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(
      typeof body?.detail === 'string'
        ? body.detail
        : `The OracleScope backend returned HTTP ${response.status}.`,
    )
  }
  return response.json()
}

export async function runSql(connectionId: string, sql: string): Promise<ExecutionRecord> {
  const response = await fetch(`/api/connections/${connectionId}/sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  })
  return check(response)
}

export async function fetchHistory(
  connectionId: string,
  signal: AbortSignal,
): Promise<ExecutionRecord[]> {
  return check(await fetch(`/api/connections/${connectionId}/sql`, { signal }))
}
