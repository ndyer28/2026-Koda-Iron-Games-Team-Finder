// POST /functions/v1/admin  { password, action, ... }
//
// Single shared password, checked here — never in the browser. The client only
// ever holds the password the operator typed; it is re-sent and re-verified on
// every call, so there is no session to steal or forge.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ADMIN_PASSWORD = Deno.env.get('ADMIN_PASSWORD') ?? ''

/**
 * Constant-time comparison. A plain `===` leaks the length of the matching
 * prefix through timing, which is enough to guess a password character by
 * character given enough requests.
 */
function safeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a)
  const bb = new TextEncoder().encode(b)
  if (ab.length !== bb.length) return false
  let diff = 0
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i]
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  if (!ADMIN_PASSWORD) {
    console.error('ADMIN_PASSWORD is not set')
    return json({ error: 'Admin is not configured.' }, 500)
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return json({ error: 'Malformed request.' }, 400)
  }

  if (!safeEqual(String(body.password ?? ''), ADMIN_PASSWORD)) {
    // Uniform delay so a wrong password can't be distinguished by response time.
    await new Promise((r) => setTimeout(r, 400))
    return json({ error: 'Wrong password.' }, 401)
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const action = String(body.action ?? 'list')

  if (action === 'list') {
    const { data, error } = await db
      .from('listings')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('list failed', error)
      return json({ error: 'Could not load listings.' }, 500)
    }
    return json({ ok: true, listings: data })
  }

  if (action === 'update') {
    const id = String(body.id ?? '')
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Bad listing id.' }, 400)

    // Only these columns are editable. Tokens, timestamps and event_id are
    // deliberately not: rewriting a token would silently break the athlete's
    // existing links, and there is no reason to hand-edit the rest.
    const patch: Record<string, unknown> = {}
    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

    if ('contact_name' in body) {
      const v = str(body.contact_name)
      if (v.length < 2 || v.length > 100) return json({ error: 'Name looks wrong.' }, 400)
      patch.contact_name = v
    }
    if ('email' in body) {
      const v = str(body.email).toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return json({ error: 'Email looks wrong.' }, 400)
      patch.email = v
    }
    if ('phone' in body) {
      const v = str(body.phone)
      if (v.replace(/\D/g, '').length < 7) return json({ error: 'Phone looks wrong.' }, 400)
      patch.phone = v
    }
    if ('division' in body) {
      const v = str(body.division)
      if (!['rx', 'scaled', 'masters'].includes(v)) return json({ error: 'Bad division.' }, 400)
      patch.division = v
    }
    if ('sex_division' in body) {
      const v = str(body.sex_division)
      if (!['male', 'female'].includes(v)) return json({ error: 'Bad category.' }, 400)
      patch.sex_division = v
    }
    if ('current_size' in body) {
      const v = Number(body.current_size)
      if (v !== 1 && v !== 2) return json({ error: 'Size must be 1 or 2.' }, 400)
      patch.current_size = v
    }
    if ('teammate_names' in body) patch.teammate_names = str(body.teammate_names) || null
    if ('notes' in body) patch.notes = str(body.notes).slice(0, 300) || null

    if (Object.keys(patch).length === 0) return json({ error: 'Nothing to update.' }, 400)

    const { error } = await db.from('listings').update(patch).eq('id', id)
    if (error) {
      console.error('update failed', error)
      return json({ error: 'Could not save that listing.' }, 500)
    }
    return json({ ok: true })
  }

  if (action === 'delete') {
    const id = String(body.id ?? '')
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Bad listing id.' }, 400)

    // Hard delete. `closed` is the reversible option and is what the athlete's
    // own "Remove my listing" button does; this is for genuine removal
    // (duplicates, spam, someone asking to be erased).
    const { data: existing } = await db
      .from('listings')
      .select('contact_name')
      .eq('id', id)
      .maybeSingle()

    if (!existing) return json({ error: 'That listing no longer exists.' }, 404)

    const { error } = await db.from('listings').delete().eq('id', id)
    if (error) {
      console.error('delete failed', error)
      return json({ error: 'Could not delete that listing.' }, 500)
    }
    console.log('admin deleted listing', id, existing.contact_name)
    return json({ ok: true, deleted: existing.contact_name })
  }

  if (action === 'set_status') {
    const id = String(body.id ?? '')
    const status = String(body.status ?? '')
    if (!['pending', 'active', 'matched', 'closed'].includes(status)) {
      return json({ error: 'Unknown status.' }, 400)
    }

    const patch: Record<string, unknown> = { status }
    // Activating from the admin panel should behave like a real confirmation,
    // otherwise the listing is active with no confirmed_at and looks corrupt.
    if (status === 'active') patch.confirmed_at = new Date().toISOString()

    const { error } = await db.from('listings').update(patch).eq('id', id)
    if (error) {
      console.error('set_status failed', error)
      return json({ error: 'Could not update that listing.' }, 500)
    }
    return json({ ok: true })
  }

  return json({ error: 'Unknown action.' }, 400)
})
