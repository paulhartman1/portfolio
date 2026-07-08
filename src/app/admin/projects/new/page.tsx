'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/utils/supabase/client'

export default function AddProjectPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    subdomain: '',
    url: '',
    status: 'active'
  })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setMessage('')

    try {
      const { error } = await supabaseBrowser
        .from('projects')
        .insert({
          name: formData.name,
          description: formData.description,
          subdomain: formData.subdomain,
          url: formData.url,
          status: formData.status
        })

      if (error) throw error

      setStatus('success')
      setMessage('Project created successfully!')
      
      setTimeout(() => {
        router.push('/admin/projects')
      }, 1500)
      
    } catch (error) {
      console.error('Error creating project:', error)
      setStatus('error')
      setMessage((error as Error)?.message || 'Failed to create project')
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Add New Project</h1>
        <p className="text-white/80">Create a new preview site and assign clients later</p>
      </div>

      <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">

          <div>
            <label className="block text-white mb-2">Project Name *</label>
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white"
              placeholder="e.g., Main Website Redesign"
            />
          </div>

          <div>
            <label className="block text-white mb-2">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white"
              placeholder="Brief description of the project..."
            />
          </div>

          <div>
            <label className="block text-white mb-2">Subdomain *</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                name="subdomain"
                required
                value={formData.subdomain}
                onChange={handleChange}
                className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white"
                placeholder="clientname"
                pattern="[a-z0-9-]+"
              />
              <span className="text-white/60">.loveondev.com</span>
            </div>
            <p className="text-white/60 text-sm mt-1">
              Lowercase letters, numbers, and hyphens only
            </p>
          </div>

          <div>
            <label className="block text-white mb-2">Preview URL</label>
            <input
              type="url"
              name="url"
              value={formData.url}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white"
              placeholder="https://client.loveondev.com"
            />
            <p className="text-white/60 text-sm mt-1">
              The subdomain where clients can preview and comment on the site
            </p>
          </div>

          <div>
            <label className="block text-white mb-2">Status</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white [&>option]:bg-gray-900 [&>option]:text-white"
            >
              <option value="active" className="bg-gray-900 text-white">Active</option>
              <option value="paused" className="bg-gray-900 text-white">Paused</option>
              <option value="completed" className="bg-gray-900 text-white">Completed</option>
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
              disabled={status === 'loading'}
              className="px-6 py-3 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold hover:scale-105 transition-transform disabled:opacity-50"
            >
              {status === 'loading' ? 'Creating...' : 'Create Project'}
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
