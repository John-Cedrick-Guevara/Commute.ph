import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/** Supabase Auth for admin sign-in; null when the env vars aren't set (see .env.example). */
export const supabase = url && key ? createClient(url, key) : null
