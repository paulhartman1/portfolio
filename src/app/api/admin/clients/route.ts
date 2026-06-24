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
    const isAdmin = Boolean(body.is_admin)
    const projectIds = (body.project_ids as string[]) ?? []
    const displayName = `${firstName} ${lastName}`.trim() || email

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    if (!isAdmin && projectIds.length === 0) {
      return NextResponse.json({ error: 'Clients must be assigned to at least one project' }, { status: 400 })
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

    // Profile is automatically created by the handle_new_user() trigger
    // Update it with the additional fields that the trigger doesn't handle
    const { error: profileError } = await serviceRole
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
        company,
        phone,
        pronouns,
        is_admin: isAdmin,
      })
      .eq('id', createdUser.user.id)

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    // Assign client to projects via project_clients junction table
    if (projectIds.length > 0) {
      const projectAssignments = projectIds.map(projectId => ({
        project_id: projectId,
        client_id: createdUser.user.id,
      }))

      const { error: projectError } = await serviceRole
        .from('project_clients')
        .insert(projectAssignments)

      if (projectError) {
        return NextResponse.json({ error: projectError.message }, { status: 400 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || 'Unexpected error' }, { status: 500 })
  }
}
