import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'

export default async function AdminDashboard() {
  const supabase = await createClient()

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
        <h1 className="text-3xl font-bold text-[#1A0F2E] mb-2">Client Portal</h1>
        <p className="text-[#6B6785]">Manage client subdomains and preview sites</p>
      </div>

      <div className="bg-white border border-[#290D47]/15 rounded-2xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-[#1A0F2E]">All Clients</h2>
          <Link
            href="/admin/clients/new"
            className="px-4 py-2 rounded-lg bg-[#00F5E4] text-[#1A0F2E] font-semibold hover:opacity-90"
          >
            + Add Client
          </Link>
        </div>

        {!clients || clients.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#6B6785]">No clients yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {clients.map((client) => (
              <Link
                key={client.id}
                href={`/admin/clients/${client.id}`}
                className="block bg-[#F8F7F5] hover:bg-[#290D47]/5 border border-[#E8E4EF] rounded-xl p-4 transition-all"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-[#1A0F2E]">
                      {client.display_name || client.email}
                    </h3>
                    {client.company && (
                      <p className="text-[#6B6785] text-sm">{client.company}</p>
                    )}
                    <p className="text-[#6B6785] text-sm mt-1">{client.email}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-[#6B6785] text-sm">
                      {client.projects?.[0]?.count || 0} {client.projects?.[0]?.count === 1 ? 'project' : 'projects'}
                    </div>
                    {client.phone && (
                      <div className="text-[#6B6785] text-sm mt-1">{client.phone}</div>
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
