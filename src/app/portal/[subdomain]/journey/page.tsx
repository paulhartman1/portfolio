import { getPortalContext } from '../_lib'
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

export default async function PortalJourneyMapPage({
  params,
}: {
  params: Promise<{ subdomain: string }>
}) {
  const { subdomain } = await params
  const { project, supabase, hasAccess } = await getPortalContext(subdomain)

  if (!hasAccess) return null

  // Fetch journey map for this project
  const { data: journeyMap, error: mapError } = await supabase
    .from('journey_maps')
    .select('*')
    .eq('project_id', project.id)
    .single()

  if (mapError && mapError.code !== 'PGRST116') {
    console.error('Error fetching journey map:', mapError)
  }

  // Fetch notes if map exists
  let notes: Array<{
    id: string
    content: string
    color: string
    x_position: string
    y_position: string
    width: string
    height: string
  }> = []
  if (journeyMap) {
    const { data: fetchedNotes, error: notesError } = await supabase
      .from('journey_map_notes')
      .select('*')
      .eq('map_id', journeyMap.id)
      .order('z_index', { ascending: true })

    if (notesError) {
      console.error('Error fetching notes:', notesError)
    } else {
      notes = fetchedNotes || []
    }
  }

  const formattedNotes: Note[] = notes.map((note) => ({
    id: note.id,
    content: note.content,
    color: note.color as 'blue' | 'green' | 'red' | 'yellow',
    x: parseFloat(note.x_position),
    y: parseFloat(note.y_position),
    width: parseFloat(note.width),
    height: parseFloat(note.height),
  }))

  return (
    <div className="space-y-6">
      <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
        <h2 className="text-2xl font-bold text-white mb-2">Your Journey Map</h2>
        <p className="text-white/80 mb-4">
          {journeyMap
            ? "This is your project journey map showing the user experience flow we've designed together."
            : "No journey map has been created for this project yet. Your LoveOnDev consultant will create one during your discovery session."}
        </p>

        {journeyMap && (
          <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-4 mb-4">
            <h3 className="text-lg font-semibold text-white">{journeyMap.title}</h3>
            {journeyMap.description && <p className="text-white/70 mt-1">{journeyMap.description}</p>}
          </div>
        )}
      </div>

      {journeyMap && (
        <>
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
            <JourneyCanvas initialNotes={formattedNotes} readOnly={true} />
          </div>

          <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
            <h3 className="text-xl font-semibold text-white mb-3">Understanding the Journey Map</h3>
            <p className="text-white/80 mb-4">
              Each colored sticky note represents a different aspect of your user&apos;s journey:
            </p>
            <ul className="space-y-2 text-white/80">
              <li className="flex items-center gap-2">
                <span className="w-4 h-4 bg-blue-200 border-2 border-blue-300 rounded"></span>
                <strong>Persona</strong> - Who the user is at this stage
              </li>
              <li className="flex items-center gap-2">
                <span className="w-4 h-4 bg-green-200 border-2 border-green-300 rounded"></span>
                <strong>Touchpoint</strong> - Where the user interacts with your product/service
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
        </>
      )}

      {!journeyMap && (
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 text-center">
          <p className="text-white/70">
            Journey mapping helps us understand your users&apos; experience and identify opportunities for improvement.
            We&apos;ll work on this together during our next session.
          </p>
        </div>
      )}
    </div>
  )
}
