'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/utils/supabase/client'
import JourneyCanvas from '@/components/journey/JourneyCanvas'

type NoteColor = 'blue' | 'green' | 'red' | 'yellow'

type Note = {
  id: string
  content: string
  color: NoteColor
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
  project_id: string
  title: string
  slug: string
  description: string | null
  is_public: boolean
  projects: {
    name: string
    subdomain: string
  }
}

export default function EditJourneyMapPage() {
  const params = useParams()
  const router = useRouter()
  const mapId = params.id as string

  const [journeyMap, setJourneyMap] = useState<JourneyMap | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  useEffect(() => {
    loadJourneyMap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId])

  async function loadJourneyMap() {
    setLoading(true)

    // Load journey map
    const { data: mapData, error: mapError } = await supabaseBrowser
      .from('journey_maps')
      .select(`
        *,
        projects (
          name,
          subdomain
        )
      `)
      .eq('id', mapId)
      .single()

    if (mapError || !mapData) {
      console.error('Error loading journey map:', mapError)
      alert('Journey map not found')
      router.push('/admin/journey')
      return
    }

    setJourneyMap(mapData)

    // Load notes
    const { data: notesData, error: notesError } = await supabaseBrowser
      .from('journey_map_notes')
      .select('*')
      .eq('map_id', mapId)
      .order('z_index', { ascending: true })

    if (notesError) {
      console.error('Error loading notes:', notesError)
    }

    const formattedNotes: Note[] =
      notesData?.map((note) => ({
        id: note.id,
        content: note.content,
        color: note.color as NoteColor,
        x: parseFloat(note.x_position),
        y: parseFloat(note.y_position),
        width: parseFloat(note.width),
        height: parseFloat(note.height),
      })) || []

    setNotes(formattedNotes)

    // Load connectors
    const { data: connectorsData, error: connectorsError } = await supabaseBrowser
      .from('journey_map_connectors')
      .select('from_note_id, to_note_id')
      .eq('map_id', mapId)

    if (connectorsError) {
      console.error('Error loading connectors:', connectorsError)
    }

    const formattedConnectors: Connector[] =
      connectorsData?.map((conn) => ({
        fromId: conn.from_note_id,
        toId: conn.to_note_id,
      })) || []

    setConnectors(formattedConnectors)
    setLoading(false)
  }

  function handleNotesChange(updatedNotes: Note[]) {
    setNotes(updatedNotes)
    setHasUnsavedChanges(true)
  }

  function handleConnectorsChange(updatedConnectors: Connector[]) {
    setConnectors(updatedConnectors)
    setHasUnsavedChanges(true)
  }

  async function saveChanges() {
    setSaving(true)

    // Delete all existing notes and connectors for this map
    await supabaseBrowser.from('journey_map_notes').delete().eq('map_id', mapId)
    await supabaseBrowser.from('journey_map_connectors').delete().eq('map_id', mapId)

    // Insert all notes and get back their IDs
    const idMapping = new Map<string, string>()
    if (notes.length > 0) {
      const notesToInsert = notes.map((note, index) => ({
        map_id: mapId,
        content: note.content,
        color: note.color,
        x_position: note.x,
        y_position: note.y,
        width: note.width,
        height: note.height,
        z_index: index,
      }))

      const { data: insertedNotes, error: notesError } = await supabaseBrowser
        .from('journey_map_notes')
        .insert(notesToInsert)
        .select('id')

      if (notesError) {
        console.error('Error saving notes:', notesError)
        alert('Failed to save notes')
        setSaving(false)
        return
      }

      // Build mapping from old client IDs to new DB IDs
      if (insertedNotes) {
        notes.forEach((note, idx) => {
          idMapping.set(note.id, insertedNotes[idx].id)
        })
      }
    }

    // Insert connectors with mapped IDs
    if (connectors.length > 0 && idMapping.size > 0) {
      const connectorsToInsert = connectors
        .filter((conn) => idMapping.has(conn.fromId) && idMapping.has(conn.toId))
        .map((conn) => ({
          map_id: mapId,
          from_note_id: idMapping.get(conn.fromId)!,
          to_note_id: idMapping.get(conn.toId)!,
        }))

      if (connectorsToInsert.length > 0) {
        const { error: connectorsError } = await supabaseBrowser
          .from('journey_map_connectors')
          .insert(connectorsToInsert)

        if (connectorsError) {
          console.error('Error saving connectors:', connectorsError)
          alert('Failed to save connectors')
          setSaving(false)
          return
        }
      }
    }

    setHasUnsavedChanges(false)
    setSaving(false)
    alert('Changes saved successfully!')
  }

  if (loading) {
    return <div className="text-white text-center py-12">Loading...</div>
  }

  if (!journeyMap) {
    return <div className="text-white text-center py-12">Journey map not found</div>
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/admin/journey')}
          className="text-white/60 hover:text-white mb-4"
        >
          ← Back to Journey Maps
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">{journeyMap.title}</h1>
            <div className="text-white/80 space-y-1">
              <p>{journeyMap.projects?.name}</p>
              <p className="text-sm">
                Portal: /portal/{journeyMap.projects?.subdomain}/journey
              </p>
              {journeyMap.is_public && (
                <p className="text-sm">
                  Public: /journey/{journeyMap.slug}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={saveChanges}
            disabled={!hasUnsavedChanges || saving}
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
          >
            {saving ? 'Saving...' : hasUnsavedChanges ? 'Save Changes *' : 'Saved'}
          </button>
        </div>
        {hasUnsavedChanges && (
          <p className="text-yellow-300 text-sm mt-2">
            * You have unsaved changes
          </p>
        )}
      </div>

      {/* Canvas */}
      <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
        <JourneyCanvas
          initialNotes={notes}
          readOnly={false}
          onNotesChange={handleNotesChange}
          initialConnectors={connectors}
          onConnectorsChange={handleConnectorsChange}
        />
      </div>
    </div>
  )
}
