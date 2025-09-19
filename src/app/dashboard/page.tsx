import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = createServerComponentClient({ cookies })
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr) console.error('Error fetching user data:', userErr.message)

  //check if 
let displayName: string | null = null
  if (user?.id) {
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()

    if (profileErr && profileErr.code !== 'PGRST116') { // ignore "no rows" style
      console.error('profiles select error', profileErr)
    }
    displayName = profile?.display_name ?? user.user_metadata?.display_name ?? null
    if(displayName === null) {
      //redirect to profile if no display name
      redirect('/auth/profile')
    }
  } else {
    //redirect to login if no user
  }

  return (
    < div className="min-h-screen flex flex-col items-center justify-center  p-8">
      <div className="bg-white/5 backdrop-blur-lg border border-white/20 rounded-2xl shadow-lg p-10 w-full max-w-md text-center">
        <h1 className="text-4xl font-bold text-white mb-4">Welcome, {user?.user_metadata.display_name}</h1>
        <p className="text-white/80 mb-8">
          You are logged in to Swoboda Studios client portal.
        </p>

        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="w-full px-6 py-3 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold hover:scale-105 transition-transform shadow-lg"
          >
            Logout
          </button>
        </form>
      </div>
    </div>
  )
}
