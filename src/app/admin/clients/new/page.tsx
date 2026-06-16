'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/utils/supabase/client'

export default function AddClientPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    company: '',
    phone: '',
    pronouns: ''
  })
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('sending')
    setMessage('')

    try {
      const display_name = `${formData.first_name} ${formData.last_name}`.trim()
      
      // Invite the user via magic link
      const { error } = await supabaseBrowser.auth.signInWithOtp({
        email: formData.email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          shouldCreateUser: true,
          data: {
            first_name: formData.first_name,
            last_name: formData.last_name,
            company: formData.company,
            phone: formData.phone,
            pronouns: formData.pronouns,
            display_name
          }
        }
      })

      if (error) throw error

      setStatus('success')
      setMessage(`Magic link sent to ${formData.email}. The client will be created when they click the link.`)
      
      // Reset form
      setTimeout(() => {
        router.push('/admin')
      }, 2000)
      
    } catch (error) {
      console.error('Error inviting client:', error)
      setStatus('error')
      setMessage((error as Error)?.message || 'Failed to send invitation')
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Add New Client</h1>
        <p className="text-white/80">Send a magic link invitation to a new client</p>
      </div>

      <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-white mb-2">Email *</label>
            <input
              type="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white"
              placeholder="client@example.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-white mb-2">First Name</label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white"
              />
            </div>

            <div>
              <label className="block text-white mb-2">Last Name</label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-white mb-2">Company</label>
            <input
              type="text"
              name="company"
              value={formData.company}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white"
            />
          </div>

          <div>
            <label className="block text-white mb-2">Phone</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white"
            />
          </div>

          <div>
            <label className="block text-white mb-2">Pronouns</label>
            <select
              name="pronouns"
              value={formData.pronouns}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white"
            >
              <option value="">Select...</option>
              <option value="she/her">She/Her</option>
              <option value="he/him">He/Him</option>
              <option value="they/them">They/Them</option>
              <option value="other">Other</option>
            </select>
          </div>

          {status === 'success' && (
            <div className="p-4 rounded-lg bg-green-500/20 border border-green-500/50 text-green-200">
              {message}
            </div>
          )}

          {status === 'error' && (
            <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/50 text-red-200">
              {message}
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={status === 'sending'}
              className="px-6 py-3 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold hover:scale-105 transition-transform disabled:opacity-50"
            >
              {status === 'sending' ? 'Sending...' : 'Send Invitation'}
            </button>
            
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 rounded-lg bg-white/20 text-white hover:bg-white/30"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
