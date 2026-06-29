import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  // Check if user is authenticated and is admin
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
  }

  // Parse request body
  const body = await request.json()
  const { github_repo, github_branch } = body

  // Validate inputs
  if (github_repo !== null && github_repo !== undefined && typeof github_repo !== 'string') {
    return NextResponse.json({ error: 'Invalid github_repo format' }, { status: 400 })
  }

  if (github_branch !== null && github_branch !== undefined && typeof github_branch !== 'string') {
    return NextResponse.json({ error: 'Invalid github_branch format' }, { status: 400 })
  }

  // Validate github_repo format (owner/repo)
  if (github_repo && !/^[\w.-]+\/[\w.-]+$/.test(github_repo)) {
    return NextResponse.json(
      { error: 'Invalid github_repo format. Expected: owner/repo' },
      { status: 400 }
    )
  }

  // Update project
  const updateData: { github_repo?: string | null; github_branch?: string | null } = {}
  
  if (github_repo !== undefined) {
    updateData.github_repo = github_repo || null
  }
  
  if (github_branch !== undefined) {
    updateData.github_branch = github_branch || 'main'
  }

  const { data, error } = await supabase
    .from('projects')
    .update(updateData)
    .eq('id', id)
    .select('id, name, github_repo, github_branch, last_commit_sha')
    .single()

  if (error) {
    console.error('Error updating GitHub config:', error)
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }

  return NextResponse.json({ success: true, project: data })
}
