import { NextRequest } from 'next/server'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'

type RequestAuthContext = {
  user: User | null
  isAdmin: boolean
  supabase: Awaited<ReturnType<typeof createClient>>
}

export async function getRequestAuthContext(request: NextRequest): Promise<RequestAuthContext> {
  const authHeader = request.headers.get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null

  const supabase = await createClient()

  const { data: authData } = bearerToken
    ? await supabase.auth.getUser(bearerToken)
    : await supabase.auth.getUser()

  const user = authData.user

  if (!user) {
    return { user: null, isAdmin: false, supabase }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  return {
    user,
    isAdmin: Boolean(profile?.is_admin),
    supabase,
  }
}
