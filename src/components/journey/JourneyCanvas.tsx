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

interface Connector {
  fromId: string
  toId: string
}

interface JourneyCanvasProps {
  initialNotes: Note[]
  readOnly?: boolean
  onNotesChange?: (notes: Note[]) => void
  initialConnectors?: Connector[]
  onConnectorsChange?: (connectors: Connector[]) => void
}

export default function JourneyCanvas({
  initialNotes,
  readOnly = false,
  onNotesChange,
  initialConnectors = [],
  onConnectorsChange,
}: JourneyCanvasProps) {
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [connectors, setConnectors] = useState<Connector[]>(initialConnectors)
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const canvasRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Zoom handlers
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY * -0.01
      const newZoom = Math.min(Math.max(0.1, zoom + delta), 3)
      setZoom(newZoom)
    }
  }

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.1, 3))
  }

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.1, 0.1))
  }

  const handleResetZoom = () => {
    setZoom(1)
    setPanOffset({ x: 0, y: 0 })
  }

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      e.preventDefault()
      setIsPanning(true)
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      })
    }
  }

  const handleMouseUp = () => {
    setIsPanning(false)
  }

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

    if (!contentRef.current) return

    const contentRect = contentRef.current.getBoundingClientRect()
    const x = (e.clientX - contentRect.left - panOffset.x) / zoom - offsetX
    const y = (e.clientY - contentRect.top - panOffset.y) / zoom - offsetY

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

  const handleDeleteNote = (id: string) => {
    const updatedNotes = notes.filter((note) => note.id !== id)
    const updatedConnectors = connectors.filter(
      (conn) => conn.fromId !== id && conn.toId !== id
    )
    setNotes(updatedNotes)
    setConnectors(updatedConnectors)
    onNotesChange?.(updatedNotes)
    onConnectorsChange?.(updatedConnectors)
  }

  const handleConnectorClick = (noteId: string) => {
    if (readOnly) return

    if (connectingFrom === null) {
      setConnectingFrom(noteId)
    } else if (connectingFrom === noteId) {
      setConnectingFrom(null)
    } else {
      const newConnector = { fromId: connectingFrom, toId: noteId }
      const updatedConnectors = [...connectors, newConnector]
      setConnectors(updatedConnectors)
      onConnectorsChange?.(updatedConnectors)
      setConnectingFrom(null)
    }
  }

  const deleteConnector = (fromId: string, toId: string) => {
    const updatedConnectors = connectors.filter(
      (conn) => !(conn.fromId === fromId && conn.toId === toId)
    )
    setConnectors(updatedConnectors)
    onConnectorsChange?.(updatedConnectors)
  }

  const getConnectorPath = (fromId: string, toId: string) => {
    const fromNote = notes.find((n) => n.id === fromId)
    const toNote = notes.find((n) => n.id === toId)
    if (!fromNote || !toNote) return null

    const fromX = fromNote.x + fromNote.width / 2
    const fromY = fromNote.y + fromNote.height / 2
    const toX = toNote.x + toNote.width / 2
    const toY = toNote.y + toNote.height / 2

    return { fromX, fromY, toX, toY }
  }


  return (
    <div className="relative w-full h-full">
      {/* Zoom controls */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        <button
          onClick={handleZoomIn}
          className="w-10 h-10 bg-white border-2 border-gray-300 rounded-lg shadow-md hover:bg-gray-50 font-bold text-lg flex items-center justify-center"
          title="Zoom in (Ctrl+scroll)"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          className="w-10 h-10 bg-white border-2 border-gray-300 rounded-lg shadow-md hover:bg-gray-50 font-bold text-lg flex items-center justify-center"
          title="Zoom out (Ctrl+scroll)"
        >
          −
        </button>
        <button
          onClick={handleResetZoom}
          className="w-10 h-10 bg-white border-2 border-gray-300 rounded-lg shadow-md hover:bg-gray-50 font-bold text-xs flex items-center justify-center"
          title="Reset zoom and pan"
        >
          1:1
        </button>
        <div className="text-xs text-center bg-white border-2 border-gray-300 rounded-lg px-2 py-1 font-semibold">
          {Math.round(zoom * 100)}%
        </div>
      </div>

      {!readOnly && (
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          <button
            onClick={handleAddNote}
            className="px-4 py-2 bg-white border-2 border-gray-300 rounded-lg shadow-md hover:bg-gray-50 font-semibold text-sm"
          >
            + Add Note
          </button>
          {connectingFrom && (
            <button
              onClick={() => setConnectingFrom(null)}
              className="px-4 py-2 bg-red-100 border-2 border-red-300 rounded-lg shadow-md hover:bg-red-200 font-semibold text-sm"
            >
              Cancel Connection
            </button>
          )}
        </div>
      )}

      <div
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-300 rounded-lg relative overflow-hidden"
        style={{ 
          minHeight: '600px',
          cursor: isPanning ? 'grabbing' : 'default'
        }}
      >
        <div
          ref={contentRef}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="relative w-full h-full"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            minWidth: '2000px',
            minHeight: '2000px',
          }}
        >
          {/* SVG for connectors */}
          <svg
            className="absolute top-0 left-0 pointer-events-none"
            style={{ zIndex: 0, width: '2000px', height: '2000px' }}
          >
          {connectors.map((conn, idx) => {
            const path = getConnectorPath(conn.fromId, conn.toId)
            if (!path) return null
            return (
              <g key={idx}>
                <line
                  x1={path.fromX}
                  y1={path.fromY}
                  x2={path.toX}
                  y2={path.toY}
                  stroke="#666"
                  strokeWidth="2"
                  markerEnd="url(#arrowhead)"
                />
                {!readOnly && (
                  <circle
                    cx={(path.fromX + path.toX) / 2}
                    cy={(path.fromY + path.toY) / 2}
                    r="8"
                    fill="white"
                    stroke="#666"
                    strokeWidth="2"
                    className="cursor-pointer pointer-events-auto"
                    onClick={() => deleteConnector(conn.fromId, conn.toId)}
                  />
                )}
              </g>
            )
          })}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 10 3, 0 6" fill="#666" />
            </marker>
          </defs>
          </svg>

          {/* Notes */}
          {notes.map((note) => (
            <div
              key={note.id}
              className="relative"
              style={{ zIndex: 1 }}
            >
            <StickyNote
              id={note.id}
              content={note.content}
              color={note.color}
              x={note.x}
              y={note.y}
              width={note.width}
              height={note.height}
              onUpdate={handleNoteUpdate}
              onDelete={handleDeleteNote}
              readOnly={readOnly}
            />
            {!readOnly && (
              <button
                onClick={() => handleConnectorClick(note.id)}
                className={`absolute bottom-2 right-2 w-6 h-6 rounded-full border-2 ${
                  connectingFrom === note.id
                    ? 'bg-blue-500 border-blue-700'
                    : 'bg-white border-gray-400 hover:border-blue-500'
                } flex items-center justify-center text-xs font-bold`}
                style={{
                  left: `${note.x + note.width - 30}px`,
                  top: `${note.y + note.height - 30}px`,
                  zIndex: 10,
                }}
                title="Connect to another note"
              >
                →
              </button>
            )}
            </div>
          ))}
        </div>
      </div>

      {!readOnly && (
        <div className="mt-4 p-4 bg-white border-2 border-gray-300 rounded-lg">
          <h3 className="font-semibold mb-2">Instructions</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Drag notes to reposition them</li>
            <li>• Double-click a note to edit its content</li>
            <li>• Click X on a note to delete it</li>
            <li>• Click → button on a note to start/complete a connection</li>
            <li>• Click the white circle on a connector line to delete it</li>
            <li>• Click the color buttons to change note type</li>
            <li>• Hold Ctrl/Cmd + scroll to zoom in/out</li>
            <li>• Hold Shift + drag or use middle mouse button to pan</li>
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
