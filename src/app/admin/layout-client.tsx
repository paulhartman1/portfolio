'use client'

import Link from 'next/link'
import { EngagementSessionProvider } from '@/contexts/EngagementSessionContext'
import { CaptureDock } from '@/components/CaptureDock'

export function AdminLayoutClient({
  userEmail,
  children,
}: {
  userEmail: string
  children: React.ReactNode
}) {
  return (
    <EngagementSessionProvider>
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-sky-500 to-emerald-500">
        <nav className="bg-white/10 backdrop-blur-lg border-b border-white/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex space-x-8">
                <Link
                  href="/admin"
                  className="inline-flex items-center px-4 text-white hover:text-white/80 font-medium"
                >
                  Clients
                </Link>
                <Link
                  href="/admin/projects"
                  className="inline-flex items-center px-4 text-white hover:text-white/80 font-medium"
                >
                  Projects
                </Link>
                <Link
                  href="/admin/comments"
                  className="inline-flex items-center px-4 text-white hover:text-white/80 font-medium"
                >
                  Comments
                </Link>
                <Link
                  href="/admin/journey"
                  className="inline-flex items-center px-4 text-white hover:text-white/80 font-medium"
                >
                  Journey Maps
                </Link>
                <Link
                  href="/admin/chorale"
                  className="inline-flex items-center px-4 text-white hover:text-white/80 font-medium"
                >
                  Chorale
                </Link>
                <Link
                  href="/admin/record"
                  className="inline-flex items-center px-4 text-white hover:text-white/80 font-medium"
                >
                  Record
                </Link>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-white/80 text-sm">Admin: {userEmail}</span>
                <form action="/api/auth/logout" method="POST">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-white/20 text-white hover:bg-white/30 text-sm font-medium"
                  >
                    Logout
                  </button>
                </form>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <CaptureDock />
      </div>
    </EngagementSessionProvider>
  )
}
