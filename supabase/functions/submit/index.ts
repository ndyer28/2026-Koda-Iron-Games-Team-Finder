// POST /functions/v1/submit
//
// The only write path for new listings. Rate limiting and (in step 3) the
// confirmation email both live here, which is why the browser must not insert
// into `listings` directly.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { clientIp, corsHeaders, hashIp, json } from '../_shared/cors.ts'
import { parseSubmission } from '../_shared/validate.ts'
import { sendEmail } from '../_shared/email.ts'
import { confirmEmail, type Listing } from '../_shared/templates.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const EVENT_ID = Deno.env.get('EVENT_ID') ?? 'iron-games-2026'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Malformed request.' }, 400)
  }

  // Honeypot. A real browser leaves this empty because it is hidden.
  // Respond exactly like a success so bots get no signal to adapt to.
  const trap = (body as Record<string, unknown>)?.website
  if (typeof trap === 'string' && trap.trim() !== '') {
    return json({ ok: true })
  }

  const parsed = parseSubmission(body)
  if (!parsed.ok) {
    return json({ error: parsed.error }, 400)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const ip_hash = await hashIp(clientIp(req), SERVICE_ROLE_KEY)
  const { data: allowed, error: rlError } = await supabase.rpc(
    'check_and_record_rate_limit',
    { p_ip_hash: ip_hash },
  )

  if (rlError) {
    console.error('rate limit check failed', rlError)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
  if (!allowed) {
    return json(
      { error: "That's a few too many sign-ups from here. Try again in an hour." },
      429,
    )
  }

  const { data, error } = await supabase
    .from('listings')
    .insert({ ...parsed.value, event_id: EVENT_ID, status: 'pending' })
    .select('*')
    .single()

  if (error) {
    console.error('insert failed', error)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }

  const mail = confirmEmail(data as Listing)
  const sent = await sendEmail(data.email, mail.subject, mail.text)

  await supabase.from('email_log').insert({
    listing_id: data.id,
    kind: 'confirm',
    ok: sent.ok,
    error: sent.ok ? null : sent.error,
  })

  if (!sent.ok) {
    // The row exists but the athlete has no way to activate it. Tell them
    // rather than showing a "check your email" screen that will never pay off.
    console.error('confirm email failed', sent.error)
    return json(
      { error: "We couldn't send your confirmation email. Check the address and try again." },
      502,
    )
  }

  return json({ ok: true })
})
