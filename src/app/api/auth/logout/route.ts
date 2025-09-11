import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  await supabase.auth.signOut()

  // Delete Supabase cookies
  await cookies().then((cookieJar) => {
    cookieJar.delete('sb-*')
    
  })
  
  // Build absolute redirect URL for localhost or prod
  const host = req.headers.get('host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const redirectUrl = `${protocol}://${host}/`

  return NextResponse.redirect(redirectUrl, 303)
}
