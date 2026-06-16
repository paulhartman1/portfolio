import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  const formData = await request.formData()
  const approvalId = String(formData.get('approval_id') || '')
  const decision = String(formData.get('decision') || '')
  const responseNote = String(formData.get('response_note') || '').trim()
  const subdomain = String(formData.get('subdomain') || '')

  if (!approvalId || !subdomain || !['approved', 'changes_requested'].includes(decision)) {
    return NextResponse.redirect(new URL(`/portal/${subdomain}/approvals`, request.url))
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(
      new URL(`/auth/login?redirect=/portal/${subdomain}/approvals`, request.url)
    )
  }

  await supabase
    .from('project_approvals')
    .update({
      status: decision,
      response_note: responseNote || null,
      responded_at: new Date().toISOString(),
      responded_by: user.id,
    })
    .eq('id', approvalId)

  return NextResponse.redirect(new URL(`/portal/${subdomain}/approvals`, request.url))
}
