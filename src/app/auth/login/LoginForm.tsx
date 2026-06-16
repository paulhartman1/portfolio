'use client'

import { useState, useEffect } from 'react'
import { supabaseBrowser } from '@/utils/supabase/client'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle'|'sending'|'sent'|'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isLocalhost, setIsLocalhost] = useState(false)

  useEffect(() => {
    setIsLocalhost(window.location.hostname === 'localhost')
  }, [])

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setErrorMsg(null)

    try {
      const redirectTo = `${window.location.origin}/api/auth/callback`
      const { data, error } = await supabaseBrowser.auth.signInWithOtp({
        email,
        options: { 
          emailRedirectTo: redirectTo,
          shouldCreateUser: false
        },
      })

      if (error) throw error
      if (!data) throw new Error('No data received')
      setStatus('sent')
    } catch (error: unknown) {
      console.error('Error sending magic link:', error)
      setErrorMsg((error as Error)?.message || (error as {error_description?: string})?.error_description || 'Unknown error')
      setStatus('error')
    }
  }

  async function devPasswordLogin() {
    console.log('Dev login clicked')
    setStatus('sending')
    setErrorMsg(null)

    try {
      console.log('Attempting dev login...')
      // Dev-only password login
      const { data, error} = await supabaseBrowser.auth.signInWithPassword({
        email: 'dev@test.com',
        password: 'dev123456'
      })

      console.log('Login response:', { data, error })
      if (error) throw error
      
      console.log('Login successful, setting session...')
      // Set session via API to persist cookies
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
        console.log('Session set, redirecting to', result.redirectUrl)
        window.location.href = result.redirectUrl || '/dashboard'
      }
    } catch (error: unknown) {
      console.error('Error logging in:', error)
      setErrorMsg((error as Error)?.message || 'Login failed')
      setStatus('error')
    }
  }

  return (
    <div className=" mt-60 flex items-center justify-center">
      <form onSubmit={sendMagicLink} className="p-8 bg-white/5 rounded-xl w-full max-w-md">
        <h2 className="text-2xl font-bold text-white mb-4">Magic Link</h2>

        <label className="block text-white/80 mb-2">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@domain.tld"
          className="w-full px-4 py-3 rounded-md bg-white/5 text-white mb-4"
        />

        <button
          type="submit"
          disabled={status === 'sending' || status === 'sent'}
          className="w-full px-4 py-3 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold z-1000"
        >
          {status === 'sending' ? 'Sending…' : status === 'sent' ? 'Check your email' : 'Send magic link'}
        </button>

        {status === 'sent' && <p className="mt-4 text-white/80">A magic link has been sent — check your inbox.</p>}
        {status === 'error' && <p className="mt-4 text-red-400">{errorMsg}</p>}

        {/* Dev-only password login */}
        {isLocalhost && (
          <div className="mt-4 pt-4 border-t border-white/20">
            <p className="text-white/60 text-sm mb-2">Dev Mode Only:</p>
            <button
              type="button"
              onClick={devPasswordLogin}
              className="w-full px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20"
            >
              Quick Login (Dev)
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
