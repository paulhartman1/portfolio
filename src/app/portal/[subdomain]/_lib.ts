import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

type ProjectRecord = {
  id: string
  client_id: string
  name: string
  description: string | null
  url: string | null
  status: string
  subdomain: string
  profiles: {
    display_name: string | null
    company: string | null
  } | null
}

export async function getPortalContext(subdomain: string) {
  const supabase = await createClient()

  const { data: project, error } = await supabase
    .from('projects')
    .select(`
      id,
      client_id,
      name,
      description,
      url,
      status,
      subdomain,
      profiles (
        display_name,
        company
      )
    `)
    .eq('subdomain', subdomain)
    .single<ProjectRecord>()

  if (error || !project) {
    notFound()
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth/login?redirect=/portal/${subdomain}`)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  const isAdmin = Boolean(profile?.is_admin)
  const isClient = user.id === project.client_id
  const hasAccess = isAdmin || isClient

  return {
    supabase,
    project,
    user,
    isAdmin,
    isClient,
    hasAccess,
  }
}
