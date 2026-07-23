export const DIVISIONS = ['rx', 'scaled', 'masters'] as const
export const SEX_DIVISIONS = ['male', 'female'] as const

export type Division = (typeof DIVISIONS)[number]
export type SexDivision = (typeof SEX_DIVISIONS)[number]

export type SubmitPayload = {
  contact_name: string
  email: string
  phone: string
  divisions: Division[]
  sex_division: SexDivision
  current_size: 1 | 2
  teammate_names: string | null
  notes: string | null
}

export const NOTES_MAX = 300

/** Deliberately loose. Real validation is the confirmation email arriving. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * Returns a clean payload, or an error message safe to show the user.
 * Never trusts anything from the client — this runs server-side.
 */
export function parseSubmission(
  raw: unknown,
): { ok: true; value: SubmitPayload } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Malformed request.' }
  }
  const b = raw as Record<string, unknown>

  const contact_name = str(b.contact_name)
  if (contact_name.length < 2 || contact_name.length > 100) {
    return { ok: false, error: 'Please enter your name.' }
  }

  const email = str(b.email).toLowerCase()
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { ok: false, error: 'Please enter a valid email address.' }
  }

  const phone = str(b.phone)
  if (phone.replace(/\D/g, '').length < 7 || phone.length > 30) {
    return { ok: false, error: 'Please enter a valid phone number.' }
  }

  const rawDivisions = Array.isArray(b.divisions) ? b.divisions : []
  const divisions = [...new Set(rawDivisions.map(str))].filter((d): d is Division =>
    DIVISIONS.includes(d as Division),
  )
  if (divisions.length === 0) {
    return { ok: false, error: 'Please choose at least one division.' }
  }

  const sex_division = str(b.sex_division) as SexDivision
  if (!SEX_DIVISIONS.includes(sex_division)) {
    return { ok: false, error: 'Please choose a division.' }
  }

  const current_size = Number(b.current_size)
  if (current_size !== 1 && current_size !== 2) {
    return { ok: false, error: 'Please choose how many of you there are.' }
  }

  const teammate_names = str(b.teammate_names).slice(0, 200) || null
  const notes = str(b.notes).slice(0, NOTES_MAX) || null

  return {
    ok: true,
    value: {
      contact_name,
      email,
      phone,
      divisions,
      sex_division,
      current_size,
      teammate_names,
      notes,
    },
  }
}
