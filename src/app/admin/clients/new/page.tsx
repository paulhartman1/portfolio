'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AddClientPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
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
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          first_name: formData.first_name,
          last_name: formData.last_name,
          company: formData.company,
          phone: formData.phone,
          pronouns: formData.pronouns,
        }),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to create client')

      setStatus('success')
      setMessage(`Client account created for ${formData.email}. They can sign in with the password you set and use password reset from login.`)
      
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
        <p className="text-white/80">Create a client account with email and password</p>
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

          <div>
            <label className="block text-white mb-2">Temporary Password *</label>
            <input
              type="password"
              name="password"
              required
              minLength={8}
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white"
              placeholder="At least 8 characters"
            />
            <p className="text-white/60 text-sm mt-1">
              Client can reset this from the login page.
            </p>
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
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white [&>option]:bg-gray-900 [&>option]:text-white"
            >
              <option value="" className="bg-gray-900 text-white">Select...</option>
              <option value="she/her" className="bg-gray-900 text-white">She/Her</option>
              <option value="he/him" className="bg-gray-900 text-white">He/Him</option>
              <option value="they/them" className="bg-gray-900 text-white">They/Them</option>
              <option value="other" className="bg-gray-900 text-white">Other</option>
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
              {status === 'sending' ? 'Creating...' : 'Create Client'}
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
