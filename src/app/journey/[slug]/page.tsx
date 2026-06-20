import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import JourneyCanvas from '@/components/journey/JourneyCanvas'

type Note = {
  id: string
  content: string
  color: 'blue' | 'green' | 'red' | 'yellow'
  x: number
  y: number
  width: number
  height: number
}

export default async function PublicJourneyMapPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  // Fetch the journey map
  const { data: journeyMap, error: mapError } = await supabase
    .from('journey_maps')
    .select('*')
    .eq('slug', slug)
    .eq('is_public', true)
    .single()

  if (mapError || !journeyMap) {
    notFound()
  }

  // Fetch the notes
  const { data: notes, error: notesError } = await supabase
    .from('journey_map_notes')
    .select('*')
    .eq('map_id', journeyMap.id)
    .order('z_index', { ascending: true })

  if (notesError) {
    console.error('Error fetching notes:', notesError)
  }

  const formattedNotes: Note[] =
    notes?.map((note) => ({
      id: note.id,
      content: note.content,
      color: note.color as 'blue' | 'green' | 'red' | 'yellow',
      x: parseFloat(note.x_position),
      y: parseFloat(note.y_position),
      width: parseFloat(note.width),
      height: parseFloat(note.height),
    })) || []

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-sky-500 to-emerald-500">
      <header className="bg-white/10 backdrop-blur-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-white">{journeyMap.title}</h1>
          {journeyMap.description && (
            <p className="text-white/80 mt-2">{journeyMap.description}</p>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
          <JourneyCanvas initialNotes={formattedNotes} readOnly={true} />
        </div>

        <div className="mt-6 bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-white mb-3">About This Journey Map</h2>
          <p className="text-white/80">
            This interactive journey map visualizes the user experience flow. Each colored sticky note represents a
            different aspect of the journey:
          </p>
          <ul className="mt-4 space-y-2 text-white/80">
            <li className="flex items-center gap-2">
              <span className="w-4 h-4 bg-blue-200 border-2 border-blue-300 rounded"></span>
              <strong>Persona</strong> - Who the user is at this stage
            </li>
            <li className="flex items-center gap-2">
              <span className="w-4 h-4 bg-green-200 border-2 border-green-300 rounded"></span>
              <strong>Touchpoint</strong> - Where the user interacts with the product/service
            </li>
            <li className="flex items-center gap-2">
              <span className="w-4 h-4 bg-red-200 border-2 border-red-300 rounded"></span>
              <strong>Pain Point</strong> - Challenges or frustrations the user experiences
            </li>
            <li className="flex items-center gap-2">
              <span className="w-4 h-4 bg-yellow-200 border-2 border-yellow-300 rounded"></span>
              <strong>Opportunity</strong> - Potential improvements or positive moments
            </li>
          </ul>
        </div>
      </main>
    </div>
  )
}
