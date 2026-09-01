import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export default async function ChooseProjectPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data } = await supabase
    .from('project_clients')
    .select('projects(id, name, subdomain)')
    .eq('client_id', user.id)

  const projects = (data || [])
    .map((row) => Array.isArray(row.projects) ? row.projects[0] : row.projects)
    .filter((project): project is { id: string; name: string; subdomain: string } => Boolean(project?.subdomain))

  return <main className="min-h-screen bg-[#F8F7F5] px-6 py-12 text-[#1A0F2E]">
    <section className="mx-auto max-w-lg rounded-2xl bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold">Choose a project</h1>
      <p className="mt-2 text-sm text-[#6B6785]">Select the project workspace you want to open.</p>
      <div className="mt-6 space-y-3">
        {projects.map((project) => <Link key={project.id} href={`/portal/${project.subdomain}`} className="block rounded-lg border border-[#E8E4EF] p-4 font-medium hover:bg-[#F8F7F5]">{project.name}</Link>)}
      </div>
    </section>
  </main>
}
