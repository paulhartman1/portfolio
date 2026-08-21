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
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)

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
      setInviteLink(result.actionLink || '')
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

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy invite link:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      email: '',
      first_name: '',
      last_name: '',
      company: '',
      phone: '',
      pronouns: '',
      is_admin: false
    })
    setSelectedProjects([])
    setStatus('idle')
    setMessage('')
    setInviteLink('')
    setCopied(false)
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1A0F2E] mb-2">Add New Client</h1>
        <p className="text-[#6B6785]">Invite a client with magic link authentication</p>
      </div>

      <div className="bg-white border border-[#290D47]/15 rounded-2xl p-6 max-w-2xl shadow-sm">
        {status === 'success' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-[#1A0F2E] mb-2 font-semibold">Invite Link</label>
              <p className="text-[#6B6785] text-sm mb-3">
                Copy this link and send it to the client yourself.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteLink}
                  onFocus={(e) => e.target.select()}
                  className="w-full px-4 py-2 rounded-lg bg-[#F8F7F5] border border-[#E8E4EF] text-[#1A0F2E] text-sm"
                />
                <button
                  type="button"
                  onClick={copyInviteLink}
                  className="px-4 py-2 rounded-lg bg-[#290D47] text-white font-semibold hover:opacity-90 whitespace-nowrap"
                >
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-3 rounded-lg bg-[#290D47] text-white font-semibold hover:opacity-90"
              >
                Add Another Client
              </button>

              <button
                type="button"
                onClick={() => router.push('/admin')}
                className="px-6 py-3 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] hover:bg-[#F8F7F5]"
              >
                Back to Admin
              </button>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[#1A0F2E] mb-2">Email *</label>
            <input
              type="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] placeholder:text-[#6B6785]"
              placeholder="client@example.com"
            />
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-[#1A0F2E] text-sm">
              <strong>🔐 Magic Link Login:</strong> No password needed. You&apos;ll get a secure login link to copy and send to the client yourself.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[#1A0F2E] mb-2">First Name</label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] placeholder:text-[#6B6785]"
              />
            </div>

            <div>
              <label className="block text-[#1A0F2E] mb-2">Last Name</label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] placeholder:text-[#6B6785]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[#1A0F2E] mb-2">Company</label>
            <input
              type="text"
              name="company"
              value={formData.company}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] placeholder:text-[#6B6785]"
            />
          </div>

          <div>
            <label className="block text-[#1A0F2E] mb-2">Phone</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] placeholder:text-[#6B6785]"
            />
          </div>

          <div>
            <label className="block text-[#1A0F2E] mb-2">Pronouns</label>
            <select
              name="pronouns"
              value={formData.pronouns}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] [&>option]:bg-white [&>option]:text-[#1A0F2E]"
            >
              <option value="" className="bg-white text-[#1A0F2E]">Select...</option>
              <option value="she/her" className="bg-white text-[#1A0F2E]">She/Her</option>
              <option value="he/him" className="bg-white text-[#1A0F2E]">He/Him</option>
              <option value="they/them" className="bg-white text-[#1A0F2E]">They/Them</option>
              <option value="other" className="bg-white text-[#1A0F2E]">Other</option>
            </select>
          </div>

          <div className="pt-4 border-t border-[#E8E4EF]">
            <div className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                name="is_admin"
                id="is_admin"
                checked={formData.is_admin}
                onChange={handleChange}
                className="w-5 h-5 rounded border border-[#E8E4EF]"
              />
              <label htmlFor="is_admin" className="text-[#1A0F2E] font-semibold">
                Admin Account (full access to all projects)
              </label>
            </div>
          </div>

          {!formData.is_admin && (
            <div>
              <label className="block text-[#1A0F2E] mb-2 font-semibold">
                Assign to Projects *
              </label>
              <p className="text-[#6B6785] text-sm mb-3">
                Select one or more projects this client will have access to.
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {projects.length === 0 ? (
                  <p className="text-[#6B6785] text-sm">No projects available</p>
                ) : (
                  projects.map(project => (
                    <div key={project.id} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={`project-${project.id}`}
                        checked={selectedProjects.includes(project.id)}
                        onChange={() => toggleProject(project.id)}
                        className="w-4 h-4 rounded border border-[#E8E4EF]"
                      />
                      <label htmlFor={`project-${project.id}`} className="text-[#1A0F2E]">
                        {project.name}
                      </label>
                    </div>
                  ))
                )}
              </div>
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
              disabled={status === 'sending'}
              className="px-6 py-3 rounded-lg bg-[#290D47] text-white font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {status === 'sending' ? 'Creating...' : 'Create Client'}
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
        )}
      </div>
    </div>
  )
}
