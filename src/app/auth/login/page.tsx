import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import LoginForm from './LoginForm'

export default async function LoginPage() {
  // Check session server-side
  const supabase = createServerComponentClient({ cookies })
  const { data: { session }, error } = await supabase.auth.getSession()

  if (error) {
    console.error('Error fetching session:', error.message)
  }

  // If session exists, skip login and redirect
  if (session) redirect('/dashboard')

  // Otherwise, render login form
  return <LoginForm />
}
