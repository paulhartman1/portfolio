import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerComponentClient({ cookies })
  
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-sky-500 to-emerald-500">
      <nav className="bg-white/10 backdrop-blur-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex space-x-8">
              <Link
                href="/admin"
                className="inline-flex items-center px-4 text-white hover:text-white/80 font-medium"
              >
                Clients
              </Link>
              <Link
                href="/admin/projects"
                className="inline-flex items-center px-4 text-white hover:text-white/80 font-medium"
              >
                Projects
              </Link>
              <Link
                href="/admin/comments"
                className="inline-flex items-center px-4 text-white hover:text-white/80 font-medium"
              >
                Comments
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-white/80 text-sm">Admin: {user.email}</span>
              <form action="/api/auth/logout" method="POST">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-white/20 text-white hover:bg-white/30 text-sm font-medium"
                >
                  Logout
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
