import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = createServerComponentClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) redirect('/auth/login')

  const user = session.user

  return (
    <div>
      <h1>Welcome, {user.email}</h1>
      <form action="/api/auth/logout" method="POST">
        <button type="submit">Logout</button>
      </form>
    </div>
  )
}
