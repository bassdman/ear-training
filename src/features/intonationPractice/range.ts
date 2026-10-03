export type NoteRange = { min: number; max: number }

// MIDI-Grenzen der Auswahl: c2 bis c6
export const NOTE_RANGE_BOUNDS: NoteRange = { min: 36, max: 84 }
export const DEFAULT_NOTE_RANGE: NoteRange = { min: 48, max: 72 }

export function isValidRange(value: unknown): value is NoteRange {
  if (typeof value !== 'object' || value === null) return false
  const { min, max } = value as Partial<NoteRange>
  return (
    Number.isInteger(min) &&
    Number.isInteger(max) &&
    min! >= NOTE_RANGE_BOUNDS.min &&
    max! <= NOTE_RANGE_BOUNDS.max &&
    min! <= max!
  )
}

// Alle Starttöne (MIDI), bei denen die ganze Übung innerhalb der Range liegt.
export function startNotesInRange(notes: readonly number[], range: NoteRange): number[] {
  const lowestOffset = Math.min(...notes) - notes[0]
  const highestOffset = Math.max(...notes) - notes[0]

  const starts: number[] = []
  for (let start = range.min; start <= range.max; start++) {
    if (start + lowestOffset >= range.min && start + highestOffset <= range.max) starts.push(start)
  }
  return starts
}
