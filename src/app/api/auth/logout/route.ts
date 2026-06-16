import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  
  // Build absolute redirect URL for localhost or prod
  const host = req.headers.get('host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const redirectUrl = `${protocol}://${host}/`

  return NextResponse.redirect(redirectUrl, 303)
}
