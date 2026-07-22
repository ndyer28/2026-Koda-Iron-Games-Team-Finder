const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local.',
  )
}

export const SUPABASE_URL: string = url
export const SUPABASE_ANON_KEY: string = anonKey
export const FUNCTIONS_URL = `${url}/functions/v1`

export const DIVISION_LABELS = {
  rx: 'Rx',
  scaled: 'Scaled',
  masters: 'Masters',
} as const

export const SEX_LABELS = {
  male: "Men's",
  female: "Women's",
} as const

export const NOTES_MAX = 300
