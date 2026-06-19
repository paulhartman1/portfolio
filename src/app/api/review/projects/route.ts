import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
  
  // Get domain from query param
  const domain = request.nextUrl.searchParams.get('domain')
  
  if (!domain) {
    return NextResponse.json(
      { error: 'Domain parameter required' },
      { status: 400 }
    )
  }
  
  // Extract subdomain from domain
  // Examples: firehousearts.loveondev.com -> firehousearts
  //           www.firehousearts.loveondev.com -> firehousearts
  const parts = domain.split('.')
  let subdomain = parts[0]
  
  // Handle www prefix
  if (subdomain === 'www' && parts.length > 1) {
    subdomain = parts[1]
  }
  
  // Query project by subdomain
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, client_id, name, subdomain, url, status')
    .eq('subdomain', subdomain)
    .single()
  
  if (projectError || !project) {
    return NextResponse.json(
      { error: 'Project not found' },
      { status: 404 }
    )
  }
  
  // Check if user has access to this project
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  
  const isAdmin = Boolean(profile?.is_admin)
  const isClient = user.id === project.client_id
  
  if (!isAdmin && !isClient) {
    return NextResponse.json(
      { error: 'Access denied to this project' },
      { status: 403 }
    )
  }
  
  return NextResponse.json({
    project: {
      id: project.id,
      name: project.name,
      subdomain: project.subdomain,
      url: project.url,
      status: project.status,
    }
  })
}
