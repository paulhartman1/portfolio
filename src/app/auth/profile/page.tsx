import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function ProfilePage() {
  const supabase = createServerComponentClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) redirect('/auth/login')


  return (
    < div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-900 from-10% via-sky-500 via-30% to-emerald-500 to-90%">
      <div className="bg-white/5 backdrop-blur-lg border border-white/20 rounded-2xl shadow-lg p-10 w-full max-w-md text-center">
        <h1 className="text-4xl font-bold text-white mb-4">Welcome to Swoboda Studios</h1>
        <p className="text-white/80 mb-8">
          Please set up your profile before accessing the dashboard.
        </p>
        <form action="/api/auth/profile" method="POST">
            <input type="text" name="first_name" placeholder="First Name" className="w-full px-4 py-2 mb-4 border border-white/20 rounded-lg bg-transparent text-white" />
            <input type="text" name="last_name" placeholder="Last Name" className="w-full px-4 py-2 mb-4 border border-white/20 rounded-lg bg-transparent text-white" />
            <input type="text" name="company" placeholder="Company" className="w-full px-4 py-2 mb-4 border border-white/20 rounded-lg bg-transparent text-white" />    
            <input type="text" name="phone" placeholder="Phone Number" className="w-full px-4 py-2 mb-4 border border-white/20 rounded-lg bg-transparent text-white" /> 
            <select name="pronouns" className="w-full px-4 py-2 mb-4 border border-white/20 rounded-lg bg-transparent text-white">
                <option value="" disabled defaultValue={''} selected>Select Pronouns</option>
                <option value="she/her">She/Her</option>
                <option value="he/him">He/Him</option>
                <option value="they/them">They/Them</option>
                <option value="other">Other</option>
            </select>
          <button
            type="submit"
            className="w-full px-6 py-3 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold hover:scale-105 transition-transform shadow-lg"
          >
            Save Profile
          </button>
        </form>
      </div>
    </div>
  )
}
