import { createClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config'

// Anon client. It can read `public_listings` and nothing else — every write
// and every read of contact details goes through an Edge Function.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

export type PublicListing = {
  id: string
  created_at: string
  first_name: string
  division: 'rx' | 'scaled' | 'masters'
  sex_division: 'male' | 'female'
  current_size: 1 | 2
  notes: string | null
  status: string
}
