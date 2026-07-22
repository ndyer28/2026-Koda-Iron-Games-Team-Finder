import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { FUNCTIONS_URL, SUPABASE_ANON_KEY } from '../lib/config'

type State =
  | { kind: 'working' }
  | { kind: 'done'; matches: number; already: boolean; manageToken: string }
  | { kind: 'error'; message: string }

export default function Confirm() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<State>({ kind: 'working' })
  const fired = useRef(false)

  useEffect(() => {
    // StrictMode double-invokes effects in dev; confirming twice is harmless
    // server-side but would flash the UI, so guard it.
    if (fired.current) return
    fired.current = true

    ;(async () => {
      try {
        const res = await fetch(`${FUNCTIONS_URL}/confirm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ token }),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          setState({ kind: 'error', message: body.error ?? 'Something went wrong.' })
          return
        }
        setState({
          kind: 'done',
          matches: body.matches ?? 0,
          already: !!body.already,
          manageToken: body.manage_token ?? '',
        })
      } catch {
        setState({ kind: 'error', message: 'Could not reach the server.' })
      }
    })()
  }, [token])

  return (
    <Layout>
      <div>
        {state.kind === 'working' && (
          <p className="text-muted">Confirming your listing…</p>
        )}

        {state.kind === 'error' && (
          <>
            <h1 className="text-2xl font-semibold text-txt">
              That link didn't work
            </h1>
            <p className="mt-3 text-muted">{state.message}</p>
            <Link
              to="/"
              className="btn-primary"
            >
              Sign up again
            </Link>
          </>
        )}

        {state.kind === 'done' && (
          <>
            <h1 className="text-2xl font-semibold text-txt">
              {state.already ? "You're already on the board" : "You're on the board"}
            </h1>

            <p className="mt-3 leading-relaxed text-muted">
              {state.matches > 0 ? (
                <>
                  We found <strong className="text-txt">{state.matches}</strong>{' '}
                  {state.matches === 1 ? 'athlete' : 'athletes'} you can team up with.
                  Their contact details are in your inbox.
                </>
              ) : (
                <>
                  Nobody compatible has signed up yet. The moment someone does,
                  we'll email you their details.
                </>
              )}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/board"
                className="btn-primary"
              >
                See the board
              </Link>
              {state.manageToken && (
                <Link
                  to={`/manage/${state.manageToken}`}
                  className="btn-ghost"
                >
                  Manage my listing
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
