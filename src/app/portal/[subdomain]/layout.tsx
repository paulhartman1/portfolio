import Link from 'next/link'
import { getPortalContext } from './_lib'

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ subdomain: string }>
}) {
  const { subdomain } = await params
  const { project, isAdmin, hasAccess, supabase, user } = await getPortalContext(subdomain)

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F5]">
        <div className="bg-white border border-[#E8E4EF] rounded-xl p-8 max-w-md text-center shadow-sm">
          <h1 className="text-2xl font-bold text-[#1A0F2E] mb-4">Access Denied</h1>
          <p className="text-[#6B6785]">You don&apos;t have permission to view this project.</p>
        </div>
      </div>
    )
  }

  // Get unread message count for this project
  const { count: unreadCount } = await supabase
    .from('client_messages')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', project.id)
    .eq('is_read', false)
    .neq('sender_id', user.id)

  // Primary nav: client job concepts only. Preview + Journey stay routable
  // but are reached contextually (Overview CTAs / deep links), not as peers.
  const navItems = [
    { label: 'Overview', href: `/portal/${subdomain}` },
    { label: 'Decisions', href: `/portal/${subdomain}/approvals` },
    { label: 'Documents', href: `/portal/${subdomain}/files` },
    { label: 'Activity', href: `/portal/${subdomain}/updates` },
    { label: 'Messages', href: `/portal/${subdomain}/messages`, badge: unreadCount || 0 },
  ]

  return (
    <div className="min-h-screen bg-[#F8F7F5] text-[#1A0F2E]">
      <header className="bg-[#290D47] border-b border-[#1A0F2E]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-wrap gap-4 justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-white">{project.name}</h1>
            </div>
            <div className="flex gap-3">
              {isAdmin && (
                <Link
                  href="/admin"
                  className="px-4 py-2 rounded-lg border border-white/25 text-white text-sm hover:bg-white/10"
                >
                  Admin
                </Link>
              )}
              <form action="/api/auth/logout" method="POST">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg border border-white/25 text-white text-sm hover:bg-white/10"
                >
                  Logout
                </button>
              </form>
            </div>
          </div>
          <nav className="mt-4 flex flex-wrap gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-white/90 hover:bg-white/10 hover:text-white relative"
              >
                {item.label}
                {'badge' in item && item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-[#00F5E4] text-[#1A0F2E] text-xs font-bold rounded-full min-w-[1.25rem] text-center">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  )
}
