import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'

export default async function AdminProjects() {
  const supabase = await createClient()

  // Get all projects with client info
  const { data: projects } = await supabase
    .from('projects')
    .select(`
      *,
      profiles (
        email,
        display_name,
        company
      )
    `)
    .order('created_at', { ascending: false })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200'
      case 'paused': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'completed': return 'bg-blue-100 text-blue-800 border-blue-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Projects</h1>
        <p className="text-white/80">Manage all client preview sites</p>
      </div>

      <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-white">All Projects</h2>
          <Link
            href="/admin/projects/new"
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold hover:scale-105 transition-transform"
          >
            + New Project
          </Link>
        </div>

        {!projects || projects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-white/60">No projects yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-white/5 border border-white/20 rounded-lg p-4"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white">
                        {project.name}
                      </h3>
                      <span className={`px-2 py-1 rounded text-xs font-semibold uppercase border ${getStatusColor(project.status)}`}>
                        {project.status}
                      </span>
                    </div>
                    
                    {project.description && (
                      <p className="text-white/60 text-sm mb-2">{project.description}</p>
                    )}
                    
                    <div className="flex items-center gap-4 text-sm">
                      {project.url && (
                        <a
                          href={project.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-300 hover:text-blue-200"
                        >
                          {project.url}
                        </a>
                      )}
                      <span className="text-white/60">
                        Client: {project.profiles?.display_name || project.profiles?.email}
                      </span>
                    </div>
                  </div>
                  
                  <Link
                    href={`/admin/projects/${project.id}`}
                    className="px-3 py-1 rounded bg-white/20 text-white hover:bg-white/30 text-sm"
                  >
                    Manage
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
