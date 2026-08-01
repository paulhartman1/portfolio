'use client'

import Link from 'next/link'
import { EngagementSessionProvider } from '@/contexts/EngagementSessionContext'
import { CaptureDock } from '@/components/CaptureDock'

const navItems = [
  { label: 'Clients', href: '/admin' },
  { label: 'Projects', href: '/admin/projects' },
  { label: 'Comments', href: '/admin/comments' },
  { label: 'Journey Maps', href: '/admin/journey' },
  { label: 'Chorale', href: '/admin/chorale' },
  { label: 'Record', href: '/admin/record' },
]

export function AdminLayoutClient({
  userEmail,
  children,
}: {
  userEmail: string
  children: React.ReactNode
}) {
  return (
    <EngagementSessionProvider>
      <div className="min-h-screen bg-[#F8F7F5] text-[#1A0F2E]">
        <header className="bg-[#290D47] border-b border-[#1A0F2E]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-wrap gap-4 justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-white">Admin</h1>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-white/80 text-sm">Admin: {userEmail}</span>
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
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-white/90 hover:bg-white/10 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <CaptureDock />
      </div>
    </EngagementSessionProvider>
  )
}
