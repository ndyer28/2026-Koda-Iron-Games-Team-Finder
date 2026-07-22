import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { supabase, type PublicListing } from '../lib/supabase'
import { DIVISION_LABELS, SEX_LABELS } from '../lib/config'

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

  const visible = (listings ?? []).filter(
    (l) =>
      (sex === 'all' || l.sex_division === sex) &&
      (div === 'all' || l.division === div) &&
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
                  (l) => l.sex_division === s && l.division === division,
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
                        <Card key={l.id} listing={l} />
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

function Card({ listing }: { listing: PublicListing }) {
  const [asked, setAsked] = useState(false)
  const short = 3 - listing.current_size

  return (
    <article className="border border-line bg-panel p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold text-txt">{listing.first_name}</h3>
        <span className="shrink-0 text-xs uppercase tracking-wide text-muted2">
          {listing.current_size === 1 ? 'Solo' : 'Pair'}
        </span>
      </div>

      <p className="mt-1 text-sm text-muted">
        Needs {short} more {short === 1 ? 'athlete' : 'athletes'}
      </p>

      {listing.notes && (
        <p className="mt-3 text-sm leading-relaxed text-muted">{listing.notes}</p>
      )}

      {asked ? (
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
