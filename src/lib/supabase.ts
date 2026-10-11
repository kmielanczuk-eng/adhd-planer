import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL, SYNC_ENABLED } from '../config'

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (!SYNC_ENABLED) return null
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // PKCE: kod w ?code=…, nie koliduje z routingiem po hashu
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return client
}

export function redirectUrl(): string {
  return location.origin + import.meta.env.BASE_URL
}
