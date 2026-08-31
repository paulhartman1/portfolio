'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabaseBrowser } from '@/utils/supabase/client'
import EngagementRecordings from '@/components/EngagementRecordings'
import { AskCgt } from '@/components/AskCgt'
import ProjectExperiments from '@/components/ProjectExperiments'
import ProjectProposals from '@/components/ProjectProposals'

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
  proposal_slug: string | null
  notification_email: string | null
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
  const [proposalSlug, setProposalSlug] = useState('')
  const [savedProposalSlug, setSavedProposalSlug] = useState('')
  const [savingProposal, setSavingProposal] = useState(false)
  const [notificationEmail, setNotificationEmail] = useState('')
  const [savingNotificationEmail, setSavingNotificationEmail] = useState(false)
  const [sendEmailNotification, setSendEmailNotification] = useState(false)
  const [notifyRecipientIds, setNotifyRecipientIds] = useState<string[]>([])

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
      .select('id, name, description, subdomain, url, status, created_at, github_repo, github_branch, last_commit_sha, proposal_slug, notification_email')
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
    setProposalSlug(projectData.proposal_slug || '')
    setSavedProposalSlug(projectData.proposal_slug || '')
    setNotificationEmail(projectData.notification_email || '')

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

  async function saveProposalSlug() {
    setSavingProposal(true)

    try {
      const { error } = await supabaseBrowser
        .from('projects')
        .update({ proposal_slug: proposalSlug || null })
        .eq('id', projectId)

      if (error) throw error

      setProject((prev) => prev ? { ...prev, proposal_slug: proposalSlug || null } : null)
      setSavedProposalSlug(proposalSlug)
      alert('Proposal saved successfully')
    } catch (error) {
      console.error('Error saving proposal:', error)
      alert(error instanceof Error ? error.message : 'Failed to save proposal')
    } finally {
      setSavingProposal(false)
    }
  }

  async function saveNotificationEmail() {
    setSavingNotificationEmail(true)

    try {
      const { error } = await supabaseBrowser
        .from('projects')
        .update({ notification_email: notificationEmail.trim() || null })
        .eq('id', projectId)

      if (error) throw error

      setProject((prev) => prev ? { ...prev, notification_email: notificationEmail.trim() || null } : null)
      alert('Notification email saved successfully')
    } catch (error) {
      console.error('Error saving notification email:', error)
      alert(error instanceof Error ? error.message : 'Failed to save notification email')
    } finally {
      setSavingNotificationEmail(false)
    }
  }

  function toggleNotifyRecipient(clientId: string) {
    setNotifyRecipientIds((current) =>
      current.includes(clientId)
        ? current.filter((id) => id !== clientId)
        : [...current, clientId]
    )
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
        notify_recipient_ids: sendEmailNotification && notifyRecipientIds.length > 0
          ? notifyRecipientIds
          : null,
      })

    if (error) {
      console.error('Error sending message:', error)
      setSendStatus('error')
      setNotice(error.message || 'Message could not be sent.')
      return
    }

    setMessageText('')
    setSendStatus('sent')
    setNotice(
      sendEmailNotification && notifyRecipientIds.length > 0
        ? `Message sent and emailed to ${notifyRecipientIds.length} client${notifyRecipientIds.length > 1 ? 's' : ''}.`
        : 'Message sent.'
    )
    setSendEmailNotification(false)
    setNotifyRecipientIds([])
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
    return <div className="text-[#6B6785] text-center py-12">Loading project...</div>
  }

  if (loadStatus === 'not-found') {
    return (
      <div className="bg-white border border-[#290D47]/15 rounded-2xl p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-[#1A0F2E] mb-2">Project not found</h1>
        <Link href="/admin/projects" className="text-[#290D47] hover:opacity-80">
          Back to projects
        </Link>
      </div>
    )
  }

  if (loadStatus === 'error' || !project) {
    return (
      <div className="bg-white border border-[#290D47]/15 rounded-2xl p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-[#1A0F2E] mb-2">Could not load project</h1>
        <p className="text-[#6B6785] mb-4">Refresh the page or return to the project list.</p>
        <Link href="/admin/projects" className="text-[#290D47] hover:opacity-80">
          Back to projects
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <Link href="/admin/projects" className="text-[#6B6785] hover:text-[#290D47] text-sm">
          ← Back to projects
        </Link>
        <div className="flex flex-wrap items-center gap-3 mt-3 mb-2">
          <h1 className="text-3xl font-bold text-[#1A0F2E]">{project.name}</h1>
          <span className={`px-2 py-1 rounded text-xs font-semibold uppercase border ${getStatusColor(project.status)}`}>
            {project.status}
          </span>
        </div>
        <p className="text-[#6B6785]">
          {project.description || 'Manage project details and client communication.'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <section className="bg-white border border-[#290D47]/15 rounded-2xl p-6 h-fit shadow-sm">
          <h2 className="text-xl font-semibold text-[#1A0F2E] mb-4">Project Details</h2>
          <div className="space-y-4 text-sm">
            {project.url && (
              <div>
                <p className="text-[#6B6785] uppercase tracking-wide text-xs mb-1">Preview URL</p>
                <a
                  href={project.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#290D47] hover:opacity-80 break-all"
                >
                  {project.url}
                </a>
              </div>
            )}

            {project.subdomain && (
              <div>
                <p className="text-[#6B6785] uppercase tracking-wide text-xs mb-1">Subdomain</p>
                <p className="text-[#1A0F2E]">{project.subdomain}</p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[#6B6785] uppercase tracking-wide text-xs">Assigned Clients</p>
                <button
                  onClick={() => setShowAddClient(!showAddClient)}
                  className="text-xs text-[#290D47] hover:opacity-80"
                >
                  + Add Client
                </button>
              </div>

              {showAddClient && (
                <div className="mb-3 p-3 rounded-lg bg-[#F8F7F5] border border-[#E8E4EF]">
                  <p className="text-[#1A0F2E] text-sm mb-2">Select a client to add:</p>
                  <select
                    onChange={(e) => e.target.value && addClientToProject(e.target.value)}
                    disabled={addingClient}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] text-sm [&>option]:bg-white [&>option]:text-[#1A0F2E]"
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
                <p className="text-[#6B6785]">No clients are assigned to this project yet.</p>
              ) : (
                <div className="space-y-2">
                  {clients.map((client) => (
                    <div
                      key={client.id}
                      className={`rounded-xl border px-3 py-2 ${
                        selectedClientId === client.id
                          ? 'bg-purple-50 border-purple-200'
                          : 'bg-[#F8F7F5] border-[#E8E4EF]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedClientId(client.id)}
                        className="w-full text-left"
                      >
                        <span className="block font-semibold text-[#1A0F2E]">
                          {client.display_name || client.email}
                        </span>
                        {client.company && (
                          <span className="block text-xs text-[#6B6785]">{client.company}</span>
                        )}
                      </button>
                      <button
                        onClick={() => removeClientFromProject(client.id)}
                        className="mt-1 text-xs text-red-600 hover:text-red-500"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-[#E8E4EF] pt-4 mt-4">
              <p className="text-[#6B6785] uppercase tracking-wide text-xs mb-3">Actions</p>
              <div className="space-y-3">
                <Link
                  href={`/admin/projects/${projectId}/payment-link`}
                  className="block w-full px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium text-center"
                >
                  💳 Create Payment Link
                </Link>
                {project.subdomain && (
                  <Link
                    href={`/portal/${project.subdomain}`}
                    target="_blank"
                    className="block w-full px-4 py-2 rounded-lg bg-white border border-[#290D47] text-[#290D47] hover:bg-[#290D47]/5 text-sm font-medium text-center"
                  >
                    👁️ View Client Portal
                  </Link>
                )}
              </div>
            </div>

            <div className="border-t border-[#E8E4EF] pt-4 mt-4">
              <p className="text-[#6B6785] uppercase tracking-wide text-xs mb-3">Proposal</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-[#6B6785] text-xs mb-1">Proposal Slug</label>
                  <input
                    type="text"
                    value={proposalSlug}
                    onChange={(e) => setProposalSlug(e.target.value)}
                    placeholder="firehouse-2026"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] text-sm placeholder:text-[#6B6785]"
                  />
                  <p className="text-[#6B6785] text-xs mt-1">
                    Creates route: /portal/{project.subdomain}/proposal/[slug]
                  </p>
                </div>
                {savedProposalSlug && (
                  <div>
                    <label className="block text-[#6B6785] text-xs mb-1">Current Proposal</label>
                    <a
                      href={`/portal/${project.subdomain}/proposal/${savedProposalSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-[#290D47] hover:opacity-80 text-sm break-all"
                    >
                      /portal/{project.subdomain}/proposal/{savedProposalSlug}
                    </a>
                  </div>
                )}
                <button
                  onClick={saveProposalSlug}
                  disabled={savingProposal}
                  className="w-full px-4 py-2 rounded-lg bg-[#290D47] hover:opacity-90 text-white text-sm font-medium disabled:opacity-50"
                >
                  {savingProposal ? 'Saving...' : 'Save Proposal'}
                </button>
              </div>
            </div>

            <div className="border-t border-[#E8E4EF] pt-4 mt-4">
              <p className="text-[#6B6785] uppercase tracking-wide text-xs mb-3">Message Notifications</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-[#6B6785] text-xs mb-1">Notification Email</label>
                  <input
                    type="email"
                    value={notificationEmail}
                    onChange={(e) => setNotificationEmail(e.target.value)}
                    placeholder="team@loveondev.com"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] text-sm placeholder:text-[#6B6785]"
                  />
                  <p className="text-[#6B6785] text-xs mt-1">
                    Notified whenever a client sends a message on this project.
                  </p>
                </div>
                <button
                  onClick={saveNotificationEmail}
                  disabled={savingNotificationEmail}
                  className="w-full px-4 py-2 rounded-lg bg-[#290D47] hover:opacity-90 text-white text-sm font-medium disabled:opacity-50"
                >
                  {savingNotificationEmail ? 'Saving...' : 'Save Notification Email'}
                </button>
              </div>
            </div>

            <div className="border-t border-[#E8E4EF] pt-4 mt-4">
              <p className="text-[#6B6785] uppercase tracking-wide text-xs mb-3">GitHub Integration</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-[#6B6785] text-xs mb-1">Repository (owner/repo)</label>
                  <input
                    type="text"
                    value={githubRepo}
                    onChange={(e) => setGithubRepo(e.target.value)}
                    placeholder="paulhartman1/portfolio"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] text-sm placeholder:text-[#6B6785]"
                  />
                </div>
                <div>
                  <label className="block text-[#6B6785] text-xs mb-1">Branch</label>
                  <input
                    type="text"
                    value={githubBranch}
                    onChange={(e) => setGithubBranch(e.target.value)}
                    placeholder="main"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] text-sm placeholder:text-[#6B6785]"
                  />
                </div>
                {project?.last_commit_sha && (
                  <div>
                    <label className="block text-[#6B6785] text-xs mb-1">Last Synced Commit</label>
                    <p className="text-[#1A0F2E]/80 text-xs font-mono">{project.last_commit_sha.substring(0, 7)}</p>
                  </div>
                )}
                <button
                  onClick={saveGitHubConfig}
                  disabled={savingGitHub}
                  className="w-full px-4 py-2 rounded-lg bg-[#290D47] hover:opacity-90 text-white text-sm font-medium disabled:opacity-50"
                >
                  {savingGitHub ? 'Saving...' : 'Save GitHub Config'}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white border border-[#290D47]/15 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-semibold text-[#1A0F2E]">Ideas & Messages</h2>
              <p className="text-[#6B6785] text-sm">
                {selectedClient
                  ? `Sending to ${selectedClient.display_name || selectedClient.email}`
                  : 'Assign a client before sending messages.'}
              </p>
            </div>
            {messages.length > 0 && (
              <span className="px-3 py-1 rounded-full bg-[#F8F7F5] border border-[#E8E4EF] text-[#6B6785] text-xs">
                {messages.length} total
              </span>
            )}
          </div>

          <div className="space-y-3 mb-4 max-h-[28rem] overflow-y-auto">
            {!selectedClientId ? (
              <p className="text-[#6B6785] text-center py-8">
                Select or assign a client to start a conversation.
              </p>
            ) : messages.length === 0 ? (
              <p className="text-[#6B6785] text-center py-8">
                No messages yet. Send the first idea or update.
              </p>
            ) : (
              messages.map((msg) => {
                const isSelf = msg.sender_id === currentUserId
                const isAdmin = msg.sender?.is_admin || false

                return (
                  <div
                    key={msg.id}
                    className={`p-4 rounded-xl ${
                      isSelf
                        ? 'bg-purple-50 border border-purple-200 ml-8'
                        : 'bg-[#F8F7F5] border border-[#E8E4EF] mr-8'
                    }`}
                  >
                    <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#1A0F2E]">
                          {isSelf ? 'You' : (msg.sender?.display_name || msg.sender?.email || 'Client')}
                        </span>
                        {isAdmin && (
                          <span className="px-2 py-0.5 bg-purple-600 text-white text-xs rounded uppercase font-semibold">
                            Studio
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-[#6B6785]">
                        {new Date(msg.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[#1A0F2E] whitespace-pre-wrap">{msg.message}</p>
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
              className="w-full px-4 py-3 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] placeholder:text-[#6B6785] resize-none focus:outline-none focus:border-[#290D47] disabled:opacity-50"
              rows={4}
            />

            <div className="rounded-lg border border-[#E8E4EF] bg-[#F8F7F5] p-3">
              <label className="flex items-center gap-2 text-sm text-[#1A0F2E] cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendEmailNotification}
                  onChange={(e) => {
                    setSendEmailNotification(e.target.checked)
                    if (!e.target.checked) setNotifyRecipientIds([])
                  }}
                  className="rounded"
                />
                Email this message to client(s)?
              </label>

              {sendEmailNotification && (
                <div className="mt-3 space-y-2">
                  {clients.length === 0 ? (
                    <p className="text-[#6B6785] text-xs">No clients are assigned to this project yet.</p>
                  ) : (
                    clients.map((client) => (
                      <label
                        key={client.id}
                        className="flex items-center gap-2 text-sm text-[#1A0F2E] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={notifyRecipientIds.includes(client.id)}
                          onChange={() => toggleNotifyRecipient(client.id)}
                          className="rounded"
                        />
                        {client.display_name || client.email}
                        <span className="text-[#6B6785] text-xs">({client.email})</span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>

            {notice && (
              <p className={`text-sm ${sendStatus === 'error' ? 'text-red-700' : 'text-green-700'}`}>
                {notice}
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={sendMessage}
                disabled={!selectedClientId || !messageText.trim() || sendStatus === 'sending'}
                className="px-6 py-2 rounded-lg bg-[#290D47] text-white font-semibold hover:opacity-90 disabled:opacity-50 disabled:hover:opacity-50"
              >
                {sendStatus === 'sending' ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-6">
        <section className="bg-white border border-[#290D47]/15 rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-[#1A0F2E] mb-4">Recent Updates</h2>
          <div className="space-y-3">
            {updates.length === 0 ? (
              <p className="text-[#6B6785] text-center py-8">No project updates yet.</p>
            ) : (
              updates.map((update) => (
                <div
                  key={update.id}
                  className="bg-[#F8F7F5] border border-[#E8E4EF] rounded-xl p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      {update.author_role === 'github' && (
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-800 text-xs rounded uppercase font-semibold flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                          </svg>
                          GitHub
                        </span>
                      )}
                      {update.author_role === 'developer' && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded uppercase font-semibold">
                          Developer
                        </span>
                      )}
                      {update.author_role === 'system' && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded uppercase font-semibold">
                          System
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[#6B6785]">
                      {new Date(update.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[#1A0F2E] font-medium mb-1">{update.title || 'Update'}</p>
                  <p className="text-[#1A0F2E]/85 text-sm whitespace-pre-wrap">{update.body}</p>
                  {update.commit_url && (
                    <a
                      href={update.commit_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-xs text-[#290D47] hover:opacity-80"
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

      <div className="mt-6">
        <ProjectExperiments projectId={projectId} />
      </div>

      <div className="mt-6">
        <ProjectProposals projectId={projectId} />
      </div>

      <div className="mt-6">
        <AskCgt projectId={projectId} projectName={project.name} />
      </div>

      <div className="mt-6">
        <EngagementRecordings projectId={projectId} />
      </div>
    </div>
  )
}
