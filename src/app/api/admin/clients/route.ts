import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!adminProfile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const email = body.email?.toString()?.trim()?.toLowerCase()
    const password = body.password?.toString() ?? ''
    const firstName = body.first_name?.toString()?.trim() ?? ''
    const lastName = body.last_name?.toString()?.trim() ?? ''
    const company = body.company?.toString()?.trim() ?? ''
    const phone = body.phone?.toString()?.trim() ?? ''
    const pronouns = body.pronouns?.toString()?.trim() ?? ''
    const displayName = `${firstName} ${lastName}`.trim() || email

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const serviceRole = createServiceRoleClient()

    const { data: createdUser, error: createUserError } = await serviceRole.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        company,
        phone,
        pronouns,
        display_name: displayName,
      },
    })

    if (createUserError || !createdUser.user) {
      return NextResponse.json({ error: createUserError?.message || 'Failed to create user' }, { status: 400 })
    }

    const { error: profileError } = await serviceRole
      .from('profiles')
      .upsert({
        id: createdUser.user.id,
        email,
        display_name: displayName,
        first_name: firstName,
        last_name: lastName,
        company,
        phone,
        pronouns,
        is_admin: false,
      })

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || 'Unexpected error' }, { status: 500 })
  }
}
