import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { AdminLayoutClient } from './layout-client'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  // Check if user is admin
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (profileError) {
    console.error('Admin check error:', profileError)
  }

  console.log('Admin check - User:', user.email, 'Profile:', profile, 'Is Admin:', profile?.is_admin)

  if (!profile?.is_admin) {
    redirect('/dashboard')
  }

  return (
    <AdminLayoutClient userEmail={user.email || ''}>{children}</AdminLayoutClient>
  )
}
