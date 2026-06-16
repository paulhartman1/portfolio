import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  console.log('[Auth Callback] Request URL:', req.url)
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const requestedNext = searchParams.get('next')
  const safeNext = requestedNext?.startsWith('/') ? requestedNext : null
  console.log('[Auth Callback] Code:', code ? 'present' : 'missing')

  if (!code) {
    console.error('[Auth Callback] No code in URL')
    return NextResponse.redirect(new URL('/auth/login?error=no_code', req.url))
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  console.log('[Auth Callback] Exchanging code for session...')
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error('[Auth Callback] Exchange failed:', error)
    return NextResponse.redirect(new URL('/auth/login?error=auth_failed', req.url))
  }
  console.log('[Auth Callback] Session exchange successful')

  // Get user profile to determine redirect
  console.log('[Auth Callback] Getting user...')
  const { data: { user } } = await supabase.auth.getUser()
  console.log('[Auth Callback] User:', user?.email)
  if (!user) {
    console.error('[Auth Callback] No user found')
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }

  console.log('[Auth Callback] Fetching profile for user:', user.id)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  
  console.log('[Auth Callback] Profile:', profile, 'Error:', profileError)

  // Prioritize explicit safe next redirect (used by password reset flow)
  if (safeNext) {
    return NextResponse.redirect(new URL(safeNext, req.url))
  }

  // Redirect based on role
  const redirectUrl = profile?.is_admin ? '/admin' : '/dashboard'
  console.log('[Auth Callback] Redirecting to:', redirectUrl)
  
  if (profile?.is_admin) {
    return NextResponse.redirect(new URL('/admin', req.url))
  }

  return NextResponse.redirect(new URL('/dashboard', req.url))
}
