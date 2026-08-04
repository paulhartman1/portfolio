import { createClient } from '@/utils/supabase/server'

export default async function UpdatePasswordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // The recovery link establishes the session in /api/auth/callback before we
  // get here. No user means the link was expired, already used, or opened
  // without going through the callback.
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white/5 backdrop-blur-lg border border-white/20 rounded-2xl p-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-3">Link No Longer Valid</h1>
          <p className="text-white/70 mb-6">
            This password reset link has expired or has already been used. Request a new one to continue.
          </p>
          <a
            href="/auth/login"
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-pink-500 to-purple-500 px-6 py-3 text-sm font-bold text-white transition hover:scale-105"
          >
            Request New Reset Link
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white/5 backdrop-blur-lg border border-white/20 rounded-2xl p-8">
        <h1 className="text-3xl font-bold text-white mb-3">Set New Password</h1>
        <p className="text-white/70 mb-6">Choose a new password for your account.</p>

        <form action="/api/auth/update-password" method="POST" className="space-y-4">
          <div>
            <label className="block text-white/80 mb-2">New Password</label>
            <input
              type="password"
              name="password"
              required
              minLength={8}
              className="w-full px-4 py-3 rounded-md bg-white/5 text-white"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label className="block text-white/80 mb-2">Confirm New Password</label>
            <input
              type="password"
              name="confirm_password"
              required
              minLength={8}
              className="w-full px-4 py-3 rounded-md bg-white/5 text-white"
              placeholder="Repeat new password"
            />
          </div>

          <button
            type="submit"
            className="w-full px-4 py-3 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold"
          >
            Update Password
          </button>
        </form>
      </div>
    </div>
  )
}
