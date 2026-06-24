'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/utils/supabase/client'

type Project = {
  id: string
  name: string
}

export default function AddClientPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    company: '',
    phone: '',
    pronouns: '',
    is_admin: false
  })
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadProjects()
  }, [])

  async function loadProjects() {
    const { data } = await supabaseBrowser
      .from('projects')
      .select('id, name')
      .order('name')
    
    if (data) {
      setProjects(data)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('sending')
    setMessage('')

    // Validation: clients must have at least one project, admins don't need projects
    if (!formData.is_admin && selectedProjects.length === 0) {
      setStatus('error')
      setMessage('Clients must be assigned to at least one project')
      return
    }

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
          is_admin: formData.is_admin,
          project_ids: selectedProjects,
        }),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to create client')

      setStatus('success')
      const roleText = formData.is_admin ? 'Admin' : 'Client'
      const projectText = selectedProjects.length > 0 ? ` and assigned to ${selectedProjects.length} project(s)` : ''
      setMessage(`${roleText} account created for ${formData.email}${projectText}. They can sign in with the password you set.`)
      
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
    const target = e.target
    const value = target.type === 'checkbox' ? (target as HTMLInputElement).checked : target.value
    
    setFormData({
      ...formData,
      [target.name]: value
    })
  }

  const toggleProject = (projectId: string) => {
    setSelectedProjects(prev => 
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    )
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

          <div className="pt-4 border-t border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                name="is_admin"
                id="is_admin"
                checked={formData.is_admin}
                onChange={handleChange}
                className="w-5 h-5 rounded bg-white/5 border border-white/20"
              />
              <label htmlFor="is_admin" className="text-white font-semibold">
                Admin Account (full access to all projects)
              </label>
            </div>
          </div>

          {!formData.is_admin && (
            <div>
              <label className="block text-white mb-2 font-semibold">
                Assign to Projects *
              </label>
              <p className="text-white/60 text-sm mb-3">
                Select one or more projects this client will have access to.
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {projects.length === 0 ? (
                  <p className="text-white/40 text-sm">No projects available</p>
                ) : (
                  projects.map(project => (
                    <div key={project.id} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={`project-${project.id}`}
                        checked={selectedProjects.includes(project.id)}
                        onChange={() => toggleProject(project.id)}
                        className="w-4 h-4 rounded bg-white/5 border border-white/20"
                      />
                      <label htmlFor={`project-${project.id}`} className="text-white">
                        {project.name}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

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
