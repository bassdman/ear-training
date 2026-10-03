export type Exercise = {
  id: string
  name: string
  // MIDI-Noten in Originaltonhöhe
  notes: number[]
}

// Halbtöne relativ zum Original oder beliebige Tonhöhe
export type Transposition = number | 'random'

export type SectionKind = 'single' | 'pairs' | 'random' | 'original'

export type Section = {
  kind: SectionKind
  title: string
  steps: number[][]
}
