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

export type SectionKind = 'single' | 'pairs' | 'random' | 'original'

export type Step = {
  notes: number[]
  syllables?: string[]
}

export type Section = {
  kind: SectionKind
  title: string
  steps: Step[]
}
