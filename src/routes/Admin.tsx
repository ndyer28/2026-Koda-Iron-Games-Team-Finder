import { useCallback, useState, type FormEvent } from 'react'
import { FUNCTIONS_URL, SUPABASE_ANON_KEY } from '../lib/config'

type Row = {
  id: string
  created_at: string
  contact_name: string
  email: string
  phone: string
  teammate_names: string | null
  division: string
  sex_division: string
  current_size: number
  notes: string | null
  status: string
  confirmed_at: string | null
  last_notified_at: string | null
  manage_token: string
}

const STATUSES = ['pending', 'active', 'matched', 'closed'] as const

export default function Admin() {
  // Held in memory only — never localStorage. A shared password in
  // localStorage survives the tab and is readable by any script on the origin.
  const [password, setPassword] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const call = useCallback(
    async (payload: Record<string, unknown>) => {
      const res = await fetch(`${FUNCTIONS_URL}/admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ password, ...payload }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Something went wrong.')
      return body
    },
    [password],
  )

  async function login(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const body = await call({ action: 'list' })
      setRows(body.listings as Row[])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function setStatus(id: string, status: string) {
    setBusy(true)
    try {
      await call({ action: 'set_status', id, status })
      const body = await call({ action: 'list' })
      setRows(body.listings as Row[])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function downloadCsv() {
    if (!rows) return
    const cols: (keyof Row)[] = [
      'created_at', 'contact_name', 'email', 'phone', 'teammate_names',
      'division', 'sex_division', 'current_size', 'status', 'notes',
    ]
    const esc = (v: unknown) => {
      const s = v == null ? '' : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const csv = [
      cols.join(','),
      ...rows.map((r) => cols.map((c) => esc(r[c])).join(',')),
    ].join('\n')

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `listings-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!rows) {
    return (
      <main className="grid min-h-screen place-items-center bg-neutral-950 px-4 text-neutral-100">
        <form onSubmit={login} className="w-full max-w-xs">
          <h1 className="text-lg font-semibold">Admin</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            className="mt-4 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-neutral-100 focus:border-neutral-500 focus:outline-none"
          />
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          <button
            disabled={busy || !password}
            className="mt-4 w-full rounded-lg bg-neutral-100 px-4 py-2.5 font-semibold text-neutral-900 disabled:opacity-50"
          >
            {busy ? 'Checking…' : 'Sign in'}
          </button>
        </form>
      </main>
    )
  }

  const counts = STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length] as const)

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-10 text-neutral-100">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Listings</h1>
            <p className="mt-1 text-sm text-neutral-500">
              {rows.length} total ·{' '}
              {counts.map(([s, n]) => `${n} ${s}`).join(' · ')}
            </p>
          </div>
          <button
            onClick={downloadCsv}
            className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-white"
          >
            Download CSV
          </button>
        </header>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-800">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-neutral-900 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2.5 font-medium">Name</th>
                <th className="px-3 py-2.5 font-medium">Contact</th>
                <th className="px-3 py-2.5 font-medium">Bracket</th>
                <th className="px-3 py-2.5 font-medium">Size</th>
                <th className="px-3 py-2.5 font-medium">Notes</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-3 py-3">
                    <div className="font-medium text-neutral-100">{r.contact_name}</div>
                    {r.teammate_names && (
                      <div className="text-xs text-neutral-500">+ {r.teammate_names}</div>
                    )}
                    <div className="text-xs text-neutral-600">
                      {new Date(r.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-neutral-300">
                    <div>{r.email}</div>
                    <div className="text-neutral-500">{r.phone}</div>
                  </td>
                  <td className="px-3 py-3 capitalize text-neutral-300">
                    {r.sex_division === 'male' ? "Men's" : "Women's"} {r.division}
                  </td>
                  <td className="px-3 py-3 text-neutral-300">
                    {r.current_size === 1 ? 'Solo' : 'Pair'}
                  </td>
                  <td className="max-w-xs px-3 py-3 text-neutral-400">{r.notes}</td>
                  <td className="px-3 py-3">
                    <select
                      value={r.status}
                      disabled={busy}
                      onChange={(e) => setStatus(r.id, e.target.value)}
                      className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-200"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
