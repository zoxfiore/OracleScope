export interface StoredConnection {
  id: string
  username: string
  target: string
}

const KEY = 'oraclescope.connection'

export function loadConnection(): StoredConnection | null {
  try {
    const stored = sessionStorage.getItem(KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

export function saveConnection(connection: StoredConnection | null) {
  try {
    if (connection) sessionStorage.setItem(KEY, JSON.stringify(connection))
    else sessionStorage.removeItem(KEY)
  } catch {
    // Without storage, a page refresh just returns to the connection form.
  }
}
