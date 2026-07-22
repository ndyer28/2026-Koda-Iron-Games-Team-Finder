import type { ReactNode } from 'react'
import { NavLink, Link } from 'react-router-dom'

const EVENT_NAME = '2026 Koda Iron Games'

export default function Layout({
  children,
  width = 'narrow',
}: {
  children: ReactNode
  width?: 'narrow' | 'wide'
}) {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 text-neutral-100">
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
  return (
    <header className="border-b border-neutral-800/80">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <Link to="/" className="group">
          <span className="block text-xs uppercase tracking-[0.2em] text-neutral-500">
            {EVENT_NAME}
          </span>
          <span className="block font-semibold text-neutral-100 group-hover:text-white">
            Team Finder
          </span>
        </Link>

        <nav className="flex gap-1">
          <Tab to="/" end>
            Sign up
          </Tab>
          <Tab to="/board">Board</Tab>
        </nav>
      </div>
    </header>
  )
}

function Tab({
  to,
  end,
  children,
}: {
  to: string
  end?: boolean
  children: ReactNode
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        'rounded-lg px-3 py-1.5 text-sm transition ' +
        (isActive
          ? 'bg-neutral-800 font-medium text-neutral-100'
          : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200')
      }
    >
      {children}
    </NavLink>
  )
}

function Footer() {
  return (
    <footer className="border-t border-neutral-800/80 px-4 py-6">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 text-xs text-neutral-600">
        <p>Teams of three · Rx, Scaled, Masters · Men's and Women's</p>
        <p>
          Managing an existing listing? Use the link in your confirmation email.
        </p>
      </div>
    </footer>
  )
}
