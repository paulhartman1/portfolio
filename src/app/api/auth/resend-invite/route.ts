import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'

// Resends an invite email for a client whose original invite link expired.
// Re-invoking inviteUserByEmail for an existing, unconfirmed user resends
// the invite email with a fresh token; it does not create a duplicate user.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = body.email?.toString()?.trim()?.toLowerCase()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const serviceRole = createServiceRoleClient()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    const { error } = await serviceRole.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/auth/welcome?email=${encodeURIComponent(email)}`,
    })

    if (error) {
      const status = error.status === 429 || error.code === 'over_request_rate_limit' ? 429 : 400
      return NextResponse.json({ error: error.message, code: error.code }, { status })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || 'Unexpected error' }, { status: 500 })
  }
}
