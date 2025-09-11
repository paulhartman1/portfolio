// lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!


export const supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // optionally tune persist/session behavior here
  },
})
