const NOTE_NAMES = ['c', 'cis', 'd', 'dis', 'e', 'f', 'fis', 'g', 'gis', 'a', 'ais', 'h'] as const
const DEFAULT_OCTAVE = 4
const NOTE_PATTERN = /^(cis|dis|fis|gis|ais|c|d|e|f|g|a|h)(-?\d)?$/

// MIDI-Nummer: c4 = 60
export function parseNote(token: string): number | null {
  const match = NOTE_PATTERN.exec(token.trim().toLowerCase())
  if (!match) return null

  const pitchClass = NOTE_NAMES.indexOf(match[1] as (typeof NOTE_NAMES)[number])
  const octave = match[2] === undefined ? DEFAULT_OCTAVE : Number(match[2])
  return (octave + 1) * 12 + pitchClass
}

export function formatNote(midi: number): string {
  const pitchClass = ((midi % 12) + 12) % 12
  const octave = Math.floor(midi / 12) - 1
  return `${NOTE_NAMES[pitchClass]}${octave}`
}

export type ParsedSequence = { notes: number[] } | { error: string }

export function parseNoteSequence(input: string): ParsedSequence {
  const tokens = input.split(/[\s,\-–]+/).filter(Boolean)
  if (tokens.length === 0) return { error: 'Bitte mindestens einen Ton eingeben.' }

  const notes: number[] = []
  for (const token of tokens) {
    const midi = parseNote(token)
    if (midi === null) return { error: `Unbekannter Ton: "${token}"` }
    notes.push(midi)
  }
  return { notes }
}

export function transposeNotes(notes: readonly number[], semitones: number): number[] {
  return notes.map((note) => note + semitones)
}
