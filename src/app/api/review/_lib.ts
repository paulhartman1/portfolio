import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function getAuthenticatedUser(request: NextRequest) {
  // Check for Bearer token in Authorization header
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null
  
  const supabase = await createClient()
  
  // If token provided, verify it
  if (token) {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    return { user: error ? null : user, supabase }
  }
  
  // Fallback to cookie-based auth
  const { data: { user } } = await supabase.auth.getUser()
  return { user, supabase }
}
