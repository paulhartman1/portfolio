import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Verifies the current user may act on recordings for the given project --
 * either as the assigned client (via project_clients) or as an admin.
 * Mirrors requireAdmin() in src/app/api/admin/recordings/_lib.ts, but scoped
 * to "this project" instead of "any project", since these routes are called
 * from the client portal, not the admin console.
 */
export async function requireProjectAccess(projectId: string) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (profile?.is_admin) {
    return { supabase, user, isAdmin: true as const }
  }

  const { data: projectClient } = await supabase
    .from('project_clients')
    .select('id')
    .eq('project_id', projectId)
    .eq('client_id', user.id)
    .maybeSingle()

  if (!projectClient) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { supabase, user, isAdmin: false as const }
}
