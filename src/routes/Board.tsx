import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { supabase, type PublicListing } from '../lib/supabase'
import { DIVISION_LABELS, FUNCTIONS_URL, SEX_LABELS, SUPABASE_ANON_KEY } from '../lib/config'
import { getToken } from '../lib/session'

/** Contact details for listings the viewer can actually team up with. */
type Contact = { contact_name: string; email: string; phone: string }

const DIVISIONS = ['rx', 'scaled', 'masters'] as const
const SEXES = ['male', 'female'] as const

type SexFilter = 'all' | 'male' | 'female'
type DivFilter = 'all' | 'rx' | 'scaled' | 'masters'
type SizeFilter = 'all' | 1 | 2

export default function Board() {
  const [listings, setListings] = useState<PublicListing[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sex, setSex] = useState<SexFilter>('all')
  const [div, setDiv] = useState<DivFilter>('all')
  const [size, setSize] = useState<SizeFilter>('all')

  // Contact details for the viewer's own matches, keyed by listing id.
  // Empty for anyone without a listing — the board itself never carries
  // contact info, and the server decides what this map contains.
  const [contacts, setContacts] = useState<Map<string, Contact>>(new Map())
  const [ownId, setOwnId] = useState<string | null>(null)
  const [ownName, setOwnName] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('public_listings')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError('Could not load the board.')
        else setListings(data as PublicListing[])
      })
  }, [])

  useEffect(() => {
    const token = getToken()
    if (!token) return

    fetch(`${FUNCTIONS_URL}/manage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ token, action: 'get' }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!body) return
        if (body.listing?.id) setOwnId(body.listing.id)
        if (body.listing?.contact_name) setOwnName(body.listing.contact_name)
        if (!body.matches) return
        setContacts(
          new Map(
            (body.matches as (Contact & { id: string })[]).map((m) => [
              m.id,
              { contact_name: m.contact_name, email: m.email, phone: m.phone },
            ]),
          ),
        )
      })
      // A stale or revoked token just means no unlocks. Nothing to report.
      .catch(() => {})
  }, [])

  const visible = (listings ?? []).filter(
    (l) =>
      (sex === 'all' || l.sex_division === sex) &&
      (div === 'all' || l.divisions.includes(div)) &&
      (size === 'all' || l.current_size === size),
  )

  return (
    <Layout width="wide">
      <div>
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-txt">Who's looking</h1>
            <p className="mt-2 text-muted">
              Everyone currently searching for teammates.
            </p>
          </div>
          <Link
            to="/"
            className="btn-primary"
          >
            Add my listing
          </Link>
        </header>

        {listings && listings.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
            <Filters
              label="Division"
              value={div}
              onChange={setDiv}
              options={[
                ['all', 'All'],
                ['rx', 'Rx'],
                ['scaled', 'Scaled'],
                ['masters', 'Masters'],
              ]}
            />
            <Filters
              label="Category"
              value={sex}
              onChange={setSex}
              options={[
                ['all', 'All'],
                ['male', "Men's"],
                ['female', "Women's"],
              ]}
            />
            <Filters
              label="Looking for"
              value={size}
              onChange={setSize}
              options={[
                ['all', 'Anyone'],
                [1, 'Solo athletes'],
                [2, 'Pairs'],
              ]}
            />
          </div>
        )}

        {contacts.size > 0 && (
          <p className="mt-6 border border-red/40 bg-red/10 px-4 py-3 text-sm text-muted">
            <strong className="text-txt">
              {contacts.size} {contacts.size === 1 ? 'athlete' : 'athletes'} below
              can complete your team.
            </strong>{' '}
            Their contact details are unlocked on their cards. Everyone else's
            stays private.
          </p>
        )}

        {error && <p className="mt-10 text-red">{error}</p>}
        {!listings && !error && <p className="mt-10 text-muted2">Loading…</p>}

        {listings && listings.length === 0 && (
          <p className="mt-16 text-center text-muted2">
            Nobody on the board yet. Be first.
          </p>
        )}

        {listings && listings.length > 0 && visible.length === 0 && (
          <p className="mt-16 text-center text-muted2">
            Nobody matches those filters yet.
          </p>
        )}

        {listings && visible.length > 0 && (
          <div className="mt-10 space-y-12">
            {SEXES.map((s) =>
              DIVISIONS.map((division) => {
                const bucket = visible.filter(
                  (l) => l.sex_division === s && l.divisions.includes(division),
                )
                if (bucket.length === 0) return null
                return (
                  <section key={`${s}-${division}`}>
                    <h2 className="text-sm font-semibold uppercase tracking-widest text-muted2">
                      {SEX_LABELS[s]} {DIVISION_LABELS[division]}
                      <span className="ml-2 font-normal normal-case tracking-normal text-muted2">
                        {bucket.length} {bucket.length === 1 ? 'listing' : 'listings'}
                      </span>
                    </h2>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {bucket.map((l) => (
                        <Card
                          key={l.id}
                          listing={l}
                          contact={contacts.get(l.id)}
                          isOwn={l.id === ownId}
                          ownName={ownName}
                        />
                      ))}
                    </div>
                  </section>
                )
              }),
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}

function Filters<T extends string | number>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: [T, string][]
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs uppercase tracking-widest text-muted2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map(([v, text]) => (
          <button
            key={String(v)}
            onClick={() => onChange(v)}
            className={
              ' px-3 py-1.5 text-sm transition ' +
              (value === v
                ? 'bg-red font-medium text-white'
                : 'border border-line text-muted hover:border-muted2 hover:text-txt')
            }
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

function Card({
  listing,
  contact,
  isOwn,
  ownName,
}: {
  listing: PublicListing
  contact?: Contact
  isOwn?: boolean
  ownName?: string | null
}) {
  const [asked, setAsked] = useState(false)
  const short = 3 - listing.current_size

  return (
    <article
      className={
        'border p-4 ' +
        (contact
          ? 'border-red/50 bg-panel'
          : isOwn
            ? 'border-muted2/60 bg-panel'
            : 'border-line bg-panel')
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="min-w-0 break-words font-semibold text-txt">
          {/* `??` does not fall through on `false`, so this must be a ternary:
              isOwn is false (not undefined) for other people's cards. */}
          {contact?.contact_name ?? (isOwn && ownName ? ownName : listing.first_name)}
        </h3>
        <span className="shrink-0 text-xs uppercase tracking-wide text-muted2">
          {isOwn && <span className="text-muted">You · </span>}
          {listing.current_size === 1 ? 'Solo' : 'Pair'}
        </span>
      </div>

      <p className="mt-1 text-sm text-muted">
        Needs {short} more {short === 1 ? 'athlete' : 'athletes'}
      </p>

      {listing.divisions.length > 1 && (
        <p className="mt-1 text-xs text-muted2">
          Open to {listing.divisions.map((d) => DIVISION_LABELS[d]).join(', ')}
        </p>
      )}

      {listing.notes && (
        <p className="mt-3 text-sm leading-relaxed text-muted">{listing.notes}</p>
      )}

      {contact ? (
        <div className="mt-4 border-t border-line pt-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-red">
            You match
          </p>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="w-12 shrink-0 text-muted2">Email</dt>
              <dd className="min-w-0 break-all">
                <a
                  href={`mailto:${contact.email}`}
                  className="text-txt underline underline-offset-4"
                >
                  {contact.email}
                </a>
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-12 shrink-0 text-muted2">Phone</dt>
              <dd>
                <a
                  href={`tel:${contact.phone}`}
                  className="text-txt underline underline-offset-4"
                >
                  {contact.phone}
                </a>
              </dd>
            </div>
          </dl>
        </div>
      ) : isOwn ? (
        <div className="mt-4 border-t border-line pt-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted2">
            This is you
          </p>
          <Link
            to={`/manage/${getToken() ?? ''}`}
            className="mt-1.5 inline-block text-sm text-muted underline underline-offset-4 hover:text-txt"
          >
            Manage my listing
          </Link>
        </div>
      ) : asked ? (
        <p className="mt-4 bg-panel2 px-3 py-2.5 text-sm leading-relaxed text-muted">
          Add your own listing and we'll email you both with contact details
          automatically. We don't hand out anyone's email or phone.
        </p>
      ) : (
        <button
          onClick={() => setAsked(true)}
          className="mt-4 text-sm font-medium text-muted underline underline-offset-4 hover:text-txt"
        >
          Contact this athlete
        </button>
      )}
    </article>
  )
}
