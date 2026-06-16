import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  const formData = await request.formData()
  const projectId = String(formData.get('project_id') || '')
  const subdomain = String(formData.get('subdomain') || '')
  const title = String(formData.get('title') || '').trim()
  const body = String(formData.get('body') || '').trim()

  if (!projectId || !subdomain || !body) {
    return NextResponse.redirect(new URL(`/portal/${subdomain}/updates`, request.url))
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL(`/auth/login?redirect=/portal/${subdomain}/updates`, request.url))
  }

  await supabase.from('project_updates').insert({
    project_id: projectId,
    title: title || null,
    body,
    author_role: 'client',
    authored_by: user.id,
    requires_client_action: false,
    is_internal: false,
  })

  return NextResponse.redirect(new URL(`/portal/${subdomain}/updates`, request.url))
}
