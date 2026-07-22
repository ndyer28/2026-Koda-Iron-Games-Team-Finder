import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { FUNCTIONS_URL, SUPABASE_ANON_KEY } from '../lib/config'

type Listing = {
  first_name: string
  bracket: string
  current_size: number
  notes: string | null
  status: string
}

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; listing: Listing }
  | { kind: 'error'; message: string }

export default function Manage() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)

  const call = useCallback(
    async (action: 'get' | 'matched' | 'closed') => {
      const res = await fetch(`${FUNCTIONS_URL}/manage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ token, action }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Something went wrong.')
      return body.listing as Listing
    },
    [token],
  )

  useEffect(() => {
    call('get')
      .then((listing) => setState({ kind: 'ready', listing }))
      .catch((e) => setState({ kind: 'error', message: String(e.message) }))
  }, [call])

  async function act(action: 'matched' | 'closed') {
    setBusy(true)
    try {
      const listing = await call(action)
      setState({ kind: 'ready', listing })
    } catch (e) {
      setState({ kind: 'error', message: String((e as Error).message) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layout>
      <div>
        {state.kind === 'loading' && <p className="text-neutral-500">Loading…</p>}

        {state.kind === 'error' && (
          <>
            <h1 className="text-2xl font-semibold text-neutral-50">
              That link didn't work
            </h1>
            <p className="mt-3 text-neutral-400">{state.message}</p>
            <Link to="/" className="mt-6 inline-block text-neutral-300 underline underline-offset-4">
              Back to sign-up
            </Link>
          </>
        )}

        {state.kind === 'ready' && <Panel listing={state.listing} busy={busy} onAct={act} />}
      </div>
    </Layout>
  )
}

function Panel({
  listing,
  busy,
  onAct,
}: {
  listing: Listing
  busy: boolean
  onAct: (a: 'matched' | 'closed') => void
}) {
  const done = listing.status === 'matched' || listing.status === 'closed'

  if (done) {
    return (
      <>
        <h1 className="text-2xl font-semibold text-neutral-50">
          {listing.status === 'matched' ? 'Congrats on your team' : 'Listing removed'}
        </h1>
        <p className="mt-3 leading-relaxed text-neutral-400">
          You're off the board and won't get any more emails about this.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-lg bg-neutral-100 px-4 py-2.5 font-semibold text-neutral-900 hover:bg-white"
        >
          Sign up again
        </Link>
      </>
    )
  }

  const short = 3 - listing.current_size

  return (
    <>
      <h1 className="text-2xl font-semibold text-neutral-50">Your listing</h1>

      <dl className="mt-6 space-y-2 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 text-sm">
        <Row label="Name" value={listing.first_name} />
        <Row label="Bracket" value={listing.bracket} />
        <Row
          label="Looking for"
          value={`${short} more ${short === 1 ? 'athlete' : 'athletes'}`}
        />
        {listing.notes && <Row label="Notes" value={listing.notes} />}
      </dl>

      <div className="mt-8 space-y-3">
        <button
          onClick={() => onAct('matched')}
          disabled={busy}
          className="w-full rounded-lg bg-neutral-100 px-4 py-3 font-semibold text-neutral-900 transition hover:bg-white disabled:opacity-50"
        >
          We found our team
        </button>
        <button
          onClick={() => onAct('closed')}
          disabled={busy}
          className="w-full rounded-lg border border-neutral-700 px-4 py-3 font-medium text-neutral-300 transition hover:border-neutral-500 disabled:opacity-50"
        >
          Remove my listing
        </button>
      </div>

      <p className="mt-4 text-center text-xs text-neutral-600">
        Either one takes you off the board immediately.
      </p>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-neutral-500">{label}</dt>
      <dd className="text-neutral-200">{value}</dd>
    </div>
  )
}
