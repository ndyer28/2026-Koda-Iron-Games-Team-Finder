// POST /functions/v1/submit
//
// The only write path for new listings. Rate limiting and (in step 3) the
// confirmation email both live here, which is why the browser must not insert
// into `listings` directly.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { clientIp, corsHeaders, hashIp, json } from '../_shared/cors.ts'
import { parseSubmission } from '../_shared/validate.ts'
import { sendEmail } from '../_shared/email.ts'
import {
  bracketLabel,
  confirmEmail,
  recoveryEmail,
  type Listing,
} from '../_shared/templates.ts'

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

  // Already listed? Send their existing link instead of creating a second
  // listing. Duplicates split one athlete across multiple board cards and make
  // every match list them twice.
  const { data: existing } = await supabase.rpc('listings_for_email', {
    p_email: parsed.value.email,
    p_event_id: EVENT_ID,
  })

  const dupes = (existing ?? []) as {
    id: string
    manage_token: string
    current_size: number
    division: string
    sex_division: string
  }[]

  if (dupes.length > 0) {
    const mail = recoveryEmail(
      dupes.map((l) => ({
        manage_token: l.manage_token,
        bracket: bracketLabel(l),
        current_size: l.current_size,
      })),
      true,
    )
    const sent = await sendEmail(parsed.value.email, mail.subject, mail.text)
    await supabase.from('email_log').insert({
      listing_id: dupes[0].id,
      kind: 'recovery',
      ok: sent.ok,
      error: sent.ok ? null : sent.error,
    })
    return json({ ok: true, duplicate: true })
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
    console.error('confirm email failed', sent.error)

    // The listing can never be activated — its only confirm link was in an
    // email that never arrived. Leaving it behind accumulates dead `pending`
    // rows that nothing will ever clean up.
    await supabase.from('listings').delete().eq('id', data.id)

    // Resend's sandbox sender rejects every recipient except the account
    // owner. That's a setup problem, not a typo, and saying "check the
    // address" sends people hunting for a mistake they didn't make.
    const sandboxed =
      sent.error.includes('You can only send testing emails') ||
      sent.error.includes('verify a domain')

    return json(
      {
        error: sandboxed
          ? 'Email sending is still in test mode, so we can only reach the organiser’s address right now. Please try again later.'
          : "We couldn't send your confirmation email. Check the address and try again.",
      },
      502,
    )
  }

  return json({ ok: true })
})
