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
    // id so /board can mark the viewer's own card rather than showing them
    // the generic "add your own listing" prompt on a listing they already own.
    id: listing.id,
    first_name: listing.contact_name.trim().split(' ')[0],
    bracket: bracketLabel(listing),
    current_size: listing.current_size,
    notes: listing.notes,
    status: listing.status,
  }

  if (action === 'get') {
    // Contact details of the people this listing matches with. The manage
    // token is the authorisation — the same information already goes to this
    // address by email, so showing it in the app leaks nothing new. Note this
    // returns OTHER people's details, never the holder's own.
    let matches: unknown[] = []
    if (listing.status === 'active') {
      const { data, error: matchErr } = await db.rpc('find_matches', {
        p_listing_id: listing.id,
      })
      if (matchErr) console.error('find_matches failed', matchErr)
      matches = ((data ?? []) as Listing[]).map((m) => ({
        // id lets /board correlate these against public_listings so it can
        // unlock contact details on exactly the cards you match with.
        id: m.id,
        first_name: m.contact_name.trim().split(' ')[0],
        contact_name: m.contact_name,
        email: m.email,
        phone: m.phone,
        teammate_names: m.teammate_names,
        current_size: m.current_size,
        bracket: bracketLabel(m),
        notes: m.notes,
      }))
    }
    return json({ ok: true, listing: safe, matches })
  }

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
