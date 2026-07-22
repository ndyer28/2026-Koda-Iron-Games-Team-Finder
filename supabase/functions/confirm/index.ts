// POST /functions/v1/confirm  { token }
//
// Activates a listing, then runs the match query and fans out notifications.
//
// Notification priority, because Resend's free tier caps at 100/day:
//   1. matches email to the person confirming  — always sent
//   2. new_in_bracket to everyone already there — shed first when near the cap
// Losing (2) is recoverable: those athletes still appear in the confirmer's
// matches email, so the connection can still happen. Losing (1) would mean the
// person who just confirmed hears nothing at all.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { OPTIONAL_SEND_CEILING, sendEmail } from '../_shared/email.ts'
import {
  type Listing,
  matchesEmail,
  newInBracketEmail,
} from '../_shared/templates.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

/** Don't re-notify anyone who heard from us within this window. */
const QUIET_HOURS = 6

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  let token: string
  try {
    token = String(((await req.json()) as Record<string, unknown>).token ?? '')
  } catch {
    return json({ error: 'Malformed request.' }, 400)
  }
  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    return json({ error: 'That confirmation link is not valid.' }, 400)
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const { data: listing, error: findErr } = await db
    .from('listings')
    .select('*')
    .eq('confirm_token', token)
    .maybeSingle<Listing & { status: string }>()

  if (findErr) {
    console.error('lookup failed', findErr)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
  if (!listing) {
    return json({ error: 'That confirmation link is not valid.' }, 404)
  }

  // Already-confirmed is a success, not an error — people re-click links.
  if (listing.status === 'active') {
    return json({ ok: true, already: true, manage_token: listing.manage_token })
  }
  if (listing.status === 'matched' || listing.status === 'closed') {
    return json({ error: 'That listing has already been closed.' }, 410)
  }

  const { error: activateErr } = await db
    .from('listings')
    .update({ status: 'active', confirmed_at: new Date().toISOString() })
    .eq('id', listing.id)

  if (activateErr) {
    console.error('activate failed', activateErr)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }

  const active: Listing = { ...listing, status: 'active' } as Listing

  const { data: matches, error: matchErr } = await db.rpc('find_matches', {
    p_listing_id: listing.id,
  })
  if (matchErr) console.error('find_matches failed', matchErr)

  const found = (matches ?? []) as Listing[]

  // --- 1. Always tell the confirmer what they've got -----------------------
  const mine = matchesEmail(active, found)
  const mineResult = await sendEmail(active.email, mine.subject, mine.text)
  await logEmail(db, active.id, 'matches', mineResult)

  const notified: string[] = [active.id]

  // --- 2. Tell the bracket, budget permitting ------------------------------
  const { data: sentToday } = await db.rpc('emails_sent_today')
  let budget = Math.max(0, OPTIONAL_SEND_CEILING - Number(sentToday ?? 0))
  let deferred = 0

  const cutoff = new Date(Date.now() - QUIET_HOURS * 3600_000).toISOString()

  for (const m of found) {
    // Recently emailed? They'll catch this listing in the next digest.
    if (m.last_notified_at && m.last_notified_at > cutoff) {
      deferred++
      continue
    }
    if (budget <= 0) {
      deferred++
      continue
    }

    const mail = newInBracketEmail(m, active)
    const result = await sendEmail(m.email, mail.subject, mail.text)
    await logEmail(db, m.id, 'new_in_bracket', result)
    if (result.ok) {
      notified.push(m.id)
      budget--
    }
  }

  if (notified.length > 0) {
    await db
      .from('listings')
      .update({ last_notified_at: new Date().toISOString() })
      .in('id', notified)
  }

  if (deferred > 0) {
    console.log(`deferred ${deferred} bracket notifications (budget ${budget})`)
  }

  return json({
    ok: true,
    matches: found.length,
    notified: notified.length - 1,
    deferred,
    manage_token: active.manage_token,
  })
})

type Db = ReturnType<typeof createClient>

async function logEmail(
  db: Db,
  listing_id: string,
  kind: string,
  result: { ok: boolean; error?: string },
) {
  await db.from('email_log').insert({
    listing_id,
    kind,
    ok: result.ok,
    error: result.ok ? null : result.error,
  })
  if (!result.ok) console.error(`email ${kind} failed`, result.error)
}
