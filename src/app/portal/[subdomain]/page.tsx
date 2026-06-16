import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export default async function ClientPortalPage({
  params,
}: {
  params: Promise<{ subdomain: string }>
}) {
  const { subdomain } = await params
  const supabase = await createClient()

  // Get the project by subdomain
  const { data: project, error } = await supabase
    .from('projects')
    .select(`
      *,
      profiles (
        display_name,
        company
      )
    `)
    .eq('subdomain', subdomain)
    .single()

  if (error || !project) {
    notFound()
  }

  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser()

  // If not logged in, redirect to login
  if (!user) {
    redirect(`/auth/login?redirect=/portal/${subdomain}`)
  }

  // Check if user is the client or an admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.is_admin
  const isClient = user.id === project.client_id

  if (!isAdmin && !isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-sky-500 to-emerald-500">
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Access Denied</h1>
          <p className="text-white/80">You don&apos;t have permission to view this project.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-sky-500 to-emerald-500">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">{project.name}</h1>
              <p className="text-white/60 text-sm">
                {project.profiles?.company || project.profiles?.display_name}
              </p>
            </div>
            <div className="flex gap-4">
              {isAdmin && (
                <a
                  href="/admin"
                  className="px-4 py-2 rounded-lg bg-white/20 text-white hover:bg-white/30"
                >
                  Admin Dashboard
                </a>
              )}
              <form action="/api/auth/logout" method="POST">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-white/20 text-white hover:bg-white/30"
                >
                  Logout
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-2">Project Preview</h2>
          {project.description && (
            <p className="text-white/80 mb-4">{project.description}</p>
          )}
          {project.url ? (
            <div className="bg-white rounded-lg overflow-hidden" style={{ height: '600px' }}>
              <iframe
                src={project.url}
                className="w-full h-full"
                title={project.name}
              />
            </div>
          ) : (
            <div className="bg-white/5 border border-white/20 rounded-lg p-12 text-center">
              <p className="text-white/60">No preview URL configured yet</p>
            </div>
          )}
        </div>

        {/* Comments Section */}
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Leave Feedback</h2>
          <p className="text-white/60">
            Comment system coming soon - you&apos;ll be able to click on the preview and leave notes!
          </p>
        </div>
      </main>
    </div>
  )
}
