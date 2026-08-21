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
    const firstName = body.first_name?.toString()?.trim() ?? ''
    const lastName = body.last_name?.toString()?.trim() ?? ''
    const company = body.company?.toString()?.trim() ?? ''
    const phone = body.phone?.toString()?.trim() ?? ''
    const pronouns = body.pronouns?.toString()?.trim() ?? ''
    const isAdmin = Boolean(body.is_admin)
    const projectIds = (body.project_ids as string[]) ?? []
    const displayName = `${firstName} ${lastName}`.trim() || email

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    if (!isAdmin && projectIds.length === 0) {
      return NextResponse.json({ error: 'Clients must be assigned to at least one project' }, { status: 400 })
    }

    const serviceRole = createServiceRoleClient()

    // Get the site URL for the invite redirect  
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    
    // Generate the invite link ourselves instead of using inviteUserByEmail so
    // Supabase doesn't send its own email. The admin copies this link and
    // sends it manually.
    const { data: generated, error: createUserError } = await serviceRole.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        redirectTo: `${siteUrl}/auth/welcome?email=${encodeURIComponent(email)}`,
        data: {
          first_name: firstName,
          last_name: lastName,
          company,
          phone,
          pronouns,
          display_name: displayName,
        },
      },
    })

    const createdUser = generated?.user

    if (createUserError || !createdUser) {
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
      .eq('id', createdUser.id)

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    // Assign client to projects via project_clients junction table
    if (projectIds.length > 0) {
      const projectAssignments = projectIds.map(projectId => ({
        project_id: projectId,
        client_id: createdUser.id,
      }))

      const { error: projectError } = await serviceRole
        .from('project_clients')
        .insert(projectAssignments)

      if (projectError) {
        return NextResponse.json({ error: projectError.message }, { status: 400 })
      }
    }

    // Don't hand back Supabase's own action_link: it points at Supabase's
    // hosted /auth/v1/verify endpoint, which redirects to the Site URL (not
    // our redirectTo) with the token stripped out if verification fails.
    // That bypasses our app entirely, so an expired link can't be caught.
    // Build our own link pointing straight at our callback route instead,
    // using the raw hashed_token, so verification happens in our app and
    // failures can be routed to /auth/link-expired.
    const actionLink = `${siteUrl}/api/auth/callback?token_hash=${generated.properties.hashed_token}&type=invite&email=${encodeURIComponent(email)}`

    return NextResponse.json({ success: true, actionLink })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || 'Unexpected error' }, { status: 500 })
  }
}
