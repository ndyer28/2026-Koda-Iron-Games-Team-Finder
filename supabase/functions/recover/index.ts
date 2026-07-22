// POST /functions/v1/recover  { email }
//
// "I lost my link." Emails the manage link for any listing on that address.
//
// This endpoint could otherwise be used to test whether a given person signed
// up, so the response is IDENTICAL in every case — found, not found, rate
// limited, or send failure. The only channel that carries real information is
// the inbox of whoever owns the address.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { clientIp, corsHeaders, hashIp, json } from '../_shared/cors.ts'
import { sendEmail } from '../_shared/email.ts'
import { bracketLabel, recoveryEmail } from '../_shared/templates.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const EVENT_ID = Deno.env.get('EVENT_ID') ?? 'iron-games-2026'

/** Same shape whatever happened. Never vary this. */
const UNIFORM = {
  ok: true,
  message: "If that address has a listing, we've emailed the link.",
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  let email = ''
  try {
    email = String(((await req.json()) as Record<string, unknown>).email ?? '')
      .trim()
      .toLowerCase()
  } catch {
    return json({ error: 'Malformed request.' }, 400)
  }

  // Only obviously-malformed input gets a distinct response, and that reveals
  // nothing — it's decidable from the string alone.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return json({ error: 'Please enter a valid email address.' }, 400)
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  // Rate limited under its own namespace so recovery attempts don't eat the
  // signup budget (and vice versa).
  const ip_hash = await hashIp(`recover:${clientIp(req)}`, SERVICE_ROLE_KEY)
  const { data: allowed } = await db.rpc('check_and_record_rate_limit', {
    p_ip_hash: ip_hash,
    p_max: 5,
  })
  if (!allowed) return json(UNIFORM)

  const { data: rows, error } = await db.rpc('listings_for_email', {
    p_email: email,
    p_event_id: EVENT_ID,
  })

  if (error) {
    console.error('recover lookup failed', error)
    return json(UNIFORM)
  }

  const listings = (rows ?? []) as {
    id: string
    manage_token: string
    status: string
    current_size: number
    division: string
    sex_division: string
  }[]

  if (listings.length === 0) return json(UNIFORM)

  const mail = recoveryEmail(
    listings.map((l) => ({
      manage_token: l.manage_token,
      bracket: bracketLabel(l),
      current_size: l.current_size,
    })),
    false,
  )

  const sent = await sendEmail(email, mail.subject, mail.text)
  await db.from('email_log').insert({
    listing_id: listings[0].id,
    kind: 'recovery',
    ok: sent.ok,
    error: sent.ok ? null : sent.error,
  })

  return json(UNIFORM)
})
