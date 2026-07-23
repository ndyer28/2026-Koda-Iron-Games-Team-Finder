import { useState, type FormEvent } from 'react'
import Layout from '../components/Layout'
import { FUNCTIONS_URL, NOTES_MAX, SUPABASE_ANON_KEY } from '../lib/config'

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; duplicate: boolean }
  | { kind: 'error'; message: string }

const field = 'field'

const label = 'label'

export default function Submit() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [size, setSize] = useState<1 | 2>(1)
  const [notes, setNotes] = useState('')
  const [divisions, setDivisions] = useState<string[]>([])

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (divisions.length === 0) {
      setStatus({ kind: 'error', message: 'Pick at least one division.' })
      return
    }
    setStatus({ kind: 'sending' })

    const fd = new FormData(e.currentTarget)
    const payload = {
      contact_name: fd.get('contact_name'),
      email: fd.get('email'),
      phone: fd.get('phone'),
      divisions,
      sex_division: fd.get('sex_division'),
      current_size: Number(fd.get('current_size')),
      teammate_names: fd.get('teammate_names'),
      notes: fd.get('notes'),
      website: fd.get('website'), // honeypot
    }

    try {
      const res = await fetch(`${FUNCTIONS_URL}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus({ kind: 'error', message: json.error ?? 'Something went wrong.' })
        return
      }
      setStatus({ kind: 'sent', duplicate: !!json.duplicate })
    } catch {
      setStatus({ kind: 'error', message: 'Could not reach the server. Check your connection.' })
    }
  }

  if (status.kind === 'sent' && status.duplicate) {
    return (
      <Layout>
        <h1 className="text-2xl font-semibold text-txt">You're already on the board</h1>
        <p className="mt-3 text-muted leading-relaxed">
          That address already has a listing, so we didn't create a second one —
          duplicates would show you twice on the board and in everyone's matches.
        </p>
        <p className="mt-3 text-muted leading-relaxed">
          We've emailed you the link to manage the listing you already have.
        </p>
      </Layout>
    )
  }

  if (status.kind === 'sent') {
    return (
      <Layout>
        <h1 className="text-2xl font-semibold text-txt">Check your email</h1>
        <p className="mt-3 text-muted leading-relaxed">
          We sent you a link to confirm your listing. Click it and you'll go live on the
          board — and we'll email you any athletes you match with.
        </p>
        <p className="mt-4 text-sm text-muted2">
          Nothing after a few minutes? Check spam.
        </p>
      </Layout>
    )
  }

  const sending = status.kind === 'sending'

  return (
    <Layout>
      <h1 className="text-2xl font-semibold text-txt">Find your team</h1>
      <p className="mt-2 text-muted leading-relaxed">
        Teams are three. Tell us who you've got and we'll email you when someone
        compatible signs up.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <div>
          <label className={label} htmlFor="contact_name">Your name</label>
          <input id="contact_name" name="contact_name" required className={field} autoComplete="name" />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required className={field} autoComplete="email" />
          </div>
          <div>
            <label className={label} htmlFor="phone">Phone</label>
            <input id="phone" name="phone" type="tel" required className={field} autoComplete="tel" />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="sex_division">Men's or women's</label>
            {/* Placeholder option must not be `disabled` — that bars the select
                from constraint validation, so `required` stops blocking. */}
            <select id="sex_division" name="sex_division" required defaultValue="" className={field}>
              <option value="">Choose…</option>
              <option value="male">Men's</option>
              <option value="female">Women's</option>
            </select>
          </div>
        </div>

        <fieldset>
          <legend className={label}>
            Divisions <span className="text-muted2">(pick any you'd compete in)</span>
          </legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {([
              ['rx', 'Rx'],
              ['scaled', 'Scaled'],
              ['masters', 'Masters'],
            ] as const).map(([value, title]) => {
              const on = divisions.includes(value)
              return (
                <label
                  key={value}
                  className={
                    'cursor-pointer border px-4 py-3 text-center transition ' +
                    (on ? 'border-red bg-panel2' : 'border-line hover:border-muted2')
                  }
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      setDivisions((prev) =>
                        on ? prev.filter((d) => d !== value) : [...prev, value],
                      )
                    }
                    className="sr-only"
                  />
                  <span className="block font-medium text-txt">{title}</span>
                </label>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-muted2">
            Picking more than one means more possible teammates.
          </p>
        </fieldset>

        <fieldset>
          <legend className={label}>I'm signing up as</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              [1, 'Just me', 'Need 2 teammates'],
              [2, 'Me and one teammate', 'Need 1 more'],
            ] as const).map(([value, title, sub]) => (
              <label
                key={value}
                className={
                  'cursor-pointer  border px-4 py-3 transition ' +
                  (size === value
                    ? 'border-red bg-panel2'
                    : 'border-line hover:border-muted2')
                }
              >
                <input
                  type="radio"
                  name="current_size"
                  value={value}
                  checked={size === value}
                  onChange={() => setSize(value)}
                  className="sr-only"
                />
                <span className="block font-medium text-txt">{title}</span>
                <span className="block text-sm text-muted2">{sub}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {size === 2 && (
          <div>
            <label className={label} htmlFor="teammate_names">
              Your teammate's name <span className="text-muted2">(optional)</span>
            </label>
            <input id="teammate_names" name="teammate_names" className={field} />
          </div>
        )}

        <div>
          <label className={label} htmlFor="notes">
            Anything else? <span className="text-muted2">(optional)</span>
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            maxLength={NOTES_MAX}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Gym, experience, what you're looking for…"
            className="field resize-none"
          />
          <p className="mt-1 text-right text-xs text-muted2">
            {notes.length}/{NOTES_MAX}
          </p>
        </div>

        {/* Honeypot. Hidden from humans, irresistible to bots. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="website">Website</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        {status.kind === 'error' && (
          <p className="border border-red/40 bg-red/10 px-3 py-2.5 text-sm text-red">
            {status.message}
          </p>
        )}

        <button
          type="submit"
          disabled={sending}
          className="btn-primary w-full"
        >
          {sending ? 'Sending…' : 'Add me to the board'}
        </button>

        <p className="text-center text-xs text-muted2">
          Your email and phone are only shared with athletes you match with.
        </p>
      </form>
    </Layout>
  )
}

