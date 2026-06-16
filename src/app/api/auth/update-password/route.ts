import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const formData = await req.formData()
  const password = formData.get('password')?.toString() ?? ''
  const confirmPassword = formData.get('confirm_password')?.toString() ?? ''

  if (!password || password.length < 8) {
    return NextResponse.redirect(new URL('/auth/update-password?error=password_too_short', req.url))
  }

  if (password !== confirmPassword) {
    return NextResponse.redirect(new URL('/auth/update-password?error=password_mismatch', req.url))
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    return NextResponse.redirect(new URL('/auth/update-password?error=update_failed', req.url))
  }

  return NextResponse.redirect(new URL('/dashboard', req.url))
}
