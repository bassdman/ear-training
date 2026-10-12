export type Exercise = {
  id: string
  name: string
  // MIDI-Noten in Originaltonhöhe
  notes: number[]
}

// Welche Silbe bei den Aufwärm-Schritten gesungen wird: keine, pro Ton zufällig oder immer dieselbe
export type SyllableMode =
  | { mode: 'off' }
  | { mode: 'random' }
  | { mode: 'fixed'; syllable: string }

// Halbtöne relativ zum Original oder beliebige Tonhöhe
export type Transposition = number | 'random'

export type SectionKind = 'single' | 'pairs' | 'random' | 'original' | 'lyrics' | 'selection'

// null steht für eine Pause (nur im Liedtext)
export type Step = {
  notes: (number | null)[]
  syllables?: string[]
  durationsS?: number[]
  noteValues?: SongNoteValue[]
}

export type Section = {
  kind: SectionKind
  title: string
  steps: Step[]
}

export type SongNoteValue = 'whole' | 'half' | 'quarter' | 'eighth'

// note null = Pause; fehlender duration-Wert bedeutet Viertelnote.
export type SongNote = {
  note: number | null
  text: string
  duration?: SongNoteValue
  textParts?: string[]
}

export type Song = {
  id: string
  name: string
  // Viertelnoten pro Minute
  beatsPerMinute?: number
  lines: SongNote[][]
}
