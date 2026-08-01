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
        <h1 className="text-3xl font-bold text-[#1A0F2E] mb-2">Projects</h1>
        <p className="text-[#6B6785]">Manage all client preview sites</p>
      </div>

      <div className="bg-white border border-[#290D47]/15 rounded-2xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-[#1A0F2E]">All Projects</h2>
          <Link
            href="/admin/projects/new"
            className="px-4 py-2 rounded-lg bg-[#00F5E4] text-[#1A0F2E] font-semibold hover:opacity-90"
          >
            + New Project
          </Link>
        </div>

        {!projects || projects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#6B6785]">No projects yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-[#F8F7F5] border border-[#E8E4EF] rounded-xl p-4"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-[#1A0F2E]">
                        {project.name}
                      </h3>
                      <span className={`px-2 py-1 rounded text-xs font-semibold uppercase border ${getStatusColor(project.status)}`}>
                        {project.status}
                      </span>
                    </div>
                    
                    {project.description && (
                      <p className="text-[#6B6785] text-sm mb-2">{project.description}</p>
                    )}
                    
                    <div className="flex items-center gap-4 text-sm">
                      {project.url && (
                        <a
                          href={project.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#290D47] hover:opacity-80"
                        >
                          {project.url}
                        </a>
                      )}
                      <span className="text-[#6B6785]">
                        Client: {project.profiles?.display_name || project.profiles?.email || 'No client assigned'}
                      </span>
                    </div>
                  </div>
                  
                  <Link
                    href={`/admin/projects/${project.id}`}
                    className="px-3 py-1 rounded bg-[#290D47] text-white hover:opacity-90 text-sm"
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
