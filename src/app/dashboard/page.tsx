import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  
  if (userErr) console.error('Error fetching user data:', userErr.message)
  
  if (!user) {
    redirect('/auth/login')
  }

  // Check if user is admin and redirect to admin panel
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('display_name, is_admin')
    .eq('id', user.id)
    .single()

  if (profileErr && profileErr.code !== 'PGRST116') {
    console.error('profiles select error', profileErr.message || profileErr)
  }

  // Redirect admins to admin panel
  if (profile?.is_admin) {
    redirect('/admin')
  }

  const { data: projects, error: projectsErr } = await supabase
    .from('projects')
    .select('id, name, subdomain, status, project_clients!inner(client_id)')
    .eq('project_clients.client_id', user.id)
    .order('created_at', { ascending: false })

  if (projectsErr) {
    console.error('projects select error', projectsErr.message || projectsErr)
  }

  const projectsWithSubdomain = (projects || []).filter((project) => Boolean(project.subdomain))

  if (projectsWithSubdomain.length === 1) {
    redirect(`/portal/${projectsWithSubdomain[0].subdomain}`)
  }

  const displayName = profile?.display_name ?? user.user_metadata?.display_name ?? null
  
  if (displayName === null) {
    redirect('/auth/profile')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="bg-white/5 backdrop-blur-lg border border-white/20 rounded-2xl shadow-lg p-10 w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-white mb-2">Welcome, {displayName}</h1>

        {projectsWithSubdomain.length > 1 ? (
          <>
            <p className="text-white/80 mb-6">
              Choose a project workspace to continue.
            </p>
            <div className="space-y-3 mb-8">
              {projectsWithSubdomain.map((project) => (
                <Link
                  key={project.id}
                  href={`/portal/${project.subdomain}`}
                  className="block bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg px-4 py-3 transition-colors"
                >
                  <p className="text-white font-semibold">{project.name}</p>
                  <p className="text-white/70 text-sm">{project.subdomain}.loveondev.com</p>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <p className="text-white/80 mb-8">
            Your workspace is being prepared. If you expected project access already, please contact support.
          </p>
        )}

        <form action="/api/auth/logout" method="POST" className="max-w-sm">
          <button
            type="submit"
            className="w-full px-6 py-3 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold hover:scale-105 transition-transform shadow-lg"
          >
            Logout
          </button>
        </form>
      </div>
    </div>
  )
}
