'use client'

import { useRef, useState } from 'react'
import StickyNote from './StickyNote'

type NoteColor = 'blue' | 'green' | 'red' | 'yellow'

interface Note {
  id: string
  content: string
  color: NoteColor
  x: number
  y: number
  width: number
  height: number
}

interface JourneyCanvasProps {
  initialNotes: Note[]
  readOnly?: boolean
  onNotesChange?: (notes: Note[]) => void
}

export default function JourneyCanvas({ initialNotes, readOnly = false, onNotesChange }: JourneyCanvasProps) {
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const canvasRef = useRef<HTMLDivElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (readOnly) return

    const noteId = e.dataTransfer.getData('text/plain')
    const offsetX = parseFloat(e.dataTransfer.getData('offsetX') || '0')
    const offsetY = parseFloat(e.dataTransfer.getData('offsetY') || '0')

    if (!canvasRef.current) return

    const canvasRect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - canvasRect.left - offsetX
    const y = e.clientY - canvasRect.top - offsetY

    const updatedNotes = notes.map((note) =>
      note.id === noteId ? { ...note, x: Math.max(0, x), y: Math.max(0, y) } : note
    )

    setNotes(updatedNotes)
    onNotesChange?.(updatedNotes)
  }

  const handleNoteUpdate = (id: string, updates: Partial<Omit<Note, 'id'>>) => {
    const updatedNotes = notes.map((note) => (note.id === id ? { ...note, ...updates } : note))
    setNotes(updatedNotes)
    onNotesChange?.(updatedNotes)
  }

  const handleAddNote = () => {
    const newNote: Note = {
      id: crypto.randomUUID(),
      content: '',
      color: 'blue',
      x: 50,
      y: 50,
      width: 200,
      height: 150,
    }
    const updatedNotes = [...notes, newNote]
    setNotes(updatedNotes)
    onNotesChange?.(updatedNotes)
  }


  return (
    <div className="relative w-full h-full">
      {!readOnly && (
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          <button
            onClick={handleAddNote}
            className="px-4 py-2 bg-white border-2 border-gray-300 rounded-lg shadow-md hover:bg-gray-50 font-semibold text-sm"
          >
            + Add Note
          </button>
        </div>
      )}

      <div
        ref={canvasRef}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-300 rounded-lg relative overflow-auto"
        style={{ minHeight: '600px' }}
      >
        {notes.map((note) => (
          <StickyNote
            key={note.id}
            id={note.id}
            content={note.content}
            color={note.color}
            x={note.x}
            y={note.y}
            width={note.width}
            height={note.height}
            onUpdate={handleNoteUpdate}
            readOnly={readOnly}
          />
        ))}
      </div>

      {!readOnly && (
        <div className="mt-4 p-4 bg-white border-2 border-gray-300 rounded-lg">
          <h3 className="font-semibold mb-2">Instructions</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Drag notes to reposition them</li>
            <li>• Double-click a note to edit its content</li>
            <li>• Click the color buttons to change note type</li>
            <li>
              • Colors: <span className="text-blue-600 font-semibold">Blue = Persona</span>,{' '}
              <span className="text-green-600 font-semibold">Green = Touchpoint</span>,{' '}
              <span className="text-red-600 font-semibold">Red = Pain Point</span>,{' '}
              <span className="text-yellow-600 font-semibold">Yellow = Opportunity</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
