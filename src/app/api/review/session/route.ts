import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  // Check for Bearer token in Authorization header
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null
  
  const supabase = await createClient()
  
  // If token provided, verify it
  if (token) {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, company, is_admin')
      .eq('id', user.id)
      .single()
    
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        display_name: profile?.display_name || null,
        company: profile?.company || null,
        is_admin: profile?.is_admin || false,
      }
    })
  }
  
  // Fallback to cookie-based auth
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
  
  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, company, is_admin')
    .eq('id', user.id)
    .single()
  
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      display_name: profile?.display_name || null,
      company: profile?.company || null,
      is_admin: profile?.is_admin || false,
    }
  })
}
