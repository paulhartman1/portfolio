export type NoteColor = 'blue' | 'green' | 'red' | 'yellow'

export interface Note {
  id: string
  content: string
  color: NoteColor
  x: number
  y: number
  width: number
  height: number
}

export interface Connector {
  fromId: string
  toId: string
}

export const COLOR_STYLES: Record<NoteColor, string> = {
  blue: 'bg-blue-200 border-blue-300',
  green: 'bg-green-200 border-green-300',
  red: 'bg-red-200 border-red-300',
  yellow: 'bg-yellow-200 border-yellow-300',
}

export const COLOR_LABELS: Record<NoteColor, string> = {
  blue: 'Persona',
  green: 'Touchpoint',
  red: 'Pain Point',
  yellow: 'Opportunity',
}

export const NOTE_COLORS: NoteColor[] = ['blue', 'green', 'red', 'yellow']
