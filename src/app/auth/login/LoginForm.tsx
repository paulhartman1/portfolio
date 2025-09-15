'use client'

import { useState } from 'react'
import { supabaseBrowser } from '@/utils/supabase/client'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle'|'sending'|'sent'|'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setErrorMsg(null)

    try {
      const redirectTo = `${window.location.origin}/auth/callback`
      const { data, error } = await supabaseBrowser.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: true},
      })

      if (error) throw error
      if (!data) throw new Error('No data received')
      setStatus('sent')
    } catch (error) {
      console.error('Error sending magic link:', error)
      setErrorMsg('Unknown error')
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
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
          className="w-full px-4 py-3 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold"
        >
          {status === 'sending' ? 'Sending…' : status === 'sent' ? 'Check your email' : 'Send magic link'}
        </button>

        {status === 'sent' && <p className="mt-4 text-white/80">A magic link has been sent — check your inbox.</p>}
        {status === 'error' && <p className="mt-4 text-red-400">{errorMsg}</p>}
      </form>
    </div>
  )
}
