export interface ConnectionRequest {
  host: string
  port: number
  service_name: string
  username: string
  password: string
}

async function readError(response: Response) {
  const body = await response.json().catch(() => null)

  if (typeof body?.detail === 'string') return body.detail
  if (Array.isArray(body?.detail)) {
    return body.detail.map((item: { msg: string }) => item.msg).join(' ')
  }
  return `The OracleScope backend returned HTTP ${response.status}. Is it running on port 8000?`
}

export async function createConnection(request: ConnectionRequest): Promise<string> {
  const response = await fetch('/api/connections/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  if (!response.ok) throw new Error(await readError(response))

  const body: { connection_id: string } = await response.json()
  return body.connection_id
}

export async function closeConnection(connectionId: string): Promise<void> {
  const response = await fetch(`/api/connections/${connectionId}`, { method: 'DELETE' })

  if (!response.ok) throw new Error(await readError(response))
}
