'use client'

import { useState } from 'react'

type NoteColor = 'blue' | 'green' | 'red' | 'yellow'

interface StickyNoteProps {
  id: string
  content: string
  color: NoteColor
  x: number
  y: number
  width: number
  height: number
  onUpdate: (id: string, updates: { content?: string; x?: number; y?: number; color?: NoteColor }) => void
  readOnly?: boolean
}

const colorStyles: Record<NoteColor, string> = {
  blue: 'bg-blue-200 border-blue-300',
  green: 'bg-green-200 border-green-300',
  red: 'bg-red-200 border-red-300',
  yellow: 'bg-yellow-200 border-yellow-300',
}

const colorLabels: Record<NoteColor, string> = {
  blue: 'Persona',
  green: 'Touchpoint',
  red: 'Pain Point',
  yellow: 'Opportunity',
}

export default function StickyNote({
  id,
  content,
  color,
  x,
  y,
  width,
  height,
  onUpdate,
  readOnly = false,
}: StickyNoteProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(content)
  const [isDragging, setIsDragging] = useState(false)

  const handleDragStart = (e: React.DragEvent) => {
    if (readOnly) return
    setIsDragging(true)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
    
    // Store the offset from the top-left of the note
    const rect = e.currentTarget.getBoundingClientRect()
    e.dataTransfer.setData('offsetX', String(e.clientX - rect.left))
    e.dataTransfer.setData('offsetY', String(e.clientY - rect.top))
  }

  const handleDragEnd = () => {
    setIsDragging(false)
  }

  const handleDoubleClick = () => {
    if (readOnly) return
    setIsEditing(true)
  }

  const handleBlur = () => {
    setIsEditing(false)
    if (editContent !== content) {
      onUpdate(id, { content: editContent })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEditContent(content)
      setIsEditing(false)
    }
  }

  return (
    <div
      draggable={!readOnly && !isEditing}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDoubleClick={handleDoubleClick}
      className={`absolute border-2 rounded-lg shadow-lg cursor-move transition-opacity ${
        colorStyles[color]
      } ${isDragging ? 'opacity-50' : 'opacity-100'}`}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        minHeight: `${height}px`,
      }}
    >
      <div className="p-3 h-full flex flex-col">
        <div className="text-xs font-semibold mb-2 opacity-60">{colorLabels[color]}</div>
        {isEditing ? (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            autoFocus
            className="flex-1 bg-transparent border-none outline-none resize-none text-sm"
            placeholder="Enter note content..."
          />
        ) : (
          <div className="flex-1 text-sm whitespace-pre-wrap">
            {content || (readOnly ? '' : 'Double-click to edit')}
          </div>
        )}
        {!readOnly && !isEditing && (
          <div className="flex gap-1 mt-2">
            {(['blue', 'green', 'red', 'yellow'] as NoteColor[]).map((c) => (
              <button
                key={c}
                onClick={() => onUpdate(id, { color: c })}
                className={`w-5 h-5 rounded-full border-2 ${
                  c === color ? 'border-gray-700' : 'border-gray-400'
                } ${colorStyles[c]}`}
                title={colorLabels[c]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
