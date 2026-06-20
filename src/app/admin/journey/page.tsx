'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabaseBrowser } from '@/utils/supabase/client'

type Project = {
  id: string
  name: string
  subdomain: string
  client_id: string
  profiles: {
    display_name: string | null
    email: string
  } | null
}

type JourneyMap = {
  id: string
  project_id: string
  title: string
  slug: string
  description: string | null
  is_public: boolean
  created_at: string
}

export default function AdminJourneyPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [journeyMaps, setJourneyMaps] = useState<JourneyMap[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)
  
  // Form state
  const [newMapTitle, setNewMapTitle] = useState('')
  const [newMapSlug, setNewMapSlug] = useState('')
  const [newMapDescription, setNewMapDescription] = useState('')
  const [newMapIsPublic, setNewMapIsPublic] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)

    // Load all projects with clients
    const { data: projectsData } = await supabaseBrowser
      .from('projects')
      .select(`
        id,
        name,
        subdomain,
        client_id,
        profiles!client_id (
          display_name,
          email
        )
      `)
      .order('name')

    setProjects((projectsData as unknown as Project[]) || [])

    // Load all journey maps
    const { data: mapsData } = await supabaseBrowser
      .from('journey_maps')
      .select('*')
      .order('created_at', { ascending: false })

    setJourneyMaps(mapsData || [])

    setLoading(false)
  }

  async function createJourneyMap() {
    if (!selectedProjectId || !newMapTitle || !newMapSlug) {
      alert('Please fill in project, title, and slug')
      return
    }

    setCreating(true)
    const { data: userData } = await supabaseBrowser.auth.getUser()

    const { data, error } = await supabaseBrowser
      .from('journey_maps')
      .insert({
        project_id: selectedProjectId,
        title: newMapTitle,
        slug: newMapSlug,
        description: newMapDescription || null,
        is_public: newMapIsPublic,
        created_by: userData.user?.id || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating journey map:', error)
      alert(`Failed to create journey map: ${error.message}`)
    } else {
      // Reset form
      setShowCreateForm(false)
      setSelectedProjectId('')
      setNewMapTitle('')
      setNewMapSlug('')
      setNewMapDescription('')
      setNewMapIsPublic(false)
      loadData()
      
      // Navigate to edit the new map
      if (data?.id) {
        router.push(`/admin/journey/${data.id}`)
      }
    }
    setCreating(false)
  }

  async function deleteJourneyMap(id: string) {
    if (!confirm('Delete this journey map? This will also delete all its notes.')) return

    const { error } = await supabaseBrowser
      .from('journey_maps')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting journey map:', error)
      alert('Failed to delete journey map')
    } else {
      loadData()
    }
  }

  function generateSlug(title: string) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  if (loading) {
    return <div className="text-white text-center py-12">Loading...</div>
  }

  const selectedProject = projects.find(p => p.id === selectedProjectId)

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Journey Maps</h1>
        <p className="text-white/80">Create and manage user journey maps for client projects</p>
      </div>

      {/* Create New Journey Map */}
      <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-white">
            {showCreateForm ? 'New Journey Map' : 'Journey Maps'}
          </h2>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold hover:scale-105 transition-transform"
          >
            {showCreateForm ? 'Cancel' : '+ Create Journey Map'}
          </button>
        </div>

        {showCreateForm && (
          <div className="space-y-4 border-t border-white/20 pt-4">
            {/* Project Selection */}
            <div>
              <label className="block text-white/80 mb-2 text-sm font-semibold">
                Project *
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white [&>option]:bg-gray-900"
              >
                <option value="">Select a project...</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} - {project.profiles?.display_name || project.profiles?.email}
                  </option>
                ))}
              </select>
              {selectedProject && (
                <p className="text-white/60 text-sm mt-1">
                  Will be accessible at: /portal/{selectedProject.subdomain}/journey
                </p>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="block text-white/80 mb-2 text-sm font-semibold">
                Title *
              </label>
              <input
                type="text"
                value={newMapTitle}
                onChange={(e) => {
                  setNewMapTitle(e.target.value)
                  if (!newMapSlug) {
                    setNewMapSlug(generateSlug(e.target.value))
                  }
                }}
                placeholder="e.g. Customer Onboarding Journey"
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder:text-white/40"
              />
            </div>

            {/* Slug */}
            <div>
              <label className="block text-white/80 mb-2 text-sm font-semibold">
                Slug * (for public URL)
              </label>
              <input
                type="text"
                value={newMapSlug}
                onChange={(e) => setNewMapSlug(e.target.value)}
                placeholder="customer-onboarding-journey"
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder:text-white/40 font-mono text-sm"
              />
              {newMapIsPublic && newMapSlug && (
                <p className="text-white/60 text-sm mt-1">
                  Public URL: /journey/{newMapSlug}
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-white/80 mb-2 text-sm font-semibold">
                Description
              </label>
              <textarea
                value={newMapDescription}
                onChange={(e) => setNewMapDescription(e.target.value)}
                placeholder="Optional description of this journey map"
                rows={3}
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder:text-white/40"
              />
            </div>

            {/* Public Toggle */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is-public"
                checked={newMapIsPublic}
                onChange={(e) => setNewMapIsPublic(e.target.checked)}
                className="w-5 h-5"
              />
              <label htmlFor="is-public" className="text-white/80">
                Make this journey map public (accessible at /journey/[slug])
              </label>
            </div>

            {/* Create Button */}
            <div className="flex justify-end pt-2">
              <button
                onClick={createJourneyMap}
                disabled={!selectedProjectId || !newMapTitle || !newMapSlug || creating}
                className="px-6 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
              >
                {creating ? 'Creating...' : 'Create Journey Map'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Existing Journey Maps */}
      <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
        <h2 className="text-2xl font-semibold text-white mb-4">
          All Journey Maps ({journeyMaps.length})
        </h2>

        {journeyMaps.length === 0 ? (
          <p className="text-white/60 text-center py-6">
            No journey maps yet. Create one to get started!
          </p>
        ) : (
          <div className="space-y-3">
            {journeyMaps.map((map) => {
              const project = projects.find(p => p.id === map.project_id)
              return (
                <div
                  key={map.id}
                  className="bg-white/5 border border-white/20 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-white">{map.title}</h3>
                        {map.is_public && (
                          <span className="px-2 py-0.5 bg-green-500/20 text-green-200 text-xs rounded font-semibold">
                            PUBLIC
                          </span>
                        )}
                      </div>
                      <p className="text-white/60 text-sm mb-2">
                        {project?.name || 'Unknown Project'} - {project?.profiles?.display_name || project?.profiles?.email}
                      </p>
                      {map.description && (
                        <p className="text-white/70 text-sm mb-2">{map.description}</p>
                      )}
                      <div className="flex gap-4 text-xs text-white/50">
                        <span>Slug: {map.slug}</span>
                        <span>Created: {new Date(map.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/journey/${map.id}`}
                        className="px-4 py-2 rounded-lg bg-white/20 text-white hover:bg-white/30 text-sm font-semibold"
                      >
                        Edit
                      </Link>
                      {map.is_public && (
                        <Link
                          href={`/journey/${map.slug}`}
                          target="_blank"
                          className="px-4 py-2 rounded-lg bg-blue-500/20 text-blue-200 hover:bg-blue-500/30 text-sm font-semibold"
                        >
                          View Public
                        </Link>
                      )}
                      <button
                        onClick={() => deleteJourneyMap(map.id)}
                        className="px-4 py-2 rounded-lg bg-red-500/20 text-red-200 hover:bg-red-500/30 text-sm font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
