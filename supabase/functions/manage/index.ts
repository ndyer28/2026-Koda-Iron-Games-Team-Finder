// POST /functions/v1/manage  { token, action: 'get' | 'matched' | 'closed' }
//
// The manage_token is the only credential — no accounts, no login. It's a v4
// UUID and never appears on the public board, so it isn't guessable or
// discoverable. Anyone holding it is by definition the person we emailed.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { sendEmail } from '../_shared/email.ts'
import { bracketLabel, closedEmail, type Listing } from '../_shared/templates.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  let token = ''
  let action = ''
  try {
    const b = (await req.json()) as Record<string, unknown>
    token = String(b.token ?? '')
    action = String(b.action ?? 'get')
  } catch {
    return json({ error: 'Malformed request.' }, 400)
  }

  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    return json({ error: 'That link is not valid.' }, 400)
  }
  if (!['get', 'matched', 'closed'].includes(action)) {
    return json({ error: 'Unknown action.' }, 400)
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const { data: listing, error } = await db
    .from('listings')
    .select('*')
    .eq('manage_token', token)
    .maybeSingle<Listing>()

  if (error) {
    console.error('lookup failed', error)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
  if (!listing) return json({ error: 'That link is not valid.' }, 404)

  // Never return email/phone to the browser — even to the listing's owner.
  // They already know their own details; echoing them back only creates a
  // way for a leaked manage link to expose contact info.
  const safe = {
    first_name: listing.contact_name.trim().split(' ')[0],
    bracket: bracketLabel(listing),
    current_size: listing.current_size,
    notes: listing.notes,
    status: listing.status,
  }

  if (action === 'get') return json({ ok: true, listing: safe })

  if (listing.status === 'matched' || listing.status === 'closed') {
    return json({ ok: true, listing: safe, already: true })
  }

  const { error: updateErr } = await db
    .from('listings')
    .update({ status: action })
    .eq('id', listing.id)

  if (updateErr) {
    console.error('update failed', updateErr)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }

  const mail = closedEmail(listing, action as 'matched' | 'closed')
  const sent = await sendEmail(listing.email, mail.subject, mail.text)
  await db.from('email_log').insert({
    listing_id: listing.id,
    kind: 'closed',
    ok: sent.ok,
    error: sent.ok ? null : sent.error,
  })

  return json({ ok: true, listing: { ...safe, status: action } })
})
