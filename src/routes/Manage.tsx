import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { FUNCTIONS_URL, SUPABASE_ANON_KEY } from '../lib/config'
import { forgetToken, rememberToken } from '../lib/session'

type Listing = {
  first_name: string
  bracket: string
  current_size: number
  notes: string | null
  status: string
}

type Match = {
  contact_name: string
  email: string
  phone: string
  teammate_names: string | null
  current_size: number
  bracket: string
  notes: string | null
}

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; listing: Listing; matches: Match[] }
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
      return body as { listing: Listing; matches?: Match[] }
    },
    [token],
  )

  useEffect(() => {
    call('get')
      .then((body) => {
        // Valid token — remember it so this browser recognises them from now on.
        if (token) rememberToken(token)
        setState({ kind: 'ready', listing: body.listing, matches: body.matches ?? [] })
      })
      .catch((e) => setState({ kind: 'error', message: String(e.message) }))
  }, [call, token])

  async function act(action: 'matched' | 'closed') {
    setBusy(true)
    try {
      const body = await call(action)
      setState({ kind: 'ready', listing: body.listing, matches: [] })
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
            <h1 className="text-2xl font-semibold text-txt">That link didn't work</h1>
            <p className="mt-3 text-muted">{state.message}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/" className="btn-primary">
                Sign up
              </Link>
              <Link to="/recover" className="btn-ghost">
                Email me my link
              </Link>
            </div>
          </>
        )}

        {state.kind === 'ready' && (
          <Panel listing={state.listing} matches={state.matches} busy={busy} onAct={act} />
        )}
      </div>
    </Layout>
  )
}

function Panel({
  listing,
  matches,
  busy,
  onAct,
}: {
  listing: Listing
  matches: Match[]
  busy: boolean
  onAct: (a: 'matched' | 'closed') => void
}) {
  const done = listing.status === 'matched' || listing.status === 'closed'

  if (done) {
    return (
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-semibold text-txt">
          {listing.status === 'matched' ? 'Congrats on your team' : 'Listing removed'}
        </h1>
        <p className="mt-3 leading-relaxed text-muted">
          You're off the board and won't get any more emails about this.
        </p>
        <Link to="/" className="btn-primary mt-6" onClick={() => forgetToken()}>
          Sign up again
        </Link>
      </div>
    )
  }

  const short = 3 - listing.current_size

  return (
    <>
      <header>
        <p className="eyebrow">Your listing</p>
        <h1 className="mt-1.5 text-2xl font-semibold text-txt">
          {listing.bracket} · {listing.current_size === 1 ? 'Solo' : 'Pair'}
        </h1>
        <p className="mt-2 text-muted">
          Looking for {short} more {short === 1 ? 'athlete' : 'athletes'}
          {listing.status === 'pending' && ' · not confirmed yet'}
        </p>
      </header>

      {listing.status === 'pending' && (
        <p className="mt-6 border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber">
          This listing isn't live yet. Click the confirm link in your email to
          appear on the board and start matching.
        </p>
      )}

      <section className="mt-10">
        <h2 className="text-lg text-txt">
          {matches.length > 0
            ? `${matches.length} ${matches.length === 1 ? 'athlete' : 'athletes'} you can team up with`
            : 'No matches yet'}
        </h2>

        {matches.length === 0 ? (
          <p className="mt-3 text-muted">
            {listing.status === 'active'
              ? "Nobody compatible has signed up yet. We'll email you the moment someone does — and they'll show up here."
              : 'Confirm your listing to start matching.'}
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted2">
              Reach out directly — they have your details too.
            </p>
            <div className="mt-5 space-y-3">
              {matches.map((m) => (
                <MatchCard key={m.email + m.phone} match={m} />
              ))}
            </div>
          </>
        )}
      </section>

      <section className="mt-14 border-t border-line pt-8">
        <h2 className="text-lg text-txt">Done searching?</h2>
        <div className="mt-4 space-y-3">
          <button onClick={() => onAct('matched')} disabled={busy} className="btn-primary w-full">
            We found our team
          </button>
          <button onClick={() => onAct('closed')} disabled={busy} className="btn-ghost w-full">
            Remove my listing
          </button>
        </div>
        <p className="mt-4 text-center text-xs text-muted2">
          Either one takes you off the board immediately.
        </p>
      </section>
    </>
  )
}

function MatchCard({ match }: { match: Match }) {
  return (
    <article className="panel p-4">
      <h3 className="text-base text-txt">{match.contact_name}</h3>
      {match.teammate_names && (
        <p className="mt-0.5 text-xs text-muted2">with {match.teammate_names}</p>
      )}
      <p className="mt-1 text-sm text-muted">
        {match.current_size === 1 ? 'Solo' : 'Pair'} · needs {3 - match.current_size} more
      </p>

      {match.notes && (
        <p className="mt-3 text-sm leading-relaxed text-muted">{match.notes}</p>
      )}

      <dl className="mt-4 space-y-1 border-t border-line pt-3 text-sm">
        <div className="flex gap-2">
          <dt className="w-12 shrink-0 text-muted2">Email</dt>
          <dd className="min-w-0 break-all">
            <a href={`mailto:${match.email}`} className="text-txt underline underline-offset-4">
              {match.email}
            </a>
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-12 shrink-0 text-muted2">Phone</dt>
          <dd>
            <a href={`tel:${match.phone}`} className="text-txt underline underline-offset-4">
              {match.phone}
            </a>
          </dd>
        </div>
      </dl>
    </article>
  )
}
