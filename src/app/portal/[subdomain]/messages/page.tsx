'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { supabaseBrowser } from '@/utils/supabase/client'

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
  }
}

function MessagesContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const subdomain = (params?.subdomain || '').toString()
  const initialMessage = searchParams?.get('message') || ''

  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [newMessage, setNewMessage] = useState(initialMessage)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)

  useEffect(() => {
    loadMessages()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subdomain])

  useEffect(() => {
    if (initialMessage) {
      setNewMessage(initialMessage)
    }
  }, [initialMessage])

  async function loadMessages() {
    setLoading(true)

    // Get current user
    const { data: userData } = await supabaseBrowser.auth.getUser()
    if (!userData.user) {
      setLoading(false)
      return
    }
    setUserId(userData.user.id)

    // Get project by subdomain
    const { data: projectData } = await supabaseBrowser
      .from('projects')
      .select('id')
      .eq('subdomain', subdomain)
      .single()

    if (!projectData) {
      setLoading(false)
      return
    }
    setProjectId(projectData.id)

    // Load messages for this project (all clients can see all messages)
    const { data: messagesData, error } = await supabaseBrowser
      .from('client_messages')
      .select(`
        *,
        sender:profiles!sender_id (
          display_name,
          email,
          is_admin
        )
      `)
      .eq('project_id', projectData.id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error loading messages:', error)
    } else {
      setMessages(messagesData || [])
    }

    setLoading(false)
  }

  async function sendMessage() {
    if (!newMessage.trim() || !userId || !projectId) return

    setSendingMessage(true)
    const { error } = await supabaseBrowser
      .from('client_messages')
      .insert({
        project_id: projectId,
        sender_id: userId,
        message: newMessage.trim(),
      })

    if (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message')
    } else {
      setNewMessage('')
      loadMessages()
    }
    setSendingMessage(false)
  }

  async function markMessagesAsRead() {
    if (!userId) return

    // Mark all messages from admin (not sent by this user) as read
    const unreadMessages = messages.filter(
      (msg) => !msg.is_read && msg.sender_id !== userId
    )

    if (unreadMessages.length === 0) return

    const { error } = await supabaseBrowser
      .from('client_messages')
      .update({ is_read: true })
      .in(
        'id',
        unreadMessages.map((m) => m.id)
      )

    if (error) {
      console.error('Error marking messages as read:', error)
    } else {
      loadMessages()
    }
  }

  useEffect(() => {
    if (messages.length > 0 && userId) {
      markMessagesAsRead()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, userId])

  if (loading) {
    return <div className="text-[#1A0F2E] text-center py-12">Loading messages...</div>
  }

  const unreadCount = messages.filter(
    (msg) => !msg.is_read && msg.sender_id !== userId
  ).length

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold text-[#1A0F2E]">Messages</h1>
          {unreadCount > 0 && (
            <span className="px-3 py-1 bg-red-500 text-white text-sm font-bold rounded-full">
              {unreadCount} new
            </span>
          )}
        </div>
        <p className="text-[#6B6785]">
          Human-to-human conversation with CGT. Decisions and sign-offs live under Decisions;
          the engagement record lives under Activity.
        </p>
      </div>

      <div className="bg-white border border-[#290D47]/15 rounded-2xl p-6 shadow-sm">
        {/* Messages Thread */}
        <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-[#6B6785] text-center py-6">No messages yet. Start a conversation!</p>
          ) : (
            messages.map((msg) => {
              const isAdmin = msg.sender?.is_admin || false
              const isSelf = msg.sender_id === userId
              return (
                <div
                  key={msg.id}
                  className={`p-4 rounded-lg ${
                    isAdmin
                      ? 'bg-purple-50 border border-purple-200 mr-8'
                      : 'bg-[#F8F7F5] border border-[#E8E4EF] ml-8'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#1A0F2E]">
                        {isSelf ? 'You' : (msg.sender?.display_name || msg.sender?.email || 'Unknown')}
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
            className="w-full px-4 py-3 rounded-lg bg-white border border-[#E8E4EF] text-[#1A0F2E] placeholder:text-[#6B6785] resize-none focus:outline-none focus:border-[#290D47]"
            rows={3}
          />
          <div className="flex justify-end">
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sendingMessage}
              className="px-6 py-2 rounded-lg bg-[#290D47] text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:hover:opacity-50"
            >
              {sendingMessage ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ClientMessagesPage() {
  return (
    <Suspense fallback={<div className="text-[#1A0F2E] text-center py-12">Loading messages...</div>}>
      <MessagesContent />
    </Suspense>
  )
}
