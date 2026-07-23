# Teammate Finder

Matches solo athletes and incomplete pairs into three-person teams for a
CrossFit competition. No accounts, no login — identity is handled entirely by
emailed links.

Built for the 2026 Koda Iron Games. Standalone: shares no code, database, or
config with any other project.

---

## The one idea

There are no "athlete" and "team" tables. There is **one entity: a listing**,
which is a roster fragment with a size.

| Signs up as | `current_size` | Needs |
| --- | --- | --- |
| Solo athlete | 1 | 2 more |
| Pair | 2 | 1 more |

Two listings match when **all** of these hold:

1. their `divisions` **overlap** (Postgres `&&`)
2. same `sex_division`
3. both `status = 'active'`
4. `a.current_size + b.current_size <= 3`

`divisions` is an array because athletes are often willing to compete in more
than one ("I'll do Rx or Scaled"). Forcing a single choice hid real matches.
A listing appears in every division bucket it's open to, so someone browsing
Scaled sees everyone who would take a Scaled spot.

Rule 4 is the whole trick. Solo+solo (2) and solo+pair (3) pass; pair+pair (4)
fails. No special-casing, no separate code path for "is this a pair".

It lives in exactly one place — the `find_matches()` Postgres function. Call
it; never re-derive it inline.

---

## Stack

Vite · React · TypeScript · Tailwind v4 · Supabase (Postgres + RLS + Edge
Functions) · Resend · Vercel

---

## Security model

**Email addresses and phone numbers are never reachable from the browser.**
That's the hardest requirement in the project and everything else bends around
it.

- `listings` has RLS on and **no** anon policies at all. The browser cannot
  select, insert, update, or delete it.
- The browser reads only `public_listings` — a view exposing `first_name`
  (derived), division, sex division, size, notes. No email, no phone, no
  surname, no tokens.
- Every read of contact details happens in an Edge Function using the service
  role key, which lives only in Supabase's secret store.
- Even `/manage` never returns email or phone to the browser. The owner already
  knows their own details; echoing them back would turn a forwarded link into a
  contact-info leak.

Verify it yourself — this should return `401 permission denied`:

```bash
curl -X POST "$VITE_SUPABASE_URL/rest/v1/listings" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contact_name":"x","email":"x@x.com","phone":"1","division":"rx","sex_division":"male","current_size":1}'
```

---

## Setup from scratch

### 1. Supabase

Create a project, then run the migrations in `supabase/migrations/` **in
filename order** via the SQL Editor, or:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Verify with `supabase/tests/match_rule_test.sql` — it returns a PASS/FAIL
table. Every row must say PASS. Row 1 is the pair+pair exclusion.
`supabase/tests/rls_test.sql` proves anon cannot reach contact details.

Both test files create fixtures; run the teardown at the bottom afterwards.

### 2. Resend

Add and verify your sending domain. **Do not skip this** — the fallback sender
`onboarding@resend.dev` only delivers to the address that owns the Resend
account. Every other athlete silently receives nothing.

Verification needs three DNS records, and the domain is not ready until *all*
of them pass — a green tick on the DKIM row alone is not enough:

| Type | Host | Purpose |
| --- | --- | --- |
| TXT | `resend._domainkey` | DKIM — proves you own the domain |
| MX | `send` | SPF — **authorises sending** |
| TXT | `send` | SPF — **authorises sending** |

Watch the **domain** status, not the per-record badges. Sends fail with a
generic Resend error while it still says Pending.

For this deployment: `kodacrossfitironview.com`, registered at Namecheap,
verified 22 July 2026. Namecheap appends the domain to the host automatically,
so the host field is `send`, not `send.kodacrossfitironview.com`.

Free tier is 3,000/month but **100/day**. Bracket notifications scale with
bracket size, so a signup rush can hit the daily cap. See "Email budget" below.

### 3. Secrets

Edge Function secrets (`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are
injected automatically — do not set them):

```bash
supabase secrets set \
  RESEND_API_KEY=re_xxx \
  FROM_EMAIL=teams@yourdomain.com \
  ADMIN_PASSWORD=something-long \
  EVENT_ID=iron-games-2026 \
  PUBLIC_BASE_URL=https://your-deployment-url
```

`PUBLIC_BASE_URL` builds the confirm and manage links inside emails. Point it
at localhost during development and at the real domain in production, or people
will receive links to a site that doesn't exist.

### 4. Local dev

```bash
cp .env.example .env.local   # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

### 5. Deploy

```bash
npm run deploy:functions     # Edge Functions — always use this, never the bare CLI
```

`scripts/deploy-functions.sh` pins `--project-ref`. The bare
`supabase functions deploy` falls back to an interactive project picker when
the link is missing, which once deployed this project's function into an
unrelated Supabase project.

Front end deploys to Vercel from the repo. Set `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (for `/api/ping`) in
Vercel's env vars.

---

## Email budget

Resend's free tier caps at 100/day. A confirmation fans out to everyone already
in that bracket, so volume grows with the square of bracket size. Two
mitigations:

- **6-hour quiet window** — nobody is notified twice within 6 hours.
- **Priority shedding** — past 85 sends in 24h, "new athlete in your bracket"
  emails stop. The confirmer's own matches email is *never* shed.

Losing a bracket notification is recoverable: that athlete still appears in the
confirmer's matches email, so the connection can happen from the other side.
Losing a matches email would mean someone confirms and hears nothing.

Watch it with:

```sql
select kind, ok, count(*) from email_log
where sent_at > now() - interval '24 hours'
group by kind, ok;
```

If deferral counts climb, build the real batched digest or move to Resend Pro
($20/mo, no daily cap).

---

## Routes

| Route | What |
| --- | --- |
| `/` | Submit form. Honeypot + 3/hour/IP rate limit. |
| `/confirm/:confirm_token` | Activates the listing, sends matches, notifies the bracket. |
| `/board` | Public board. Filter by division, category, solo/pairs. |
| `/manage/:manage_token` | "We found our team" / "Remove my listing". |
| `/admin` | Shared password. Full table, status editing, CSV export. |

## Edge Functions

| Function | Notes |
| --- | --- |
| `submit` | Only write path for new listings. Honeypot returns `200 {ok:true}` so bots get no signal. |
| `confirm` | Idempotent — re-clicking a confirm link succeeds rather than erroring. |
| `manage` | Never returns email or phone. |
| `admin` | Constant-time password comparison; password held in memory only, never localStorage. |

---

## Keep-alive

Supabase pauses free projects after 7 days without API traffic. `vercel.json`
runs `/api/ping` daily at 12:00 UTC.

---

## Gotchas

- **Rate limit is per IP, 3/hour.** You will trip it while testing. Clear it
  with `delete from submission_attempts;`
- **`onboarding@resend.dev` only mails the Resend account owner.** Everything
  looks like it works; nothing arrives. Verify the domain before showing anyone.
- **Edge Functions read secrets at module load.** After `supabase secrets set`,
  redeploy (`npm run deploy:functions`) or running instances keep the old value.
- **A failed confirmation email returns an error** rather than "check your
  email", so nobody waits on mail that will never come. Failed sends land in
  `email_log` with the reason.
- **`<option value="" disabled>` bars a `<select>` from constraint validation**,
  silently breaking `required`. The placeholder options here are deliberately
  not disabled.
