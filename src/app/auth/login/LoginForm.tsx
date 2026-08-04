'use client'

import { useState, useEffect } from 'react'
import { supabaseBrowser } from '@/utils/supabase/client'

// Only allow redirects back to loveondev.com subdomains (or localhost in dev)
function isLoveondevSubdomain(url: string): boolean {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname
    if (host === 'localhost' || host === '127.0.0.1') return true
    const parts = host.split('.')
    return parts.length >= 3 && parts.slice(-2).join('.') === 'loveondev.com'
  } catch {
    return false
  }
}

// Error codes set by /api/auth/callback when an email link cannot be redeemed.
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  link_expired: 'That link has expired or was already used. Request a new one below.',
  link_invalid: 'That link is not valid. Request a new one below.',
  no_code: 'That link is missing its sign-in token. Request a new one below.',
  no_session: 'We could not complete sign in. Request a new link below.',
  auth_failed: 'Sign in failed. Request a new link below.',
  rate_limited: 'Too many sign-in attempts right now. Wait a minute and try your link again.',
}

// A stale cookie can leave the browser client believing there is a session
// while the server disagrees. Login then forwards to /dashboard, the server
// bounces back here, and each round trip fires another token refresh. Two
// forwards in quick succession means we are in that loop, so drop the dead
// session locally instead of forwarding again.
const AUTO_FORWARD_KEY = 'loveondev_auth_auto_forward_at'
const AUTO_FORWARD_WINDOW_MS = 5000

type LoginBrand = 'loveondev' | 'cgt'

