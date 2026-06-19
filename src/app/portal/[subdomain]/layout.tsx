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
  const { project, isAdmin, hasAccess } = await getPortalContext(subdomain)

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-sky-500 to-emerald-500">
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Access Denied</h1>
          <p className="text-white/80">You don&apos;t have permission to view this project.</p>
        </div>
      </div>
    )
  }

  const navItems = [
    { label: 'Home', href: `/portal/${subdomain}` },
    { label: 'Preview', href: `/portal/${subdomain}/preview` },
    { label: 'Approvals', href: `/portal/${subdomain}/approvals` },
    { label: 'Files', href: `/portal/${subdomain}/files` },
    { label: 'Updates', href: `/portal/${subdomain}/updates` },
    { label: 'Messages', href: `/portal/${subdomain}/messages` },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-sky-500 to-emerald-500">
      <header className="bg-white/10 backdrop-blur-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-wrap gap-4 justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-white">{project.name}</h1>
              <p className="text-white/70 text-sm">
                {project.profiles?.company || project.profiles?.display_name || 'Client Portal'}
              </p>
            </div>
            <div className="flex gap-3">
              {isAdmin && (
                <Link
                  href="/admin"
                  className="px-4 py-2 rounded-lg bg-white/20 text-white hover:bg-white/30"
                >
                  Admin
                </Link>
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
          <nav className="mt-4 flex flex-wrap gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white/15 text-white hover:bg-white/25"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  )
}
