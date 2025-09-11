'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<'loading'|'error'>('loading')
  const [message, setMessage] = useState('')
  const router = useRouter()

  useEffect(() => {
    const hash = window.location.hash
    if (!hash) {
      setStatus('error')
      setMessage('No token found in URL.')
      return
    }

    const params = new URLSearchParams(hash.replace('#', ''))
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')

    if (!access_token || !refresh_token) {
      setStatus('error')
      setMessage('Missing tokens.')
      return
    }

    // POST tokens to API to set HttpOnly cookies
    fetch('../api/auth/set-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token, refresh_token })
    })
    .then(res => res.ok ? router.replace('/dashboard') : setStatus('error'))
    .catch(err => {
      setStatus('error')
      setMessage('Failed to set session: ' + err.message)
    })

  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {status === 'loading' && <p className="text-white">Logging you in…</p>}
      {status === 'error' && <p className="text-red-400">{message}</p>}
    </div>
  )
}
