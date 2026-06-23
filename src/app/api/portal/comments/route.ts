import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')

  const payload = isJson
    ? await request.json()
    : Object.fromEntries((await request.formData()).entries())

  const projectId = String(payload.project_id || '')
  const subdomain = String(payload.subdomain || '')
  const url = String(payload.url || '/')
  const commentText = String(payload.comment_text || '').trim()
  const priority = String(payload.priority || 'medium')
  const xPosition =
    payload.x_position === undefined || payload.x_position === null || payload.x_position === ''
      ? null
      : Number(payload.x_position)
  const yPosition =
    payload.y_position === undefined || payload.y_position === null || payload.y_position === ''
      ? null
      : Number(payload.y_position)
  const viewportWidth =
    payload.viewport_width === undefined ||
    payload.viewport_width === null ||
    payload.viewport_width === ''
      ? null
      : Number(payload.viewport_width)

  if (!projectId || !subdomain || !commentText) {
    if (isJson) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    return NextResponse.redirect(new URL(`/portal/${subdomain}/preview`, request.url))
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    if (isJson) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL(`/auth/login?redirect=/portal/${subdomain}/preview`, request.url))
  }

  const { data: createdComment, error } = await supabase
    .from('review_comments')
    .insert({
      project_id: projectId,
      client_id: user.id,
      url,
      x_position: Number.isFinite(xPosition) ? xPosition : null,
      y_position: Number.isFinite(yPosition) ? yPosition : null,
      viewport_width: Number.isFinite(viewportWidth) ? viewportWidth : null,
      comment_text: commentText,
      priority,
      status: 'new',
    })
    .select('id, url, x_position, y_position, viewport_width, comment_text, priority, status, created_at, profiles:client_id (display_name, email)')
    .single()

  if (error) {
    if (isJson) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.redirect(new URL(`/portal/${subdomain}/preview`, request.url))
  }

  if (isJson) {
    return NextResponse.json(createdComment)
  }

  return NextResponse.redirect(new URL(`/portal/${subdomain}/preview`, request.url))
}
