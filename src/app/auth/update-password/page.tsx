"use client";

import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/utils/supabase/client'
import { useState, useEffect } from 'react'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const supabase = supabaseBrowser
    
    async function establishSession() {
      // Try to get recovery tokens from sessionStorage
      const accessToken = sessionStorage.getItem('recovery_access_token')
      const refreshToken = sessionStorage.getItem('recovery_refresh_token')
      
      if (accessToken) {
        console.log('[UpdatePassword] Found recovery tokens, establishing session')
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          })
          
          if (error) {
            console.error('[UpdatePassword] Session setup error:', error)
            setError('Unable to verify recovery link. Please request a new password reset.')
          } else if (data.session) {
            console.log('[UpdatePassword] Session established successfully')
            // Clear stored tokens
            sessionStorage.removeItem('recovery_access_token')
            sessionStorage.removeItem('recovery_refresh_token')
          }
        } catch (err) {
          console.error('[UpdatePassword] Unexpected error:', err)
          setError('An unexpected error occurred. Please try again.')
        }
      } else {
        // Check if user already has a session
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          console.log('[UpdatePassword] No session or recovery tokens found')
          setError('No active recovery session. Please request a new password reset link.')
        }
      }
      
      setIsLoading(false)
    }
    
    establishSession()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    
    setIsSubmitting(true)
    setError(null)
    
    const supabase = supabaseBrowser
    const { error: updateError } = await supabase.auth.updateUser({
      password: password
    })
    
    if (updateError) {
      setError(updateError.message)
      setIsSubmitting(false)
    } else {
      router.push('/auth/login?message=Password updated successfully')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white/5 backdrop-blur-lg border border-white/20 rounded-2xl p-8">
        <h1 className="text-3xl font-bold text-white mb-3">Set New Password</h1>
        <p className="text-white/70 mb-6">Choose a new password for your account.</p>

        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-500/20 border border-red-500/50 text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-white/80 mb-2">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={isSubmitting || !!error}
              className="w-full px-4 py-3 rounded-md bg-white/5 text-white disabled:opacity-50"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label className="block text-white/80 mb-2">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              disabled={isSubmitting || !!error}
              className="w-full px-4 py-3 rounded-md bg-white/5 text-white disabled:opacity-50"
              placeholder="Repeat new password"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !!error}
            className="w-full px-4 py-3 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold disabled:opacity-50"
          >
            {isSubmitting ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
