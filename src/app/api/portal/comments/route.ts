import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  const formData = await request.formData()
  const projectId = String(formData.get('project_id') || '')
  const subdomain = String(formData.get('subdomain') || '')
  const url = String(formData.get('url') || '/')
  const commentText = String(formData.get('comment_text') || '').trim()
  const priority = String(formData.get('priority') || 'medium')

  if (!projectId || !subdomain || !commentText) {
    return NextResponse.redirect(new URL(`/portal/${subdomain}/preview`, request.url))
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL(`/auth/login?redirect=/portal/${subdomain}/preview`, request.url))
  }

  await supabase.from('review_comments').insert({
    project_id: projectId,
    client_id: user.id,
    url,
    comment_text: commentText,
    priority,
    status: 'new',
  })

  return NextResponse.redirect(new URL(`/portal/${subdomain}/preview`, request.url))
}
