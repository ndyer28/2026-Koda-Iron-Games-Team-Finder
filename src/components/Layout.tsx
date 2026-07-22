import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { forgetToken, getToken } from '../lib/session'

const EVENT = {
  name: '2026 Koda Iron Games',
  dates: 'October 3 & 4, 2026',
  venue: 'Koda CrossFit Iron View, Colorado',
}

export default function Layout({
  children,
  width = 'narrow',
}: {
  children: ReactNode
  width?: 'narrow' | 'wide'
}) {
  return (
    <div className="flex min-h-screen flex-col bg-ink text-txt">
      {/* Thin red rule across the top — the sponsor site's signature. */}
      <div className="h-1 bg-red" />
      <Header />
      <main className="flex-1 px-4 py-10">
        <div className={width === 'wide' ? 'mx-auto max-w-5xl' : 'mx-auto max-w-lg'}>
          {children}
        </div>
      </main>
      <Footer />
    </div>
  )
}

function Header() {
  const location = useLocation()
  const [token, setToken] = useState<string | null>(null)

  // Re-read on navigation: the token is written during /confirm and /manage,
  // so the nav needs to pick it up without a reload.
  useEffect(() => setToken(getToken()), [location.pathname])

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-5">
        <Link to="/" className="group leading-none">
          <span className="eyebrow block">{EVENT.name}</span>
          <span className="mt-1.5 block font-display text-2xl uppercase tracking-wide text-txt">
            Team Finder
          </span>
        </Link>

        <nav className="flex items-center">
          <Tab to="/" end>
            Sign up
          </Tab>
          <Tab to="/board">Board</Tab>
          {token && <Tab to={`/manage/${token}`}>My listing</Tab>}
          {token && (
            <button
              onClick={() => {
                forgetToken()
                setToken(null)
              }}
              title="Forget this listing on this browser"
              className="ml-2 px-2 py-2 text-xs font-bold uppercase tracking-[0.14em] text-muted2 transition hover:text-muted"
            >
              Sign out
            </button>
          )}
        </nav>
      </div>
    </header>
  )
}

function Tab({ to, end, children }: { to: string; end?: boolean; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        'border-b-2 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] transition ' +
        (isActive
          ? 'border-red text-txt'
          : 'border-transparent text-muted2 hover:text-muted')
      }
    >
      {children}
    </NavLink>
  )
}

function Footer() {
  return (
    <footer className="border-t border-line px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-2 text-xs text-muted2">
        <p className="font-semibold uppercase tracking-[0.14em] text-muted">
          {EVENT.dates} · {EVENT.venue}
        </p>
        <p>Teams of three · Rx, Scaled, Masters · Men's and Women's</p>
        <p>
          Managing an existing listing? Use the link in your confirmation email,
          or{' '}
          <Link to="/recover" className="text-muted underline underline-offset-4">
            have it sent again
          </Link>
          .
        </p>
      </div>
    </footer>
  )
}
