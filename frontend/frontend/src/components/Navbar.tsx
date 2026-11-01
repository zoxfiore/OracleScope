import type { ReactNode } from 'react'
import { Logo } from './Logo.tsx'

const LINKS = [
  { href: '#about', label: 'About' },
  { href: '#requirements', label: 'Requirements' },
  { href: '#setup', label: 'Setup' },
  { href: '#data', label: 'Data sources' },
  { href: '#privacy', label: 'Privacy' },
]

export function LandingLinks() {
  return (
    <>
      <nav className="navbar-links" aria-label="Documentation sections">
        {LINKS.map((link) => (
          <a key={link.href} href={link.href}>
            {link.label}
          </a>
        ))}
      </nav>
      <span className="local-badge">
        <span className="local-badge-dot" aria-hidden="true" />
        Runs locally
      </span>
    </>
  )
}

export function Navbar({ children }: { children: ReactNode }) {
  return (
    <header className="navbar">
      <a href="/" className="navbar-brand" aria-label="OracleScope home">
        <Logo />
      </a>
      {children}
    </header>
  )
}
