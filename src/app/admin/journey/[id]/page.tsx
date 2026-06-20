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
    setLoading(false)
  }

  function handleNotesChange(updatedNotes: Note[]) {
    setNotes(updatedNotes)
    setHasUnsavedChanges(true)
  }

  async function saveChanges() {
    setSaving(true)

    // Delete all existing notes for this map
    await supabaseBrowser
      .from('journey_map_notes')
      .delete()
      .eq('map_id', mapId)

    // Insert all notes
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

      const { error } = await supabaseBrowser
        .from('journey_map_notes')
        .insert(notesToInsert)

      if (error) {
        console.error('Error saving notes:', error)
        alert('Failed to save notes')
        setSaving(false)
        return
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
        />
      </div>
    </div>
  )
}
