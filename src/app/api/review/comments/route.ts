import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// GET - List comments for a project/URL
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
  
  const projectId = request.nextUrl.searchParams.get('project_id')
  const url = request.nextUrl.searchParams.get('url')
  
  if (!projectId) {
    return NextResponse.json(
      { error: 'project_id required' },
      { status: 400 }
    )
  }
  
  // Verify user has access to this project
  const { data: project } = await supabase
    .from('projects')
    .select('id, client_id')
    .eq('id', projectId)
    .single()
  
  if (!project) {
    return NextResponse.json(
      { error: 'Project not found' },
      { status: 404 }
    )
  }
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  
  const isAdmin = Boolean(profile?.is_admin)
  const isClient = user.id === project.client_id
  
  if (!isAdmin && !isClient) {
    return NextResponse.json(
      { error: 'Access denied' },
      { status: 403 }
    )
  }
  
  // Build query
  let query = supabase
    .from('review_comments')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  
  // Filter by URL if provided
  if (url) {
    query = query.eq('url', url)
  }
  
  const { data: comments, error } = await query
  
  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
  
  return NextResponse.json(comments || [])
}

// POST - Create a comment
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
  
  const body = await request.json()
  const {
    project_id,
    url,
    x_position,
    y_position,
    viewport_width,
    comment_text,
    priority = 'medium'
  } = body
  
  if (!project_id || !url || !comment_text) {
    return NextResponse.json(
      { error: 'Missing required fields: project_id, url, comment_text' },
      { status: 400 }
    )
  }
  
  // Verify user has access to this project
  const { data: project } = await supabase
    .from('projects')
    .select('id, client_id')
    .eq('id', project_id)
    .single()
  
  if (!project) {
    return NextResponse.json(
      { error: 'Project not found' },
      { status: 404 }
    )
  }
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  
  const isAdmin = Boolean(profile?.is_admin)
  const isClient = user.id === project.client_id
  
  if (!isAdmin && !isClient) {
    return NextResponse.json(
      { error: 'Access denied to this project' },
      { status: 403 }
    )
  }
  
  // Create comment
  const { data: comment, error } = await supabase
    .from('review_comments')
    .insert({
      project_id,
      client_id: user.id,
      url,
      x_position: x_position !== undefined ? Number(x_position) : null,
      y_position: y_position !== undefined ? Number(y_position) : null,
      viewport_width: viewport_width !== undefined ? Number(viewport_width) : null,
      comment_text,
      priority,
      status: 'new'
    })
    .select()
    .single()
  
  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
  
  return NextResponse.json(comment)
}

// DELETE - Delete a comment
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
  
  const commentId = request.nextUrl.searchParams.get('id')
  
  if (!commentId) {
    return NextResponse.json(
      { error: 'Comment ID required' },
      { status: 400 }
    )
  }
  
  // Get comment to check ownership
  const { data: comment } = await supabase
    .from('review_comments')
    .select('id, client_id, project_id')
    .eq('id', commentId)
    .single()
  
  if (!comment) {
    return NextResponse.json(
      { error: 'Comment not found' },
      { status: 404 }
    )
  }
  
  // Check if user is admin or comment owner
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  
  const isAdmin = Boolean(profile?.is_admin)
  const isOwner = user.id === comment.client_id
  
  if (!isAdmin && !isOwner) {
    return NextResponse.json(
      { error: 'You can only delete your own comments' },
      { status: 403 }
    )
  }
  
  // Delete comment
  const { error } = await supabase
    .from('review_comments')
    .delete()
    .eq('id', commentId)
  
  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
  
  return NextResponse.json({ success: true })
}