export default function LoginForm({ brand = 'loveondev' }: { brand?: LoginBrand }) {
  const isCgt = brand === 'cgt'
  const [mode, setMode] = useState<'password' | 'magic-link'>('magic-link')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [magicStatus, setMagicStatus] = useState<'idle'|'sending'|'sent'|'error'>('idle')
  const [passwordStatus, setPasswordStatus] = useState<'idle'|'sending'|'sent'|'error'>('idle')
  const [resetStatus, setResetStatus] = useState<'idle'|'sending'|'sent'|'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isLocalhost, setIsLocalhost] = useState(false)

  useEffect(() => {
    setIsLocalhost(window.location.hostname === 'localhost')

    const errorCode = new URLSearchParams(window.location.search).get('error')
    if (errorCode) {
      setErrorMsg(AUTH_ERROR_MESSAGES[errorCode] ?? 'Sign in failed. Please try again.')
    }
  }, [])

  // Authenticated visitors: review widget return, else go to dashboard.
  // getUser() validates server-side; a dead/revoked session is cleared locally
  // (scope: 'local') so a stale cookie cannot trap the page in a redirect loop.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const reviewReturn = params.get('review_return')

    supabaseBrowser.auth.getUser().then(({ data, error }) => {
      if (error) {
        void supabaseBrowser.auth.signOut({ scope: 'local' })
        return
      }
      if (!data.user) return
      if (reviewReturn && isLoveondevSubdomain(reviewReturn)) {
        const separator = reviewReturn.includes('?') ? '&' : '?'
        window.location.href = `${reviewReturn}${separator}review_authed=1`
        return
      }

      const lastForward = Number(sessionStorage.getItem(AUTO_FORWARD_KEY) || 0)
      if (Date.now() - lastForward < AUTO_FORWARD_WINDOW_MS) {
        sessionStorage.removeItem(AUTO_FORWARD_KEY)
        void supabaseBrowser.auth.signOut({ scope: 'local' })
        setErrorMsg('We could not verify your session. Please sign in again.')
        return
      }

      sessionStorage.setItem(AUTO_FORWARD_KEY, String(Date.now()))
      window.location.href = '/dashboard'
    })
  }, [])

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setMagicStatus('sending')
    setPasswordStatus('idle')
    setResetStatus('idle')
    setErrorMsg(null)

    try {
      const redirectTo = `${window.location.origin}/api/auth/callback`
      console.log('[Magic Link] Sending to:', email)
      console.log('[Magic Link] Redirect URL:', redirectTo)
      
      const { data, error } = await supabaseBrowser.auth.signInWithOtp({
        email,
        options: { 
          emailRedirectTo: redirectTo,
          shouldCreateUser: false
        },
      })

      console.log('[Magic Link] Response:', { data, error })
      
      if (error) throw error
      if (!data) throw new Error('No data received')
      
      console.log('[Magic Link] Email sent successfully')
      setMagicStatus('sent')
    } catch (error: unknown) {
      console.error('[Magic Link] Error:', error)
      setErrorMsg((error as Error)?.message || (error as {error_description?: string})?.error_description || 'Unknown error')
      setMagicStatus('error')
    }
  }
  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault()
    await completePasswordLogin(email, password)
  }

  async function devPasswordLogin() {
    console.log('Dev login clicked')
    await completePasswordLogin('dev@test.com', 'dev123456')
  }

  async function completePasswordLogin(loginEmail: string, loginPassword: string) {
    setPasswordStatus('sending')
    setMagicStatus('idle')
    setResetStatus('idle')
    setErrorMsg(null)

    try {
      const { data, error} = await supabaseBrowser.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword
      })

      if (error) throw error
      
      const sessionData = data.session
      if (sessionData) {
        const res = await fetch('/api/auth/set-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: sessionData.access_token,
            refresh_token: sessionData.refresh_token
          })
        })
        const result = await res.json()
        // Check for review widget return URL (passed as query param)
        const reviewReturn = new URLSearchParams(window.location.search).get('review_return')
        if (reviewReturn && isLoveondevSubdomain(reviewReturn)) {
          // The session cookie is now set on loveondev.com (shared across
          // subdomains). Bounce back with a marker so the widget can detect a
          // post-login return and break the loop if auth still fails.
          const separator = reviewReturn.includes('?') ? '&' : '?'
          window.location.href = `${reviewReturn}${separator}review_authed=1`
          return
        }
        
        const requestedRedirect = new URLSearchParams(window.location.search).get('redirect')
        const safeRedirect = requestedRedirect?.startsWith('/') ? requestedRedirect : null
        const finalRedirect = safeRedirect || result.redirectUrl || '/dashboard'
        window.location.href = finalRedirect
      }
      setPasswordStatus('sent')
    } catch (error: unknown) {
      console.error('Error logging in:', error)
      setErrorMsg((error as Error)?.message || 'Login failed')
      setPasswordStatus('error')
    }
  }

  async function sendPasswordReset() {
    if (!email) {
      setErrorMsg('Enter your email first to send a password reset link.')
      setResetStatus('error')
      return
    }

    setResetStatus('sending')
    setMagicStatus('idle')
    setPasswordStatus('idle')
    setErrorMsg(null)

    try {
      // The recovery email template and /api/auth/callback decide where the
      // user lands, so no `next` param is needed here.
      const redirectTo = `${window.location.origin}/api/auth/callback`
      const { error } = await supabaseBrowser.auth.resetPasswordForEmail(email, {
        redirectTo,
      })

      if (error) throw error
      setResetStatus('sent')
    } catch (error: unknown) {
      setErrorMsg((error as Error)?.message || 'Failed to send password reset email')
      setResetStatus('error')
    }
  }

  const shellClass = isCgt
    ? 'min-h-screen flex items-center justify-center bg-[#290D47] px-4'
    : 'mt-60 flex items-center justify-center'
  const cardClass = isCgt
    ? 'p-8 bg-[#1A0F2E] border border-[#00F5E4]/20 rounded-xl w-full max-w-md space-y-6 shadow-xl'
    : 'p-8 bg-white/5 rounded-xl w-full max-w-md space-y-6'
  const primaryBtn = isCgt
    ? 'w-full px-4 py-3 rounded-lg bg-[#00F5E4] text-[#290D47] font-semibold hover:bg-[#00F5E4]/90 transition-colors disabled:opacity-50'
    : 'w-full px-4 py-3 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold hover:scale-105 transition-transform disabled:opacity-50'
  const secondaryBtn = isCgt
    ? 'w-full px-4 py-2 rounded-lg bg-white/10 text-[#F8F7F5] text-sm hover:bg-white/20 disabled:opacity-50'
    : 'w-full px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20 disabled:opacity-50'
  const tabActive = isCgt ? 'bg-[#00F5E4] text-[#290D47]' : 'bg-white text-gray-900'
  const tabIdle = isCgt ? 'bg-white/10 text-[#F8F7F5] hover:bg-white/20' : 'bg-white/10 text-white hover:bg-white/20'
  const labelClass = isCgt ? 'block text-[#F8F7F5]/80 mb-2' : 'block text-white/80 mb-2'
  const inputClass = isCgt
    ? 'w-full px-4 py-3 rounded-md bg-white/5 text-[#F8F7F5] border border-white/10 focus:outline-none focus:border-[#00F5E4]'
    : 'w-full px-4 py-3 rounded-md bg-white/5 text-white'
  const noticeClass = isCgt
    ? 'bg-[#00F5E4]/10 border border-[#00F5E4]/40 rounded-lg p-4 mb-4'
    : 'bg-purple-500/20 border border-purple-400/50 rounded-lg p-4 mb-4'
  const mutedText = isCgt ? 'text-[#F8F7F5]/80' : 'text-white/80'

  return (
    <div className={shellClass}>
      <div className={cardClass}>
        {isCgt && (
          <div className="text-center space-y-1">
            <p className="text-xs font-semibold tracking-wider text-[#00F5E4]">COMMON GROUND TECHNOLOGY</p>
            <h1 className="text-2xl font-bold text-[#F8F7F5]">Client Login</h1>
            <p className="text-sm text-[#F8F7F5]/70">Access your project workspace</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode('magic-link')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${mode === 'magic-link' ? tabActive : tabIdle}`}
          >
            Magic Link
          </button>
          <button
            type="button"
            onClick={() => setMode('password')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${mode === 'password' ? tabActive : tabIdle}`}
          >
            Password
          </button>
        </div>
        <label className={labelClass}>Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@domain.tld"
          className={`${inputClass} mb-1`}
        />

        {mode === 'password' ? (
          <form onSubmit={signInWithPassword} className="space-y-4">
            <div>
              <label className={labelClass}>Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={passwordStatus === 'sending'}
              className={primaryBtn}
            >
              {passwordStatus === 'sending' ? 'Signing in…' : 'Sign in with password'}
            </button>

            <button
              type="button"
              onClick={sendPasswordReset}
              disabled={resetStatus === 'sending'}
              className={secondaryBtn}
            >
              {resetStatus === 'sending' ? 'Sending reset email…' : 'Forgot password? Send reset link'}
            </button>
          </form>
        ) : (
          <form onSubmit={sendMagicLink} className="space-y-4">
            <div className={noticeClass}>
              <p className={`${mutedText} text-sm`}>
                <strong>No password needed.</strong> Enter your email and we&apos;ll send you a secure login link.
              </p>
            </div>
            <button
              type="submit"
              disabled={magicStatus === 'sending' || magicStatus === 'sent'}
              className={primaryBtn}
            >
              {magicStatus === 'sending' ? 'Sending…' : magicStatus === 'sent' ? 'Check your email' : 'Send magic link'}
            </button>
          </form>
        )}

        {magicStatus === 'sent' && <p className={mutedText}>A magic link has been sent — check your inbox.</p>}
        {resetStatus === 'sent' && <p className={mutedText}>Password reset email sent — check your inbox.</p>}
        {errorMsg && <p className="text-red-400">{errorMsg}</p>}

        {isLocalhost && (
          <div className="pt-4 border-t border-white/20">
            <p className="text-white/60 text-sm mb-2">Dev Mode Only:</p>
            <button
              type="button"
              onClick={devPasswordLogin}
              disabled={passwordStatus === 'sending'}
              className={secondaryBtn}
            >
              Quick Login (Dev)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
