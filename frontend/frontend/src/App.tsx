import { useCallback, useState, useSyncExternalStore } from 'react'
import { Navbar, LandingLinks } from './components/Navbar.tsx'
import { ConnectionForm } from './features/connections/ConnectionForm.tsx'
import { loadConnection, saveConnection } from './features/connections/storage.ts'
import type { StoredConnection } from './features/connections/storage.ts'
import { Dashboard } from './features/dashboard/Dashboard.tsx'
import { DocsPanel } from './features/docs/DocsPanel.tsx'
import { PresentationPage } from './features/presentation/PresentationPage.tsx'

function subscribeToHash(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

const readHash = () => window.location.hash

function App() {
  const [connection, setConnection] = useState(loadConnection)
  const [notice, setNotice] = useState<string | null>(null)
  const hash = useSyncExternalStore(subscribeToHash, readHash)

  function handleConnected(next: StoredConnection) {
    saveConnection(next)
    setNotice(null)
    setConnection(next)
  }

  const handleDisconnected = useCallback((message?: string) => {
    saveConnection(null)
    setNotice(message ?? null)
    setConnection(null)
  }, [])

  if (hash.startsWith('#/presentation')) {
    return <PresentationPage hash={hash} />
  }

  if (connection) {
    return <Dashboard connection={connection} onDisconnected={handleDisconnected} />
  }

  return (
    <>
      <Navbar>
        <LandingLinks />
      </Navbar>
      <main className="split">
        <aside className="split-form">
          <ConnectionForm notice={notice} onConnected={handleConnected} />
        </aside>
        <div className="split-docs">
          <DocsPanel />
        </div>
      </main>
    </>
  )
}

export default App
