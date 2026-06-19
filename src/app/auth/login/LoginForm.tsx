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

export default function LoginForm() {
  const [mode, setMode] = useState<'password' | 'magic-link'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [magicStatus, setMagicStatus] = useState<'idle'|'sending'|'sent'|'error'>('idle')
  const [passwordStatus, setPasswordStatus] = useState<'idle'|'sending'|'sent'|'error'>('idle')
  const [resetStatus, setResetStatus] = useState<'idle'|'sending'|'sent'|'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isLocalhost, setIsLocalhost] = useState(false)

  useEffect(() => {
    setIsLocalhost(window.location.hostname === 'localhost')
  }, [])

  // If the user already has a session and arrived here from the review widget,
  // immediately bounce back to the widget site with a fresh access token.
  useEffect(() => {
    const reviewReturn = new URLSearchParams(window.location.search).get('review_return')
    if (!reviewReturn || !isLoveondevSubdomain(reviewReturn)) return

    supabaseBrowser.auth.getSession().then(({ data }) => {
      const accessToken = data.session?.access_token
      if (accessToken) {
        const separator = reviewReturn.includes('?') ? '&' : '?'
        window.location.href = `${reviewReturn}${separator}auth_token=${accessToken}`
      }
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
          // Append access token so the widget can authenticate
          const separator = reviewReturn.includes('?') ? '&' : '?'
          window.location.href = `${reviewReturn}${separator}auth_token=${sessionData.access_token}`
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
      const redirectTo = `${window.location.origin}/api/auth/callback?next=/auth/update-password`
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

  return (
    <div className=" mt-60 flex items-center justify-center">
      <div className="p-8 bg-white/5 rounded-xl w-full max-w-md space-y-6">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode('password')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${mode === 'password' ? 'bg-white text-gray-900' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => setMode('magic-link')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${mode === 'magic-link' ? 'bg-white text-gray-900' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            Magic Link
          </button>
        </div>
        <label className="block text-white/80 mb-2">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@domain.tld"
          className="w-full px-4 py-3 rounded-md bg-white/5 text-white mb-1"
        />

        {mode === 'password' ? (
          <form onSubmit={signInWithPassword} className="space-y-4">
            <div>
              <label className="block text-white/80 mb-2">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-md bg-white/5 text-white"
              />
            </div>

            <button
              type="submit"
              disabled={passwordStatus === 'sending'}
              className="w-full px-4 py-3 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold"
            >
              {passwordStatus === 'sending' ? 'Signing in…' : 'Sign in with password'}
            </button>

            <button
              type="button"
              onClick={sendPasswordReset}
              disabled={resetStatus === 'sending'}
              className="w-full px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20 disabled:opacity-50"
            >
              {resetStatus === 'sending' ? 'Sending reset email…' : 'Forgot password? Send reset link'}
            </button>
          </form>
        ) : (
          <form onSubmit={sendMagicLink} className="space-y-4">
            <p className="text-white/70 text-sm">Prefer no password? We&apos;ll send a sign-in link.</p>
            <button
              type="submit"
              disabled={magicStatus === 'sending' || magicStatus === 'sent'}
              className="w-full px-4 py-3 rounded-full bg-white/10 text-white font-semibold hover:bg-white/20"
            >
              {magicStatus === 'sending' ? 'Sending…' : magicStatus === 'sent' ? 'Check your email' : 'Send magic link'}
            </button>
          </form>
        )}

        {magicStatus === 'sent' && <p className="text-white/80">A magic link has been sent — check your inbox.</p>}
        {resetStatus === 'sent' && <p className="text-white/80">Password reset email sent — check your inbox.</p>}
        {errorMsg && <p className="text-red-400">{errorMsg}</p>}

        {/* Dev-only password login */}
        {isLocalhost && (
          <div className="pt-4 border-t border-white/20">
            <p className="text-white/60 text-sm mb-2">Dev Mode Only:</p>
            <button
              type="button"
              onClick={devPasswordLogin}
              disabled={passwordStatus === 'sending'}
              className="w-full px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20"
            >
              Quick Login (Dev)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
