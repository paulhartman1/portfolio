'use client'

import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/utils/supabase/client'

type Comment = {
  id: string
  comment_text: string
  priority: 'low' | 'medium' | 'high'
  status: 'new' | 'in-progress' | 'resolved'
  url: string
  x_position: number
  y_position: number
  created_at: string
  client_id: string
  project_id: string
  projects?: {
    name: string
  }
  profiles?: {
    email: string
    display_name: string
  }
}

export default function AdminComments() {
  const [comments, setComments] = useState<Comment[]>([])
  const [filter, setFilter] = useState<'all' | 'new' | 'in-progress' | 'resolved'>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadComments()
  }, [filter])

  async function loadComments() {
    setLoading(true)
    let query = supabaseBrowser
      .from('review_comments')
      .select(`
        *,
        projects (name),
        profiles (email, display_name)
      `)
      .order('created_at', { ascending: false })

    if (filter !== 'all') {
      query = query.eq('status', filter)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error loading comments:', error)
    } else {
      setComments(data || [])
    }
    setLoading(false)
  }

  async function updateStatus(id: string, newStatus: 'new' | 'in-progress' | 'resolved') {
    const { error } = await supabaseBrowser
      .from('review_comments')
      .update({ status: newStatus })
      .eq('id', id)

    if (error) {
      console.error('Error updating status:', error)
      alert('Failed to update status')
    } else {
      loadComments()
    }
  }

  async function deleteComment(id: string) {
    if (!confirm('Are you sure you want to delete this comment?')) return

    const { error } = await supabaseBrowser
      .from('review_comments')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting comment:', error)
      alert('Failed to delete comment')
    } else {
      loadComments()
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800'
      case 'in-progress': return 'bg-purple-100 text-purple-800'
      case 'resolved': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-4xl font-bold text-white mb-8">Loading comments...</h1>
      </div>
    )
  }

  const filteredComments = filter === 'all' ? comments : comments.filter(c => c.status === filter)

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Client Review Comments</h1>
        <p className="text-white/80">Manage feedback from clients</p>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6 flex gap-2">
        {(['all', 'new', 'in-progress', 'resolved'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg font-medium capitalize ${
              filter === f
                ? 'bg-white text-indigo-900'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            {f} ({comments.filter(c => f === 'all' || c.status === f).length})
          </button>
        ))}
      </div>

      {/* Comments List */}
      <div className="space-y-4">
        {filteredComments.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-12 text-center">
            <p className="text-white/60">No comments found</p>
          </div>
        ) : (
          filteredComments.map((comment) => (
            <div key={comment.id} className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="flex gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-semibold uppercase border ${getPriorityColor(comment.priority)}`}>
                    {comment.priority}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${getStatusColor(comment.status)}`}>
                    {comment.status}
                  </span>
                </div>
                <button
                  onClick={() => deleteComment(comment.id)}
                  className="text-red-300 hover:text-red-200 text-sm font-medium"
                >
                  Delete
                </button>
              </div>

              <p className="text-white text-lg mb-3">{comment.comment_text}</p>

              <div className="text-sm text-white/60 mb-4 space-y-1">
                <p><strong>Project:</strong> {comment.projects?.name || 'Unknown'}</p>
                <p><strong>Client:</strong> {comment.profiles?.display_name || comment.profiles?.email}</p>
                <p><strong>URL:</strong> {comment.url}</p>
                <p><strong>Position:</strong> ({comment.x_position}, {comment.y_position})</p>
                <p><strong>Created:</strong> {new Date(comment.created_at).toLocaleString()}</p>
              </div>

              {/* Status Update Buttons */}
              <div className="flex gap-2">
                {comment.status !== 'new' && (
                  <button
                    onClick={() => updateStatus(comment.id, 'new')}
                    className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                  >
                    Mark as New
                  </button>
                )}
                {comment.status !== 'in-progress' && (
                  <button
                    onClick={() => updateStatus(comment.id, 'in-progress')}
                    className="px-3 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600"
                  >
                    Mark as In Progress
                  </button>
                )}
                {comment.status !== 'resolved' && (
                  <button
                    onClick={() => updateStatus(comment.id, 'resolved')}
                    className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                  >
                    ✓ Mark as Resolved
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
