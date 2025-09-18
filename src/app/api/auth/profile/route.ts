import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  console.log('Received profile update request')

  const contentType = (req.headers.get('content-type') || '').toLowerCase()
  let body: Record<string, unknown> = {}

  try {
    if (contentType.includes('application/json')) {
      body = await req.json()
    } else if (
      contentType.includes('multipart/form-data') ||
      contentType.includes('application/x-www-form-urlencoded')
    ) {
      const formData = await req.formData()
      body = Object.fromEntries(formData.entries())
    } else {
      // fallback: try formData then json
      try {
        const formData = await req.formData()
        body = Object.fromEntries(formData.entries())
      } catch (fdErr) {
        // last resort: try json (will throw if not json)
        body = await req.json()
        console.error('Failed to parse formData, parsed as JSON instead:', fdErr)
      }
    }
  } catch (err) {
    console.error('Failed to parse request body:', err)
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  console.log('Parsed body:', body)

  // Extract fields (coerce to strings)
  const first_name = body.first_name?.toString?.() ?? ''
  const last_name = body.last_name?.toString?.() ?? ''
  const company = body.company?.toString?.() ?? ''
  const phone = body.phone?.toString?.() ?? ''
  const pronouns = body.pronouns?.toString?.() ?? ''
  const display_name = `${first_name} ${last_name}`.trim()

  try {
    const supabase = createRouteHandlerClient({ cookies })

    // optionally log current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) {
      console.error('Error fetching user data:', userError.message)
      return NextResponse.json({ error: userError.message }, { status: 400 })
    }
    console.log('Current user data:', user)

    const { error } = await supabase.auth.updateUser({
      data: { first_name, last_name, company, phone, pronouns, display_name }
    })
    if (error) {
      console.error('Error updating user:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.redirect(new URL('/dashboard', req.url))
  } catch (err) {
    console.error('Unexpected error in profile handler:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
