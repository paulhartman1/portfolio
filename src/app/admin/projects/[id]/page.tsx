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
  client_id: string
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
  const [selectedClientId, setSelectedClientId] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [messageText, setMessageText] = useState('')
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading')
  const [sendStatus, setSendStatus] = useState<SendStatus>('idle')
  const [notice, setNotice] = useState('')

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) || null,
    [clients, selectedClientId]
  )

  useEffect(() => {
    loadProject()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  useEffect(() => {
    if (selectedClientId) {
      loadMessages(selectedClientId)
    } else {
      setMessages([])
    }
  }, [selectedClientId])

  async function loadProject() {
    setLoadStatus('loading')
    setNotice('')

    const { data: userData } = await supabaseBrowser.auth.getUser()
    setCurrentUserId(userData.user?.id || null)

    const { data: projectData, error: projectError } = await supabaseBrowser
      .from('projects')
      .select('id, name, description, subdomain, url, status, created_at')
      .eq('id', projectId)
      .single()

    if (projectError) {
      console.error('Error loading project:', projectError)
      setLoadStatus(projectError.code === 'PGRST116' ? 'not-found' : 'error')
      return
    }

    setProject(projectData)

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
    setLoadStatus('ready')
  }

  async function loadMessages(clientId: string) {
    const { data, error } = await supabaseBrowser
      .from('client_messages')
      .select(`
        id,
        client_id,
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
      .eq('client_id', clientId)
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

  async function sendMessage() {
    if (!messageText.trim() || !currentUserId || !selectedClientId) return

    setSendStatus('sending')
    setNotice('')

    const { error } = await supabaseBrowser
      .from('client_messages')
      .insert({
        client_id: selectedClientId,
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
    await loadMessages(selectedClientId)
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
              <p className="text-white/50 uppercase tracking-wide text-xs mb-2">Assigned Clients</p>
              {clients.length === 0 ? (
                <p className="text-white/60">No clients are assigned to this project yet.</p>
              ) : (
                <div className="space-y-2">
                  {clients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => setSelectedClientId(client.id)}
                      className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                        selectedClientId === client.id
                          ? 'bg-purple-500/25 border-purple-300/60 text-white'
                          : 'bg-white/5 border-white/20 text-white/80 hover:bg-white/10'
                      }`}
                    >
                      <span className="block font-semibold">
                        {client.display_name || client.email}
                      </span>
                      {client.company && (
                        <span className="block text-xs text-white/60">{client.company}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
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
    </div>
  )
}
