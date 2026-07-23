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
  const [editing, setEditing] = useState<Row | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Row | null>(null)

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

  async function saveEdit(patch: Partial<Row> & { id: string }) {
    setBusy(true)
    setError(null)
    try {
      await call({ action: 'update', ...patch })
      const body = await call({ action: 'list' })
      setRows(body.listings as Row[])
      setEditing(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function doDelete(row: Row) {
    setBusy(true)
    setError(null)
    try {
      await call({ action: 'delete', id: row.id })
      const body = await call({ action: 'list' })
      setRows(body.listings as Row[])
      setConfirmDelete(null)
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
      <main className="grid min-h-screen place-items-center bg-ink px-4 text-txt">
        <form onSubmit={login} className="w-full max-w-xs">
          <h1 className="text-lg font-semibold">Admin</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            className="mt-4 w-full border border-line bg-panel2 px-3 py-2.5 text-txt focus:border-red focus:outline-none"
          />
          {error && <p className="mt-3 text-sm text-red">{error}</p>}
          <button
            disabled={busy || !password}
            className="btn-primary mt-4 w-full"
          >
            {busy ? 'Checking…' : 'Sign in'}
          </button>
        </form>
      </main>
    )
  }

  const counts = STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length] as const)

  return (
    <main className="min-h-screen bg-ink px-4 py-10 text-txt">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Listings</h1>
            <p className="mt-1 text-sm text-muted2">
              {rows.length} total ·{' '}
              {counts.map(([s, n]) => `${n} ${s}`).join(' · ')}
            </p>
          </div>
          <button
            onClick={downloadCsv}
            className="btn-primary"
          >
            Download CSV
          </button>
        </header>

        {error && <p className="mt-4 text-sm text-red">{error}</p>}

        <div className="mt-6 overflow-x-auto border border-line">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-panel2 text-left text-xs uppercase tracking-wide text-muted2">
              <tr>
                <th className="px-3 py-2.5 font-medium">Name</th>
                <th className="px-3 py-2.5 font-medium">Contact</th>
                <th className="px-3 py-2.5 font-medium">Bracket</th>
                <th className="px-3 py-2.5 font-medium">Size</th>
                <th className="px-3 py-2.5 font-medium">Notes</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-3 py-3">
                    <div className="font-medium text-txt">{r.contact_name}</div>
                    {r.teammate_names && (
                      <div className="text-xs text-muted2">+ {r.teammate_names}</div>
                    )}
                    <div className="text-xs text-muted2">
                      {new Date(r.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-muted">
                    <div>{r.email}</div>
                    <div className="text-muted2">{r.phone}</div>
                  </td>
                  <td className="px-3 py-3 capitalize text-muted">
                    {r.sex_division === 'male' ? "Men's" : "Women's"} {r.division}
                  </td>
                  <td className="px-3 py-3 text-muted">
                    {r.current_size === 1 ? 'Solo' : 'Pair'}
                  </td>
                  <td className="max-w-xs px-3 py-3 text-muted">{r.notes}</td>
                  <td className="px-3 py-3">
                    <select
                      value={r.status}
                      disabled={busy}
                      onChange={(e) => setStatus(r.id, e.target.value)}
                      className="border border-line bg-panel2 px-2 py-1 text-txt"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    <button
                      onClick={() => setEditing(r)}
                      disabled={busy}
                      className="text-sm text-muted underline underline-offset-4 hover:text-txt disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setConfirmDelete(r)}
                      disabled={busy}
                      className="ml-3 text-sm text-red underline underline-offset-4 hover:text-redhi disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <EditPanel
          row={editing}
          busy={busy}
          onCancel={() => setEditing(null)}
          onSave={saveEdit}
        />
      )}

      {confirmDelete && (
        <DeletePanel
          row={confirmDelete}
          busy={busy}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => doDelete(confirmDelete)}
        />
      )}
    </main>
  )
}

const overlay =
  'fixed inset-0 z-50 grid place-items-center bg-ink/80 px-4 py-10 overflow-y-auto'

