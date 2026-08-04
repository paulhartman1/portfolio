import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { EmailOtpType } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { authCookieOptions } from '@/utils/supabase/cookie-options'

const EMAIL_OTP_TYPES: EmailOtpType[] = [
  'invite',
  'magiclink',
  'recovery',
  'signup',
  'email',
  'email_change',
]

function asEmailOtpType(value: string | null): EmailOtpType | null {
  return EMAIL_OTP_TYPES.includes(value as EmailOtpType) ? (value as EmailOtpType) : null
}

export async function GET(req: NextRequest) {
  console.log('[Auth Callback] Request URL:', req.url)
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const rawType = searchParams.get('type')
  const type = asEmailOtpType(rawType)
  const requestedNext = searchParams.get('next')
  const safeNext = requestedNext?.startsWith('/') ? requestedNext : null
  console.log('[Auth Callback] Code:', code ? 'present' : 'missing', 'TokenHash:', tokenHash ? 'present' : 'missing', 'Type:', rawType)

  if (!code && !tokenHash) {
    console.error('[Auth Callback] No code or token_hash in URL')
    return NextResponse.redirect(new URL('/auth/login?error=no_code', req.url))
  }

  const cookieStore = await cookies()
  const shared = authCookieOptions()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: shared,
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, { ...options, ...shared })
          })
        },
      },
    }
  )

  // Drop any stale auth cookie before redeeming the link. Otherwise the client
  // tries to refresh a dead token first and fails with refresh_token_not_found,
  // which buries the real error for this request.
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch (err) {
    console.warn('[Auth Callback] Could not clear stale session:', err)
  }

  // token_hash is the primary path. It carries no browser state, so it works
  // for emails sent from the Supabase dashboard and for links opened on a
  // different device or browser than the one that requested them.
  if (tokenHash && type) {
    console.log('[Auth Callback] Verifying token hash, type:', type)
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (error || !data.session) {
      console.error('[Auth Callback] Token verification failed:', error)
      return NextResponse.redirect(new URL('/auth/login?error=link_expired', req.url))
    }
    console.log('[Auth Callback] Token verification successful, user:', data.session.user.email)
  } else if (tokenHash && !type) {
    console.error('[Auth Callback] token_hash present but type missing/unsupported:', rawType)
    return NextResponse.redirect(new URL('/auth/login?error=link_invalid', req.url))
  } else if (code) {
    // PKCE fallback, used by OAuth and by email links opened in the same
    // browser that requested them. Requires the code verifier cookie.
    console.log('[Auth Callback] Exchanging code for session...')
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error || !data.session) {
      console.error('[Auth Callback] Exchange failed:', error)
      return NextResponse.redirect(new URL('/auth/login?error=link_expired', req.url))
    }
    console.log('[Auth Callback] Session exchange successful, user:', data.session.user.email)
  }

  // Password reset must land on the update-password form before anything else,
  // so the recovery session is not spent on a dashboard redirect.
  if (type === 'recovery') {
    console.log('[Auth Callback] Recovery flow, redirecting to update-password')
    return NextResponse.redirect(new URL(safeNext ?? '/auth/update-password', req.url))
  }

  console.log('[Auth Callback] Getting user...')
  const { data: { user }, error: getUserError } = await supabase.auth.getUser()
  if (getUserError) {
    console.error('[Auth Callback] Error getting user:', getUserError)
  }
  console.log('[Auth Callback] User:', user?.email)
  if (!user) {
    console.error('[Auth Callback] No user found')
    return NextResponse.redirect(new URL('/auth/login?error=no_session', req.url))
  }

  console.log('[Auth Callback] Fetching profile for user:', user.id)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_admin, has_seen_welcome')
    .eq('id', user.id)
    .single()
  
  console.log('[Auth Callback] Profile:', profile, 'Error:', profileError)

  // Prioritize explicit safe next redirect (used by other flows)
  if (safeNext) {
    return NextResponse.redirect(new URL(safeNext, req.url))
  }

  // If user hasn't seen welcome page yet, show it
  if (!profile?.has_seen_welcome) {
    console.log('[Auth Callback] First time user, redirecting to welcome')
    return NextResponse.redirect(new URL('/auth/welcome', req.url))
  }

  // Redirect based on role for returning users
  if (profile?.is_admin) {
    console.log('[Auth Callback] Admin user, redirecting to admin')
    return NextResponse.redirect(new URL('/admin', req.url))
  }

  // For non-admin users, find their project subdomain
  const { data: projectClient } = await supabase
    .from('project_clients')
    .select('projects(subdomain)')
    .eq('client_id', user.id)
    .limit(1)
    .single()

  const projectSubdomain = projectClient?.projects && !Array.isArray(projectClient.projects)
    ? (projectClient.projects as { subdomain: string }).subdomain
    : null

  if (projectSubdomain) {
    console.log('[Auth Callback] Client user, redirecting to portal:', projectSubdomain)
    return NextResponse.redirect(new URL(`/portal/${projectSubdomain}`, req.url))
  }

  // Fallback to login if no project found
  console.log('[Auth Callback] No project found, redirecting to login')
  return NextResponse.redirect(new URL('/auth/login', req.url))
}
