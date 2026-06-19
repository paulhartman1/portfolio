'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabaseBrowser } from '@/utils/supabase/client'

type Profile = {
  id: string
  email: string
  display_name: string | null
  company: string | null
  phone: string | null
  pronouns: string | null
  created_at: string
}

type Project = {
  id: string
  name: string
  subdomain: string
  status: string
  client_id: string | null
  created_at: string
}

type Comment = {
  id: string
  comment_text: string
  priority: 'low' | 'medium' | 'high'
  status: 'new' | 'in-progress' | 'resolved'
  url: string
  x_position: number
  y_position: number
  created_at: string
  projects: {
    name: string
  }
}

type Message = {
  id: string
  client_id: string
  sender_id: string
  message: string
  is_read: boolean
  created_at: string
  sender: {
    display_name: string | null
    email: string
    is_admin: boolean
  }
}

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const clientId = params.id as string

  const [client, setClient] = useState<Profile | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [allProjects, setAllProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [assigningProject, setAssigningProject] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)

  useEffect(() => {
    loadClientData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  async function loadClientData() {
    setLoading(true)

    // Load client profile
    const { data: profileData, error: profileError } = await supabaseBrowser
      .from('profiles')
      .select('*')
      .eq('id', clientId)
      .single()

    if (profileError) {
      console.error('Error loading client:', profileError)
      setLoading(false)
      return
    }

    setClient(profileData)

    // Load client's projects
    const { data: projectsData } = await supabaseBrowser
      .from('projects')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })

    setProjects(projectsData || [])

    // Load client's comments
    const { data: commentsData } = await supabaseBrowser
      .from('review_comments')
      .select(`
        *,
        projects (name)
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })

    setComments(commentsData || [])

    // Load messages
    const { data: messagesData } = await supabaseBrowser
      .from('client_messages')
      .select(`
        *,
        sender:sender_id (
          display_name,
          email,
          is_admin
        )
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: true })

    setMessages(messagesData || [])

    // Load all projects for assignment dropdown
    const { data: allProjectsData } = await supabaseBrowser
      .from('projects')
      .select('*')
      .order('name')

    setAllProjects(allProjectsData || [])

    setLoading(false)
  }

  async function assignProject() {
    if (!selectedProjectId) return

    setAssigningProject(true)
    const { error } = await supabaseBrowser
      .from('projects')
      .update({ client_id: clientId })
      .eq('id', selectedProjectId)

    if (error) {
      console.error('Error assigning project:', error)
      alert('Failed to assign project')
    } else {
      setSelectedProjectId('')
      loadClientData()
    }
    setAssigningProject(false)
  }

  async function unassignProject(projectId: string) {
    if (!confirm('Remove this project from this client?')) return

    const { error } = await supabaseBrowser
      .from('projects')
      .update({ client_id: null })
      .eq('id', projectId)

    if (error) {
      console.error('Error unassigning project:', error)
      alert('Failed to remove project')
    } else {
      loadClientData()
    }
  }

  async function updateCommentStatus(id: string, newStatus: 'new' | 'in-progress' | 'resolved') {
    const { error } = await supabaseBrowser
      .from('review_comments')
      .update({ status: newStatus })
      .eq('id', id)

    if (error) {
      console.error('Error updating status:', error)
    } else {
      loadClientData()
    }
  }

  async function sendMessage() {
    if (!newMessage.trim()) return

    setSendingMessage(true)
    const { data: userData } = await supabaseBrowser.auth.getUser()
    
    if (!userData.user) {
      alert('You must be logged in to send messages')
      setSendingMessage(false)
      return
    }

    const { error } = await supabaseBrowser
      .from('client_messages')
      .insert({
        client_id: clientId,
        sender_id: userData.user.id,
        message: newMessage.trim(),
      })

    if (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message')
    } else {
      setNewMessage('')
      loadClientData()
    }
    setSendingMessage(false)
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500/20 text-red-200 border-red-500/50'
      case 'medium': return 'bg-yellow-500/20 text-yellow-200 border-yellow-500/50'
      case 'low': return 'bg-green-500/20 text-green-200 border-green-500/50'
      default: return 'bg-white/20 text-white border-white/30'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-500/20 text-blue-200'
      case 'in-progress': return 'bg-purple-500/20 text-purple-200'
      case 'resolved': return 'bg-green-500/20 text-green-200'
      default: return 'bg-white/20 text-white'
    }
  }

  if (loading) {
    return <div className="text-white text-center py-12">Loading...</div>
  }

  if (!client) {
    return <div className="text-white text-center py-12">Client not found</div>
  }

  // Filter out projects already assigned to this client
  const availableProjects = allProjects.filter(p => p.client_id !== clientId)

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="text-white/60 hover:text-white mb-4"
        >
          ← Back to clients
        </button>
        <h1 className="text-4xl font-bold text-white mb-2">
          {client.display_name || client.email}
        </h1>
        <div className="text-white/80 space-y-1">
          <p>{client.email}</p>
          {client.company && <p>{client.company}</p>}
          {client.phone && <p>{client.phone}</p>}
          {client.pronouns && <p className="text-sm">{client.pronouns}</p>}
        </div>
      </div>

      {/* Projects Section */}
      <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 mb-6">
        <h2 className="text-2xl font-semibold text-white mb-4">Projects</h2>

        {/* Assign Project */}
        <div className="mb-6 flex gap-2">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white [&>option]:bg-gray-900 [&>option]:text-white"
          >
            <option value="" className="bg-gray-900 text-white">Select a project to assign...</option>
            {availableProjects.map((project) => (
              <option key={project.id} value={project.id} className="bg-gray-900 text-white">
                {project.name}
              </option>
            ))}
          </select>
          <button
            onClick={assignProject}
            disabled={!selectedProjectId || assigningProject}
            className="px-6 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
          >
            {assigningProject ? 'Assigning...' : 'Assign Project'}
          </button>
        </div>

        {/* Projects List */}
        {projects.length === 0 ? (
          <p className="text-white/60 text-center py-6">No projects assigned yet</p>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-white/5 border border-white/20 rounded-lg p-4 flex justify-between items-center"
              >
                <div>
                  <h3 className="text-lg font-semibold text-white">{project.name}</h3>
                  <p className="text-white/60 text-sm">
                    {project.subdomain}.loveondev.com
                  </p>
                  <p className="text-white/40 text-sm capitalize">Status: {project.status}</p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/admin/projects/${project.id}`}
                    className="px-4 py-2 rounded-lg bg-white/20 text-white hover:bg-white/30 text-sm"
                  >
                    View
                  </Link>
                  <button
                    onClick={() => unassignProject(project.id)}
                    className="px-4 py-2 rounded-lg bg-red-500/20 text-red-200 hover:bg-red-500/30 text-sm"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Messages Section */}
      <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 mb-6">
        <h2 className="text-2xl font-semibold text-white mb-4">
          Messages ({messages.length})
        </h2>

        {/* Messages Thread */}
        <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-white/60 text-center py-6">No messages yet</p>
          ) : (
            messages.map((msg) => {
              const isAdmin = msg.sender?.is_admin || false
              return (
                <div
                  key={msg.id}
                  className={`p-4 rounded-lg ${
                    isAdmin
                      ? 'bg-purple-500/20 border border-purple-500/30 ml-8'
                      : 'bg-white/5 border border-white/20 mr-8'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">
                        {msg.sender?.display_name || msg.sender?.email || 'Unknown'}
                      </span>
                      {isAdmin && (
                        <span className="px-2 py-0.5 bg-purple-500/50 text-purple-100 text-xs rounded uppercase font-semibold">
                          Admin
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-white/50">
                      {new Date(msg.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-white/90 whitespace-pre-wrap">{msg.message}</p>
                </div>
              )
            })
          )}
        </div>

        {/* Send Message Form */}
        <div className="space-y-2">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                sendMessage()
              }
            }}
            placeholder="Type your message... (Ctrl/Cmd+Enter to send)"
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder:text-white/40 resize-none focus:outline-none focus:border-purple-500/50"
            rows={3}
          />
          <div className="flex justify-end">
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sendingMessage}
              className="px-6 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
            >
              {sendingMessage ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </div>
      </div>

      {/* Comments Section */}
      <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
        <h2 className="text-2xl font-semibold text-white mb-4">
          Review Comments ({comments.length})
        </h2>

        {comments.length === 0 ? (
          <p className="text-white/60 text-center py-6">No comments yet</p>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="bg-white/5 border border-white/20 rounded-lg p-4">
                <div className="flex gap-2 mb-3">
                  <span className={`px-2 py-1 rounded text-xs font-semibold uppercase border ${getPriorityColor(comment.priority)}`}>
                    {comment.priority}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${getStatusColor(comment.status)}`}>
                    {comment.status}
                  </span>
                </div>

                <p className="text-white mb-3">{comment.comment_text}</p>

                <div className="text-sm text-white/60 mb-3 space-y-1">
                  <p><strong>Project:</strong> {comment.projects?.name || 'Unknown'}</p>
                  <p><strong>URL:</strong> {comment.url}</p>
                  <p><strong>Created:</strong> {new Date(comment.created_at).toLocaleString()}</p>
                </div>

                {/* Status Update Buttons */}
                <div className="flex gap-2">
                  {comment.status !== 'new' && (
                    <button
                      onClick={() => updateCommentStatus(comment.id, 'new')}
                      className="px-3 py-1 bg-blue-500/20 text-blue-200 rounded text-sm hover:bg-blue-500/30"
                    >
                      New
                    </button>
                  )}
                  {comment.status !== 'in-progress' && (
                    <button
                      onClick={() => updateCommentStatus(comment.id, 'in-progress')}
                      className="px-3 py-1 bg-purple-500/20 text-purple-200 rounded text-sm hover:bg-purple-500/30"
                    >
                      In Progress
                    </button>
                  )}
                  {comment.status !== 'resolved' && (
                    <button
                      onClick={() => updateCommentStatus(comment.id, 'resolved')}
                      className="px-3 py-1 bg-green-500/20 text-green-200 rounded text-sm hover:bg-green-500/30"
                    >
                      ✓ Resolved
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
