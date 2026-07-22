const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'onboarding@resend.dev'

/** Resend free tier: 100/day. Leave headroom for the sends that actually matter. */
export const DAILY_CAP = 100
export const OPTIONAL_SEND_CEILING = 85

export type EmailKind = 'confirm' | 'matches' | 'new_in_bracket' | 'closed'

export type SendResult = { ok: true } | { ok: false; error: string }

export async function sendEmail(
  to: string,
  subject: string,
  text: string,
): Promise<SendResult> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, text }),
    })

    if (!res.ok) {
      const body = await res.text()
      return { ok: false, error: `resend ${res.status}: ${body.slice(0, 300)}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 300) }
  }
}
