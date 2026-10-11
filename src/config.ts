// Publiczne dane projektu Supabase. Klucz „publishable/anon” jest z założenia jawny —
// bezpieczeństwo danych zapewnia RLS (każdy widzi tylko swoje wiersze).
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL || 'https://rpalciokigpaqfprgczv.supabase.co'
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Z8iiWJ8clscZINPh0ojCHQ_kZrJtj23'
export const SYNC_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
