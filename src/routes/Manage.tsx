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
        {state.kind === 'loading' && <p className="text-muted2">Loading…</p>}

        {state.kind === 'error' && (
          <>
            <h1 className="text-2xl font-semibold text-txt">
              That link didn't work
            </h1>
            <p className="mt-3 text-muted">{state.message}</p>
            <Link to="/" className="mt-6 inline-block text-muted underline underline-offset-4">
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
        <h1 className="text-2xl font-semibold text-txt">
          {listing.status === 'matched' ? 'Congrats on your team' : 'Listing removed'}
        </h1>
        <p className="mt-3 leading-relaxed text-muted">
          You're off the board and won't get any more emails about this.
        </p>
        <Link
          to="/"
          className="btn-primary w-full"
        >
          Sign up again
        </Link>
      </>
    )
  }

  const short = 3 - listing.current_size

  return (
    <>
      <h1 className="text-2xl font-semibold text-txt">Your listing</h1>

      <dl className="mt-6 space-y-2 border border-line bg-panel p-4 text-sm">
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
          className="btn-primary w-full"
        >
          We found our team
        </button>
        <button
          onClick={() => onAct('closed')}
          disabled={busy}
          className="btn-ghost w-full"
        >
          Remove my listing
        </button>
      </div>

      <p className="mt-4 text-center text-xs text-muted2">
        Either one takes you off the board immediately.
      </p>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-muted2">{label}</dt>
      <dd className="text-txt">{value}</dd>
    </div>
  )
}
