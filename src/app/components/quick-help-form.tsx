'use client'
import { useState } from 'react'
import { supabaseBrowser } from '@/utils/supabase/client'

export default function QuickHelpForm({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    issue: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate at least one contact method
    if (!formData.phone && !formData.email) {
      setError('Please provide either a phone number or email')
      return
    }

    setIsSubmitting(true)

    try {
      const { error: insertError } = await supabaseBrowser
        .from('help_requests')
        .insert([{
          name: formData.name || null,
          phone: formData.phone || null,
          email: formData.email || null,
          issue: formData.issue || null,
        }])

      if (insertError) throw insertError

      setIsSubmitted(true)
      
      // Close after 2 seconds
      setTimeout(() => {
        onClose()
        setIsSubmitted(false)
        setFormData({ name: '', phone: '', email: '', issue: '' })
      }, 2000)
    } catch (err) {
      console.error('Error submitting help request:', err)
      setError('Something went wrong. Please try texting me directly.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Close"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {isSubmitted ? (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">✅</div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Got it!</h3>
            <p className="text-slate-600">I'll get back to you ASAP</p>
          </div>
        ) : (
          <>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Need Help?</h3>
            <p className="text-slate-600 mb-6">Tell me what's going on and how to reach you.</p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                  Your Name <span className="text-slate-400">(optional)</span>
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Paul"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1">
                  Phone Number <span className="text-slate-400">(preferred)</span>
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                  Email <span className="text-slate-400">(or phone above)</span>
                </label>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="issue" className="block text-sm font-medium text-slate-700 mb-1">
                  What's the problem? <span className="text-slate-400">(optional)</span>
                </label>
                <textarea
                  id="issue"
                  rows={3}
                  value={formData.issue}
                  onChange={(e) => setFormData({ ...formData, issue: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  placeholder="My WiFi keeps dropping in the bedroom..."
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg disabled:opacity-50"
              >
                {isSubmitting ? 'Sending...' : 'Send'}
              </button>
            </form>

            <p className="text-xs text-slate-500 mt-4 text-center">
              First diagnostic is always free. I'll respond within a few hours.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
