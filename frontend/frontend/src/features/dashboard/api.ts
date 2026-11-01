import type { Overview } from './types.ts'

export class ConnectionLostError extends Error {}

export async function fetchOverview(connectionId: string, signal: AbortSignal): Promise<Overview> {
  const response = await fetch(`/api/connections/${connectionId}/overview`, { signal })

  if (response.status === 404) {
    throw new ConnectionLostError('The connection to Oracle was lost. Connect again to continue.')
  }
  if (!response.ok) {
    throw new Error(`The OracleScope backend returned HTTP ${response.status}.`)
  }

  return response.json()
}
