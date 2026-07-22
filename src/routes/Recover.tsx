import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { FUNCTIONS_URL, SUPABASE_ANON_KEY } from '../lib/config'

type State =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; message: string }
  | { kind: 'error'; message: string }

export default function Recover() {
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState({ kind: 'sending' })

    const email = new FormData(e.currentTarget).get('email')

    try {
      const res = await fetch(`${FUNCTIONS_URL}/recover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ email }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setState({ kind: 'error', message: body.error ?? 'Something went wrong.' })
        return
      }
      setState({ kind: 'sent', message: body.message })
    } catch {
      setState({ kind: 'error', message: 'Could not reach the server.' })
    }
  }

  if (state.kind === 'sent') {
    return (
      <Layout>
        <h1 className="text-2xl">Check your email</h1>
        <p className="mt-3 leading-relaxed text-muted">{state.message}</p>
        <p className="mt-4 text-sm text-muted2">
          Nothing after a few minutes? You may have signed up with a different
          address — or not yet at all.
        </p>
        <Link to="/" className="btn-ghost mt-6">
          Back to sign-up
        </Link>
      </Layout>
    )
  }

  return (
    <Layout>
      <h1 className="text-2xl">Find my listing</h1>
      <p className="mt-3 leading-relaxed text-muted">
        Lost the email? Enter the address you signed up with and we'll send your
        manage link again.
      </p>

      <form onSubmit={onSubmit} className="mt-8">
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="field"
        />

        {state.kind === 'error' && (
          <p className="mt-3 border border-red/40 bg-red/10 px-3 py-2.5 text-sm text-red">
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={state.kind === 'sending'}
          className="btn-primary mt-5 w-full"
        >
          {state.kind === 'sending' ? 'Sending…' : 'Email me my link'}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-muted2">
        Haven't signed up yet?{' '}
        <Link to="/" className="text-muted underline underline-offset-4">
          Add your listing
        </Link>
      </p>
    </Layout>
  )
}
