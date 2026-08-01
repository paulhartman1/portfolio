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
        <h1 className="text-3xl font-bold text-[#1A0F2E] mb-2">Add New Project</h1>
        <p className="text-[#6B6785]">Create a new preview site and assign clients later</p>
      </div>

      <div className="bg-white border border-[#290D47]/15 rounded-2xl p-6 max-w-2xl shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">

          <div>
            <label className="block text-[#1A0F2E] mb-2">Project Name *</label>
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] placeholder:text-[#6B6785]"
              placeholder="e.g., Main Website Redesign"
            />
          </div>

          <div>
            <label className="block text-[#1A0F2E] mb-2">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] placeholder:text-[#6B6785]"
              placeholder="Brief description of the project..."
            />
          </div>

          <div>
            <label className="block text-[#1A0F2E] mb-2">Subdomain *</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                name="subdomain"
                required
                value={formData.subdomain}
                onChange={handleChange}
                className="flex-1 px-4 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] placeholder:text-[#6B6785]"
                placeholder="clientname"
                pattern="[a-z0-9-]+"
              />
              <span className="text-[#6B6785]">.loveondev.com</span>
            </div>
            <p className="text-[#6B6785] text-sm mt-1">
              Lowercase letters, numbers, and hyphens only
            </p>
          </div>

          <div>
            <label className="block text-[#1A0F2E] mb-2">Preview URL</label>
            <input
              type="url"
              name="url"
              value={formData.url}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] placeholder:text-[#6B6785]"
              placeholder="https://client.loveondev.com"
            />
            <p className="text-[#6B6785] text-sm mt-1">
              The subdomain where clients can preview and comment on the site
            </p>
          </div>

          <div>
            <label className="block text-[#1A0F2E] mb-2">Status</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] [&>option]:bg-white [&>option]:text-[#1A0F2E]"
            >
              <option value="active" className="bg-white text-[#1A0F2E]">Active</option>
              <option value="paused" className="bg-white text-[#1A0F2E]">Paused</option>
              <option value="completed" className="bg-white text-[#1A0F2E]">Completed</option>
            </select>
          </div>

          {status === 'success' && (
            <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-800">
              {message}
            </div>
          )}

          {status === 'error' && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800">
              {message}
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={status === 'loading'}
              className="px-6 py-3 rounded-lg bg-[#290D47] text-white font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {status === 'loading' ? 'Creating...' : 'Create Project'}
            </button>
            
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] hover:bg-[#F8F7F5]"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
