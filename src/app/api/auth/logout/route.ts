import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = createRouteHandlerClient({ cookies })
  await supabase.auth.signOut()

  // Clear cookies
  const res = NextResponse.redirect(new URL('/', 'https://loveondev.com'))
  res.cookies.delete('sb-access-token')
  res.cookies.delete('sb-refresh-token')
  return res
}
