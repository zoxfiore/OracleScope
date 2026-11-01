import { useState } from 'react'
import type { FormEvent } from 'react'
import { createConnection } from './api.ts'
import type { StoredConnection } from './storage.ts'

// Checked in order: a bad service name reports DPY-6001 alongside the generic DPY-6005.
const HINTS: Record<string, string> = {
  'ORA-01017': 'The username or password is incorrect.',
  'ORA-12514': 'The listener is up, but it does not know this service name.',
  'ORA-28000': 'This account is locked.',
  'ORA-01045': 'This account is missing the CREATE SESSION privilege.',
  'DPY-6001': 'The listener is up, but it does not know this service name.',
  'DPY-6005': 'Could not reach Oracle. Check the host and port, and that the database is running.',
}

function hintFor(message: string) {
  const code = Object.keys(HINTS).find((key) => message.includes(key))
  return code ? HINTS[code] : null
}

export function ConnectionForm({
  notice,
  onConnected,
}: {
  notice: string | null
  onConnected: (connection: StoredConnection) => void
}) {
  const [host, setHost] = useState('localhost')
  const [port, setPort] = useState('1521')
  const [serviceName, setServiceName] = useState('ORCLCDB')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const id = await createConnection({
        host,
        port: Number(port),
        service_name: serviceName,
        username,
        password,
      })
      setPassword('')
      onConnected({ id, username, target: `${host}:${port}/${serviceName}` })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed.')
    } finally {
      setSubmitting(false)
    }
  }

  const hint = error ? hintFor(error) : null

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <h1>Connect to your database</h1>
      <p className="form-lead">
        Enter your Oracle details to explore its architecture with live data.
      </p>

      {notice && !error && (
        <div className="form-error" role="status">
          <strong>{notice}</strong>
        </div>
      )}

      <div className="field-row">
        <label className="field">
          <span>Host</span>
          <input
            value={host}
            onChange={(event) => setHost(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            required
          />
        </label>
        <label className="field field-port">
          <span>Port</span>
          <input
            type="number"
            min={1}
            max={65535}
            value={port}
            onChange={(event) => setPort(event.target.value)}
            required
          />
        </label>
      </div>

      <label className="field">
        <span>Service name</span>
        <input
          value={serviceName}
          onChange={(event) => setServiceName(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          required
        />
      </label>

      <label className="field">
        <span>Username</span>
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="c##oraclescope"
          autoComplete="off"
          spellCheck={false}
          required
        />
      </label>

      <label className="field">
        <span>Password</span>
        <span className="password-input">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="off"
            required
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword((shown) => !shown)}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </span>
      </label>

      {error && (
        <div className="form-error" role="alert">
          {hint && <strong>{hint}</strong>}
          <span>{error}</span>
        </div>
      )}

      <button type="submit" className="button-primary" disabled={submitting}>
        {submitting ? 'Connecting…' : 'Connect'}
      </button>

      <p className="form-note">
        Your password goes only to the OracleScope backend on this machine and is never saved.
      </p>
    </form>
  )
}
