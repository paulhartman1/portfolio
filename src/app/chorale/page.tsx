import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import ChoraleBrowser from './ChoraleBrowser'
import type { ChoralePerformance, ChoraleTrack } from './types'

export default async function ChoralePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login?redirect=/chorale')
  }

  const { data: performancesData, error: performancesError } = await supabase
    .from('performances')
    .select('id, title, description, performance_date, sort_order')
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
    .order('performance_date', { ascending: false })

  if (performancesError) {
    console.error('chorale performances query failed', performancesError)
  }

  const { data: tracksData, error: tracksError } = await supabase
    .from('rehearsal_tracks')
    .select('id, performance_id, title, description, composer, duration_seconds, sort_order')
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true })

  if (tracksError) {
    console.error('chorale tracks query failed', tracksError)
  }

  const performances = (performancesData ?? []) as ChoralePerformance[]
  const tracks = (tracksData ?? []) as ChoraleTrack[]

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-sky-500 to-emerald-500 px-4 py-10">
      <div className="max-w-6xl mx-auto">
        <ChoraleBrowser performances={performances} tracks={tracks} />
      </div>
    </div>
  )
}
