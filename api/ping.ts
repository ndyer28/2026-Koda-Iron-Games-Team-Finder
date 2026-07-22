// Vercel Cron target. Supabase pauses free-tier projects after 7 days with no
// API traffic; a paused project means every athlete sees a broken form. One
// trivial query a day keeps it awake.

export const config = { runtime: 'edge' }

export default async function handler(): Promise<Response> {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    return new Response(JSON.stringify({ ok: false, error: 'not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // HEAD + count is the cheapest possible read that still touches Postgres.
  const res = await fetch(`${url}/rest/v1/listings?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact' },
  })

  return new Response(
    JSON.stringify({ ok: res.ok, status: res.status, at: new Date().toISOString() }),
    { status: res.ok ? 200 : 502, headers: { 'Content-Type': 'application/json' } },
  )
}
