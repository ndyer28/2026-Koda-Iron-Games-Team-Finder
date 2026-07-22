// Plain-text emails. Short, readable, contact details in a labeled block.
// Every one carries the manage link in the footer — stale listings are what
// kill a board like this.

const BASE = (Deno.env.get('PUBLIC_BASE_URL') ?? 'http://localhost:5175').replace(/\/$/, '')

export type Listing = {
  id: string
  contact_name: string
  email: string
  phone: string
  division: string
  sex_division: string
  current_size: number
  notes: string | null
  teammate_names: string | null
  manage_token: string
  confirm_token: string
  status: string
  last_notified_at: string | null
}

const DIVISION: Record<string, string> = {
  rx: 'Rx',
  scaled: 'Scaled',
  masters: 'Masters',
}
const SEX: Record<string, string> = { male: "Men's", female: "Women's" }

export function bracketLabel(l: Pick<Listing, 'division' | 'sex_division'>): string {
  return `${SEX[l.sex_division] ?? l.sex_division} ${DIVISION[l.division] ?? l.division}`
}

export function needsLabel(current_size: number): string {
  const short = 3 - current_size
  return short === 1 ? 'needs 1 more' : `needs ${short} more`
}

function footer(manage_token: string): string {
  return [
    '',
    '---',
    'Found your team, or changed your mind?',
    `${BASE}/manage/${manage_token}`,
    '',
    "Take 5 seconds to close your listing when you're sorted — it keeps the",
    'board honest for everyone else.',
  ].join('\n')
}

function contactBlock(l: Listing): string {
  const lines = [
    `  Name:     ${l.contact_name}`,
    `  Bracket:  ${bracketLabel(l)}`,
    `  Roster:   ${l.current_size === 1 ? 'Solo athlete' : 'Pair'} — ${needsLabel(l.current_size)}`,
  ]
  if (l.teammate_names) lines.push(`  With:     ${l.teammate_names}`)
  lines.push(`  Email:    ${l.email}`)
  lines.push(`  Phone:    ${l.phone}`)
  if (l.notes) lines.push(`  Notes:    ${l.notes}`)
  return lines.join('\n')
}

// 1 -------------------------------------------------------------------------
export function confirmEmail(l: Listing) {
  return {
    subject: 'Confirm your teammate listing',
    text: [
      `Hi ${firstName(l.contact_name)},`,
      '',
      'One click and you\'re on the board:',
      '',
      `${BASE}/confirm/${l.confirm_token}`,
      '',
      `You signed up in ${bracketLabel(l)} as ${l.current_size === 1 ? 'a solo athlete' : 'a pair'}, ${needsLabel(l.current_size)}.`,
      '',
      "Once you confirm, we'll send you everyone you match with and email you",
      'whenever someone new signs up in your bracket.',
      '',
      "Didn't sign up? Ignore this and nothing happens.",
    ].join('\n'),
  }
}

// 2 -------------------------------------------------------------------------
export function matchesEmail(l: Listing, matches: Listing[]) {
  if (matches.length === 0) {
    return {
      subject: "You're on the board",
      text: [
        `Hi ${firstName(l.contact_name)},`,
        '',
        `You're live in ${bracketLabel(l)}.`,
        '',
        "Nobody compatible has signed up yet — but the moment someone does,",
        "you'll get their contact details by email. Nothing more to do.",
        footer(l.manage_token),
      ].join('\n'),
    }
  }

  const plural = matches.length === 1 ? 'athlete' : 'athletes'
  return {
    subject: `${matches.length} ${plural} you can team up with`,
    text: [
      `Hi ${firstName(l.contact_name)},`,
      '',
      `You're live in ${bracketLabel(l)}. Here's everyone you can currently`,
      'make a team of three with:',
      '',
      matches.map(contactBlock).join('\n\n'),
      '',
      'Reach out directly — first to connect wins. They have your details too.',
      footer(l.manage_token),
    ].join('\n'),
  }
}

// 3 -------------------------------------------------------------------------
export function newInBracketEmail(recipient: Listing, arrival: Listing) {
  return {
    subject: `New athlete in ${bracketLabel(arrival)}`,
    text: [
      `Hi ${firstName(recipient.contact_name)},`,
      '',
      'Someone new just signed up who can complete your team:',
      '',
      contactBlock(arrival),
      '',
      "Get in touch — they've got your details as well.",
      footer(recipient.manage_token),
    ].join('\n'),
  }
}

// 4 -------------------------------------------------------------------------
export function closedEmail(l: Listing, reason: 'matched' | 'closed') {
  return {
    subject: reason === 'matched' ? 'Congrats on your team' : 'Your listing is closed',
    text: [
      `Hi ${firstName(l.contact_name)},`,
      '',
      reason === 'matched'
        ? "Your listing is closed and you're off the board. Good luck at the comp."
        : "Your listing is removed and you're off the board.",
      '',
      'Changed your mind? Sign up again any time:',
      BASE,
      '',
      "You won't get any more emails from us about this.",
    ].join('\n'),
  }
}

// 5 -------------------------------------------------------------------------
/** Sent by /recover, and by submit when someone signs up a second time. */
export function recoveryEmail(
  links: { manage_token: string; bracket: string; current_size: number }[],
  duplicate: boolean,
) {
  const one = links.length === 1

  return {
    subject: duplicate ? "You're already on the board" : 'Your listing link',
    text: [
      duplicate
        ? "You've already got a listing, so we didn't create a second one —"
        : 'Here you go —',
      one
        ? `here's the link to manage ${duplicate ? 'it' : 'your listing'}:`
        : `here are your ${links.length} listings:`,
      '',
      links
        .map((l) =>
          [
            `  ${l.bracket} · ${l.current_size === 1 ? 'Solo' : 'Pair'} — ${needsLabel(l.current_size)}`,
            `  ${BASE}/manage/${l.manage_token}`,
          ].join('\n'),
        )
        .join('\n\n'),
      '',
      duplicate
        ? 'Want to change division or roster size? Remove the old listing first, then sign up again.'
        : "That link is all you need — no password, no account.",
      '',
      "Didn't ask for this? Someone typed your address by mistake. Ignore it;",
      'nothing has changed and no details were shared.',
    ].join('\n'),
  }
}

function firstName(full: string): string {
  return full.trim().split(' ')[0]
}
