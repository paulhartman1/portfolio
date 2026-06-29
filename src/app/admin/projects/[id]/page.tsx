'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabaseBrowser } from '@/utils/supabase/client'

type Project = {
  id: string
  name: string
  description: string | null
  subdomain: string | null
  url: string | null
  status: string
  created_at: string
  github_repo: string | null
  github_branch: string | null
  last_commit_sha: string | null
}

type ProjectUpdate = {
  id: string
  title: string | null
  body: string
  author_role: 'developer' | 'client' | 'system' | 'github'
  commit_sha: string | null
  commit_url: string | null
  created_at: string
}

type Client = {
  id: string
  email: string
  display_name: string | null
  company: string | null
}

type ProjectClientRow = {
  client_id: string
  profiles: Client | Client[] | null
}

type Message = {
  id: string
  project_id: string
  sender_id: string
  message: string
  is_read: boolean
  created_at: string
  sender: {
    display_name: string | null
    email: string
    is_admin: boolean
  } | null
}

type MessageRow = Omit<Message, 'sender'> & {
  sender: Message['sender'] | Message['sender'][]
}

type LoadStatus = 'loading' | 'ready' | 'not-found' | 'error'
type SendStatus = 'idle' | 'sending' | 'sent' | 'error'

export default function ManageProjectPage() {
  const params = useParams()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [allClients, setAllClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [messageText, setMessageText] = useState('')
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading')
  const [sendStatus, setSendStatus] = useState<SendStatus>('idle')
  const [notice, setNotice] = useState('')
  const [showAddClient, setShowAddClient] = useState(false)
  const [addingClient, setAddingClient] = useState(false)
  const [updates, setUpdates] = useState<ProjectUpdate[]>([])
  const [githubRepo, setGithubRepo] = useState('')
  const [githubBranch, setGithubBranch] = useState('main')
  const [savingGitHub, setSavingGitHub] = useState(false)

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) || null,
    [clients, selectedClientId]
  )

  useEffect(() => {
    loadProject()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  useEffect(() => {
    if (projectId) {
      loadMessages()
      loadUpdates()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  async function loadProject() {
    setLoadStatus('loading')
    setNotice('')

    const { data: userData } = await supabaseBrowser.auth.getUser()
    setCurrentUserId(userData.user?.id || null)

    const { data: projectData, error: projectError} = await supabaseBrowser
      .from('projects')
      .select('id, name, description, subdomain, url, status, created_at, github_repo, github_branch, last_commit_sha')
      .eq('id', projectId)
      .single()

    if (projectError) {
      console.error('Error loading project:', projectError)
      setLoadStatus(projectError.code === 'PGRST116' ? 'not-found' : 'error')
      return
    }

    setProject(projectData)
    setGithubRepo(projectData.github_repo || '')
    setGithubBranch(projectData.github_branch || 'main')

    const { data: clientRows, error: clientError } = await supabaseBrowser
      .from('project_clients')
      .select(`
        client_id,
        profiles:client_id (
          id,
          email,
          display_name,
          company
        )
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })

    if (clientError) {
      console.error('Error loading project clients:', clientError)
      setLoadStatus('error')
      return
    }

    const assignedClients = (clientRows as ProjectClientRow[] | null || [])
      .map((row) => Array.isArray(row.profiles) ? row.profiles[0] : row.profiles)
      .filter((client): client is Client => Boolean(client))

    setClients(assignedClients)
    setSelectedClientId((current) => current || assignedClients[0]?.id || '')

    // Load all clients for the add client dropdown
    const { data: allClientsData, error: allClientsError } = await supabaseBrowser
      .from('profiles')
      .select('id, email, display_name, company')
      .eq('is_admin', false)
      .order('display_name')

    if (!allClientsError && allClientsData) {
      setAllClients(allClientsData)
    }

    setLoadStatus('ready')
  }

  async function loadMessages() {
    const { data, error } = await supabaseBrowser
      .from('client_messages')
      .select(`
        id,
        project_id,
        sender_id,
        message,
        is_read,
        created_at,
        sender:sender_id (
          display_name,
          email,
          is_admin
        )
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error loading messages:', error)
      setNotice('Could not load the message thread.')
      return
    }

    const normalizedMessages = (data as MessageRow[] | null || []).map((row) => ({
      ...row,
      sender: Array.isArray(row.sender) ? row.sender[0] : row.sender,
    }))

    setMessages(normalizedMessages)
  }

  async function loadUpdates() {
    const { data, error } = await supabaseBrowser
      .from('project_updates')
      .select('id, title, body, author_role, commit_sha, commit_url, created_at')
      .eq('project_id', projectId)
      .eq('is_internal', false)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error loading updates:', error)
      return
    }

    setUpdates(data || [])
  }

  async function saveGitHubConfig() {
    setSavingGitHub(true)

    try {
      const response = await fetch(`/api/admin/projects/${projectId}/github-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          github_repo: githubRepo || null,
          github_branch: githubBranch || 'main',
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save')
      }

      const result = await response.json()
      setProject((prev) => prev ? { ...prev, ...result.project } : null)
      alert('GitHub configuration saved successfully')
    } catch (error) {
      console.error('Error saving GitHub config:', error)
      alert(error instanceof Error ? error.message : 'Failed to save GitHub configuration')
    } finally {
      setSavingGitHub(false)
    }
  }

  async function sendMessage() {
    if (!messageText.trim() || !currentUserId) return

    setSendStatus('sending')
    setNotice('')

    const { error } = await supabaseBrowser
      .from('client_messages')
      .insert({
        project_id: projectId,
        sender_id: currentUserId,
        message: messageText.trim(),
      })

    if (error) {
      console.error('Error sending message:', error)
      setSendStatus('error')
      setNotice(error.message || 'Message could not be sent.')
      return
    }

    setMessageText('')
    setSendStatus('sent')
    setNotice('Message sent.')
    await loadMessages()
  }

  async function addClientToProject(clientId: string) {
    setAddingClient(true)

    const { error } = await supabaseBrowser
      .from('project_clients')
      .insert({
        project_id: projectId,
        client_id: clientId,
      })

    if (error) {
      console.error('Error adding client:', error)
      alert('Failed to add client to project')
      setAddingClient(false)
      return
    }

    setAddingClient(false)
    setShowAddClient(false)
    await loadProject()
  }

  async function removeClientFromProject(clientId: string) {
    if (!confirm('Remove this client from the project?')) return

    const { error } = await supabaseBrowser
      .from('project_clients')
      .delete()
      .eq('project_id', projectId)
      .eq('client_id', clientId)

    if (error) {
      console.error('Error removing client:', error)
      alert('Failed to remove client from project')
      return
    }

    await loadProject()
    if (selectedClientId === clientId) {
      setSelectedClientId('')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200'
      case 'paused': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'completed': return 'bg-blue-100 text-blue-800 border-blue-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  if (loadStatus === 'loading') {
    return <div className="text-white text-center py-12">Loading project...</div>
  }

  if (loadStatus === 'not-found') {
    return (
      <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
        <h1 className="text-3xl font-bold text-white mb-2">Project not found</h1>
        <Link href="/admin/projects" className="text-blue-200 hover:text-blue-100">
          Back to projects
        </Link>
      </div>
    )
  }

  if (loadStatus === 'error' || !project) {
    return (
      <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
        <h1 className="text-3xl font-bold text-white mb-2">Could not load project</h1>
        <p className="text-white/70 mb-4">Refresh the page or return to the project list.</p>
        <Link href="/admin/projects" className="text-blue-200 hover:text-blue-100">
          Back to projects
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <Link href="/admin/projects" className="text-blue-200 hover:text-blue-100 text-sm">
          ← Back to projects
        </Link>
        <div className="flex flex-wrap items-center gap-3 mt-3 mb-2">
          <h1 className="text-4xl font-bold text-white">{project.name}</h1>
          <span className={`px-2 py-1 rounded text-xs font-semibold uppercase border ${getStatusColor(project.status)}`}>
            {project.status}
          </span>
        </div>
        <p className="text-white/80">
          {project.description || 'Manage project details and client communication.'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <section className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 h-fit">
          <h2 className="text-2xl font-semibold text-white mb-4">Project Details</h2>
          <div className="space-y-4 text-sm">
            {project.url && (
              <div>
                <p className="text-white/50 uppercase tracking-wide text-xs mb-1">Preview URL</p>
                <a
                  href={project.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-200 hover:text-blue-100 break-all"
                >
                  {project.url}
                </a>
              </div>
            )}

            {project.subdomain && (
              <div>
                <p className="text-white/50 uppercase tracking-wide text-xs mb-1">Subdomain</p>
                <p className="text-white">{project.subdomain}</p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-white/50 uppercase tracking-wide text-xs">Assigned Clients</p>
                <button
                  onClick={() => setShowAddClient(!showAddClient)}
                  className="text-xs text-blue-200 hover:text-blue-100"
                >
                  + Add Client
                </button>
              </div>

              {showAddClient && (
                <div className="mb-3 p-3 rounded-lg bg-white/5 border border-white/20">
                  <p className="text-white/80 text-sm mb-2">Select a client to add:</p>
                  <select
                    onChange={(e) => e.target.value && addClientToProject(e.target.value)}
                    disabled={addingClient}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm"
                  >
                    <option value="">-- Select Client --</option>
                    {allClients
                      .filter((c) => !clients.some((assigned) => assigned.id === c.id))
                      .map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.display_name || client.email}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {clients.length === 0 ? (
                <p className="text-white/60">No clients are assigned to this project yet.</p>
              ) : (
                <div className="space-y-2">
                  {clients.map((client) => (
                    <div
                      key={client.id}
                      className={`rounded-lg border px-3 py-2 ${
                        selectedClientId === client.id
                          ? 'bg-purple-500/25 border-purple-300/60'
                          : 'bg-white/5 border-white/20'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedClientId(client.id)}
                        className="w-full text-left"
                      >
                        <span className="block font-semibold text-white">
                          {client.display_name || client.email}
                        </span>
                        {client.company && (
                          <span className="block text-xs text-white/60">{client.company}</span>
                        )}
                      </button>
                      <button
                        onClick={() => removeClientFromProject(client.id)}
                        className="mt-1 text-xs text-red-300 hover:text-red-200"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-white/20 pt-4 mt-4">
              <p className="text-white/50 uppercase tracking-wide text-xs mb-3">Actions</p>
              <Link
                href={`/admin/projects/${projectId}/payment-link`}
                className="block w-full px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium text-center mb-4"
              >
                💳 Create Payment Link
              </Link>
            </div>

            <div className="border-t border-white/20 pt-4 mt-4">
              <p className="text-white/50 uppercase tracking-wide text-xs mb-3">GitHub Integration</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-white/70 text-xs mb-1">Repository (owner/repo)</label>
                  <input
                    type="text"
                    value={githubRepo}
                    onChange={(e) => setGithubRepo(e.target.value)}
                    placeholder="paulhartman1/portfolio"
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder:text-white/40"
                  />
                </div>
                <div>
                  <label className="block text-white/70 text-xs mb-1">Branch</label>
                  <input
                    type="text"
                    value={githubBranch}
                    onChange={(e) => setGithubBranch(e.target.value)}
                    placeholder="main"
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder:text-white/40"
                  />
                </div>
                {project?.last_commit_sha && (
                  <div>
                    <label className="block text-white/70 text-xs mb-1">Last Synced Commit</label>
                    <p className="text-white/80 text-xs font-mono">{project.last_commit_sha.substring(0, 7)}</p>
                  </div>
                )}
                <button
                  onClick={saveGitHubConfig}
                  disabled={savingGitHub}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-medium disabled:opacity-50"
                >
                  {savingGitHub ? 'Saving...' : 'Save GitHub Config'}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-2xl font-semibold text-white">Ideas & Messages</h2>
              <p className="text-white/70 text-sm">
                {selectedClient
                  ? `Sending to ${selectedClient.display_name || selectedClient.email}`
                  : 'Assign a client before sending messages.'}
              </p>
            </div>
            {messages.length > 0 && (
              <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/70 text-xs">
                {messages.length} total
              </span>
            )}
          </div>

          <div className="space-y-3 mb-4 max-h-[28rem] overflow-y-auto">
            {!selectedClientId ? (
              <p className="text-white/60 text-center py-8">
                Select or assign a client to start a conversation.
              </p>
            ) : messages.length === 0 ? (
              <p className="text-white/60 text-center py-8">
                No messages yet. Send the first idea or update.
              </p>
            ) : (
              messages.map((msg) => {
                const isSelf = msg.sender_id === currentUserId
                const isAdmin = msg.sender?.is_admin || false

                return (
                  <div
                    key={msg.id}
                    className={`p-4 rounded-lg ${
                      isSelf
                        ? 'bg-purple-500/20 border border-purple-500/30 ml-8'
                        : 'bg-white/5 border border-white/20 mr-8'
                    }`}
                  >
                    <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">
                          {isSelf ? 'You' : (msg.sender?.display_name || msg.sender?.email || 'Client')}
                        </span>
                        {isAdmin && (
                          <span className="px-2 py-0.5 bg-purple-500/50 text-purple-100 text-xs rounded uppercase font-semibold">
                            Studio
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

          <div className="space-y-2">
            <textarea
              value={messageText}
              onChange={(event) => {
                setMessageText(event.target.value)
                if (sendStatus !== 'idle') {
                  setSendStatus('idle')
                  setNotice('')
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  sendMessage()
                }
              }}
              disabled={!selectedClientId || sendStatus === 'sending'}
              placeholder="Share an idea, update, or question... (Ctrl/Cmd+Enter to send)"
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder:text-white/40 resize-none focus:outline-none focus:border-purple-500/50 disabled:opacity-50"
              rows={4}
            />

            {notice && (
              <p className={`text-sm ${sendStatus === 'error' ? 'text-red-200' : 'text-green-200'}`}>
                {notice}
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={sendMessage}
                disabled={!selectedClientId || !messageText.trim() || sendStatus === 'sending'}
                className="px-6 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
              >
                {sendStatus === 'sending' ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-6">
        <section className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
          <h2 className="text-2xl font-semibold text-white mb-4">Recent Updates</h2>
          <div className="space-y-3">
            {updates.length === 0 ? (
              <p className="text-white/60 text-center py-8">No project updates yet.</p>
            ) : (
              updates.map((update) => (
                <div
                  key={update.id}
                  className="bg-white/5 border border-white/20 rounded-lg p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      {update.author_role === 'github' && (
                        <span className="px-2 py-0.5 bg-slate-500/50 text-slate-100 text-xs rounded uppercase font-semibold flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                          </svg>
                          GitHub
                        </span>
                      )}
                      {update.author_role === 'developer' && (
                        <span className="px-2 py-0.5 bg-purple-500/50 text-purple-100 text-xs rounded uppercase font-semibold">
                          Developer
                        </span>
                      )}
                      {update.author_role === 'system' && (
                        <span className="px-2 py-0.5 bg-blue-500/50 text-blue-100 text-xs rounded uppercase font-semibold">
                          System
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-white/50">
                      {new Date(update.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-white font-medium mb-1">{update.title || 'Update'}</p>
                  <p className="text-white/85 text-sm whitespace-pre-wrap">{update.body}</p>
                  {update.commit_url && (
                    <a
                      href={update.commit_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-xs text-blue-200 hover:text-blue-100"
                    >
                      View commit
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
