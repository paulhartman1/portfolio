import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import Link from 'next/link'

export default async function AdminDashboard() {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })

  // Get all clients (non-admin profiles)
  const { data: clients } = await supabase
    .from('profiles')
    .select(`
      *,
      projects (count)
    `)
    .eq('is_admin', false)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Client Portal</h1>
        <p className="text-white/80">Manage client subdomains and preview sites</p>
      </div>

      <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-white">All Clients</h2>
          <Link
            href="/admin/clients/new"
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold hover:scale-105 transition-transform"
          >
            + Add Client
          </Link>
        </div>

        {!clients || clients.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-white/60">No clients yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {clients.map((client) => (
              <Link
                key={client.id}
                href={`/admin/clients/${client.id}`}
                className="block bg-white/5 hover:bg-white/10 border border-white/20 rounded-lg p-4 transition-all"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {client.display_name || client.email}
                    </h3>
                    {client.company && (
                      <p className="text-white/60 text-sm">{client.company}</p>
                    )}
                    <p className="text-white/40 text-sm mt-1">{client.email}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-white/80 text-sm">
                      {client.projects?.[0]?.count || 0} {client.projects?.[0]?.count === 1 ? 'project' : 'projects'}
                    </div>
                    {client.phone && (
                      <div className="text-white/60 text-sm mt-1">{client.phone}</div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