function EditPanel({
  row,
  busy,
  onCancel,
  onSave,
}: {
  row: Row
  busy: boolean
  onCancel: () => void
  onSave: (patch: Partial<Row> & { id: string }) => void
}) {
  const [f, setF] = useState({
    contact_name: row.contact_name,
    email: row.email,
    phone: row.phone,
    teammate_names: row.teammate_names ?? '',
    division: row.division,
    sex_division: row.sex_division,
    current_size: row.current_size,
    notes: row.notes ?? '',
  })

  const set = (k: keyof typeof f) => (v: string | number) =>
    setF((prev) => ({ ...prev, [k]: v }))

  return (
    <div className={overlay} onClick={onCancel}>
      <div
        className="w-full max-w-lg border border-line bg-panel p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg text-txt">Edit listing</h2>
        <p className="mt-1 text-xs text-muted2">
          The athlete's confirm and manage links are unaffected.
        </p>

        <div className="mt-5 space-y-4">
          <Field label="Name">
            <input
              className="field"
              value={f.contact_name}
              onChange={(e) => set('contact_name')(e.target.value)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email">
              <input
                className="field"
                value={f.email}
                onChange={(e) => set('email')(e.target.value)}
              />
            </Field>
            <Field label="Phone">
              <input
                className="field"
                value={f.phone}
                onChange={(e) => set('phone')(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Division">
              <select
                className="field"
                value={f.division}
                onChange={(e) => set('division')(e.target.value)}
              >
                <option value="rx">Rx</option>
                <option value="scaled">Scaled</option>
                <option value="masters">Masters</option>
              </select>
            </Field>
            <Field label="Category">
              <select
                className="field"
                value={f.sex_division}
                onChange={(e) => set('sex_division')(e.target.value)}
              >
                <option value="male">Men's</option>
                <option value="female">Women's</option>
              </select>
            </Field>
            <Field label="Size">
              <select
                className="field"
                value={f.current_size}
                onChange={(e) => set('current_size')(Number(e.target.value))}
              >
                <option value={1}>Solo</option>
                <option value={2}>Pair</option>
              </select>
            </Field>
          </div>

          <Field label="Teammate names">
            <input
              className="field"
              value={f.teammate_names}
              onChange={(e) => set('teammate_names')(e.target.value)}
            />
          </Field>

          <Field label="Notes">
            <textarea
              className="field resize-none"
              rows={3}
              maxLength={300}
              value={f.notes}
              onChange={(e) => set('notes')(e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            disabled={busy}
            onClick={() => onSave({ id: row.id, ...f })}
            className="btn-primary flex-1"
          >
            {busy ? 'Saving…' : 'Save changes'}
          </button>
          <button disabled={busy} onClick={onCancel} className="btn-ghost">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function DeletePanel({
  row,
  busy,
  onCancel,
  onConfirm,
}: {
  row: Row
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const [typed, setTyped] = useState('')
  const armed = typed.trim().toLowerCase() === 'delete'

  return (
    <div className={overlay} onClick={onCancel}>
      <div
        className="w-full max-w-md border border-red/50 bg-panel p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg text-txt">Delete this listing?</h2>

        <div className="mt-4 border border-line bg-panel2 p-3 text-sm">
          <p className="text-txt">{row.contact_name}</p>
          <p className="text-muted2">{row.email}</p>
          <p className="text-muted2">
            {row.sex_division === 'male' ? "Men's" : "Women's"} {row.division} ·{' '}
            {row.current_size === 1 ? 'Solo' : 'Pair'} · {row.status}
          </p>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-muted">
          This permanently removes the row. It cannot be undone, and their
          confirm and manage links stop working immediately.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          To take someone off the board reversibly, set their status to{' '}
          <strong className="text-txt">closed</strong> instead.
        </p>

        <label className="label mt-5">Type DELETE to confirm</label>
        <input
          className="field"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoFocus
        />

        <div className="mt-5 flex gap-3">
          <button
            disabled={busy || !armed}
            onClick={onConfirm}
            className="btn-primary flex-1"
          >
            {busy ? 'Deleting…' : 'Delete permanently'}
          </button>
          <button disabled={busy} onClick={onCancel} className="btn-ghost">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label">{label}</p>
      {children}
    </div>
  )
}
