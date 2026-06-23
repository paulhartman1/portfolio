import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
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

  // Fetch the journey map with project info
  const { data: journeyMap, error: mapError } = await supabase
    .from('journey_maps')
    .select(`
      *,
      projects (
        id,
        name,
        subdomain
      )
    `)
    .eq('slug', slug)
    .eq('is_public', true)
    .single()

  if (mapError || !journeyMap) {
    notFound()
  }

  // Fetch connectors
  const { data: connectors } = await supabase
    .from('journey_map_connectors')
    .select('from_note_id, to_note_id')
    .eq('map_id', journeyMap.id)

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

  const formattedConnectors =
    connectors?.map((conn) => ({
      fromId: conn.from_note_id,
      toId: conn.to_note_id,
    })) || []

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-sky-500 to-emerald-500">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 backdrop-blur-md bg-slate-900/95 border-b border-slate-700/50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/" className="flex items-center gap-3 group">
              <Image
                src="/logo.png"
                alt="Love On Dev Logo"
                className="object-cover rounded-full"
                width={50}
                height={50}
              />
              <span className="text-xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent group-hover:scale-105 transition-transform">
                Love On Dev
              </span>
            </Link>
            <div className="flex items-center gap-6">
              <Link
                href="/"
                className="text-slate-200 hover:text-purple-400 transition-colors font-medium"
              >
                Home
              </Link>
              <a
                href="https://tidycal.com/loveondev"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-full hover:from-purple-700 hover:to-indigo-700 hover:scale-105 transition-all shadow-lg"
              >
                Book a Call
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Page Header */}
      <header className="bg-white/10 backdrop-blur-lg border-b border-white/20 mt-[88px]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {journeyMap.projects && (
            <div className="text-sm text-white/60 mb-2">
              Project: {journeyMap.projects.name}
            </div>
          )}
          <h1 className="text-3xl font-bold text-white">{journeyMap.title}</h1>
          {journeyMap.description && (
            <p className="text-white/80 mt-2">{journeyMap.description}</p>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
          <JourneyCanvas
            initialNotes={formattedNotes}
            initialConnectors={formattedConnectors}
            readOnly={true}
          />
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
