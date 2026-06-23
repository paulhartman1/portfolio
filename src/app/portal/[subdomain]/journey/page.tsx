'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabaseBrowser } from '@/utils/supabase/client'
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

type Connector = {
  fromId: string
  toId: string
}

type JourneyMap = {
  id: string
  title: string
  description: string | null
  project_id: string
  created_at: string
}

export default function PortalJourneyMapPage() {
  const params = useParams()
  const subdomain = params.subdomain as string
  
  const [journeyMaps, setJourneyMaps] = useState<JourneyMap[]>([])
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subdomain])

  async function loadData() {
    setLoading(true)

    // Get user and project
    const { data: { user } } = await supabaseBrowser.auth.getUser()
    if (!user) {
      window.location.href = `/auth/login?redirect=/portal/${subdomain}/journey`
      return
    }

    const { data: projectData } = await supabaseBrowser
      .from('projects')
      .select('*')
      .eq('subdomain', subdomain)
      .single()

    if (!projectData || projectData.client_id !== user.id) {
      setLoading(false)
      return
    }

    // Fetch all journey maps for this project
    const { data: maps, error: mapError } = await supabaseBrowser
      .from('journey_maps')
      .select('*')
      .eq('project_id', projectData.id)
      .order('created_at', { ascending: true })

    if (mapError) {
      console.error('Error fetching journey maps:', mapError)
    }

    const journeyMaps = maps || []
    setJourneyMaps(journeyMaps)

    // Select the first map by default if there is one
    if (journeyMaps.length > 0 && !selectedMapId) {
      setSelectedMapId(journeyMaps[0].id)
      await loadNotesForMap(journeyMaps[0].id)
    }

    setLoading(false)
  }

  async function loadNotesForMap(mapId: string) {
    // Load notes
    const { data: fetchedNotes, error: notesError } = await supabaseBrowser
      .from('journey_map_notes')
      .select('*')
      .eq('map_id', mapId)
      .order('z_index', { ascending: true })

    if (notesError) {
      console.error('Error fetching notes:', notesError)
      return
    }

    const formattedNotes: Note[] = (fetchedNotes || []).map((note) => ({
      id: note.id,
      content: note.content,
      color: note.color as 'blue' | 'green' | 'red' | 'yellow',
      x: parseFloat(note.x_position),
      y: parseFloat(note.y_position),
      width: parseFloat(note.width),
      height: parseFloat(note.height),
    }))

    setNotes(formattedNotes)

    // Load connectors
    const { data: fetchedConnectors, error: connectorsError } = await supabaseBrowser
      .from('journey_map_connectors')
      .select('from_note_id, to_note_id')
      .eq('map_id', mapId)

    if (connectorsError) {
      console.error('Error fetching connectors:', connectorsError)
      return
    }

    const formattedConnectors: Connector[] = (fetchedConnectors || []).map((conn) => ({
      fromId: conn.from_note_id,
      toId: conn.to_note_id,
    }))

    setConnectors(formattedConnectors)
  }

  async function handleMapChange(mapId: string) {
    // Clear current data first to prevent showing wrong data
    setNotes([])
    setConnectors([])
    setSelectedMapId(mapId)
    await loadNotesForMap(mapId)
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-white text-xl">Loading journey maps...</p>
      </div>
    )
  }

  const selectedMap = journeyMaps.find(m => m.id === selectedMapId)

  return (
    <div className="space-y-6">
      <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
        <h2 className="text-2xl font-bold text-white mb-2">Your Journey Maps</h2>
        <p className="text-white/80 mb-4">
          {journeyMaps.length > 0
            ? "Select a journey map below to explore the user experience flows we've designed together."
            : "No journey maps have been created for this project yet. Your LoveOnDev consultant will create them during your discovery session."}
        </p>

        {journeyMaps.length > 0 && (
          <div className="space-y-4">
            <div>
              <label className="block text-white/80 text-sm font-semibold mb-2">Select Journey Map:</label>
              <select
                value={selectedMapId || ''}
                onChange={(e) => handleMapChange(e.target.value)}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
              >
                {journeyMaps.map((map) => (
                  <option key={map.id} value={map.id} className="bg-gray-800">
                    {map.title}
                  </option>
                ))}
              </select>
            </div>

            {selectedMap && (
              <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white">{selectedMap.title}</h3>
                {selectedMap.description && <p className="text-white/70 mt-1">{selectedMap.description}</p>}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedMap && (
        <>
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
            <JourneyCanvas
              key={selectedMapId}
              initialNotes={notes}
              initialConnectors={connectors}
              readOnly={true}
            />
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
    </div>
  )
}
