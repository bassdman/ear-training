export const NOTE_FREQS = {
  C: 261.63,
  Cis: 277.18,
  D: 293.66,
  Dis: 311.13,
  E: 329.63,
  F: 349.23,
  Fis: 369.99,
  G: 392.0,
  Gis: 415.3,
  A: 440.0,
  Ais: 466.16,
  H: 493.88,
} as const

export type NoteName = Extract<keyof typeof NOTE_FREQS, string>

export const EXERCISES = [
  ['D', 'F', 'A'],
  ['C', 'D', 'F', 'A'],
  ['C', 'D', 'F', 'G', 'A'],
  ['C', 'D', 'E', 'F', 'G', 'A'],
  ['C', 'D', 'E', 'F', 'G', 'A', 'H'],
  ['C', 'D', 'E', 'F', 'G', 'A', 'H'],
  ['C', 'Cis', 'D', 'E', 'F', 'G', 'A', 'H'],
  ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'G', 'A', 'H'],
  ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'A', 'H'],
  ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis', 'A', 'H'],
  ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis', 'A', 'Ais', 'H'],
  ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis', 'A', 'Ais', 'H'],
] as const

export const LEVEL_COUNT = EXERCISES.length

export const INSTRUMENTS = {
  piano: {
    label: 'Klavier',
    playbackEngine: 'soundfont' as const,
    soundfontInstrument: 'acoustic_grand_piano',
    oscillatorType: 'triangle' as OscillatorType,
  },
  guitar: {
    label: 'Gitarre',
    playbackEngine: 'soundfont' as const,
    soundfontInstrument: 'acoustic_guitar_nylon',
    oscillatorType: 'sawtooth' as OscillatorType,
  },
  flute: {
    label: 'Flöte',
    playbackEngine: 'soundfont' as const,
    soundfontInstrument: 'flute',
    oscillatorType: 'sine' as OscillatorType,
  },
  organ: {
    label: 'Orgel',
    playbackEngine: 'soundfont' as const,
    soundfontInstrument: 'church_organ',
    oscillatorType: 'square' as OscillatorType,
  },
} as const

export type InstrumentId = Extract<keyof typeof INSTRUMENTS, string>
export const INSTRUMENT_IDS = Object.keys(INSTRUMENTS) as InstrumentId[]

export const TONE_STYLES = {
  colorA: {
    label: 'Klangfarbe A',
    oscillatorType: 'triangle' as OscillatorType,
    velocity: 88,
    detuneCents: -3,
    envelope: { attack: 0.018, decay: 0.16, sustain: 0.62, release: 0.42 },
  },
  colorB: {
    label: 'Klangfarbe B',
    oscillatorType: 'sawtooth' as OscillatorType,
    velocity: 98,
    detuneCents: 0,
    envelope: { attack: 0.006, decay: 0.11, sustain: 0.4, release: 0.26 },
  },
  colorC: {
    label: 'Klangfarbe C',
    oscillatorType: 'sine' as OscillatorType,
    velocity: 80,
    detuneCents: -7,
    envelope: { attack: 0.05, decay: 0.1, sustain: 0.76, release: 0.5 },
  },
  colorD: {
    label: 'Klangfarbe D',
    oscillatorType: 'square' as OscillatorType,
    velocity: 94,
    detuneCents: 5,
    envelope: { attack: 0.004, decay: 0.08, sustain: 0.52, release: 0.24 },
  },
} as const

export type ToneStyleId = Extract<keyof typeof TONE_STYLES, string>
export const TONE_STYLE_IDS = Object.keys(TONE_STYLES) as ToneStyleId[]

export type Trial = {
  note: NoteName
  toneStyle: ToneStyleId
  frequencyMultiplier: number
}

export type GuessOption = {
  id: string
  note: NoteName
  frequencyMultiplier: number
  label: string
}

export type Feedback = {
  correct: boolean
  guessed: NoteName
  actual: NoteName
  guessedFrequencyMultiplier: number
  actualFrequencyMultiplier: number
  guessedLabel: string
  actualLabel: string
  toneStyle: ToneStyleId
}

export type TrainingCategory = {
  id: string
  label: string
  subtitle: string
  frequencyMultipliers: number[]
}

export const TRAINING_CATEGORIES: TrainingCategory[] = [
  {
    id: 'male-low',
    label: 'Sehr tiefe Männerlage',
    subtitle: 'C2 bis H2',
    frequencyMultipliers: [0.25],
  },
  {
    id: 'low',
    label: 'Tiefe Lage',
    subtitle: 'C3 bis H3',
    frequencyMultipliers: [0.5],
  },
  {
    id: 'mid',
    label: 'Mittlere Lage',
    subtitle: 'C4 bis H4',
    frequencyMultipliers: [1],
  },
  {
    id: 'high',
    label: 'Hohe Lage',
    subtitle: 'C5 bis H5',
    frequencyMultipliers: [2],
  },
  {
    id: 'range-2-3',
    label: 'Lagen 2,3',
    subtitle: 'C2 bis H3',
    frequencyMultipliers: [0.25, 0.5],
  },
  {
    id: 'range-3-4',
    label: 'Lagen 3,4',
    subtitle: 'C3 bis H4',
    frequencyMultipliers: [0.5, 1],
  },
  {
    id: 'range-4-5',
    label: 'Lagen 4,5',
    subtitle: 'C4 bis H5',
    frequencyMultipliers: [1, 2],
  },
  {
    id: 'range-2-3-4',
    label: 'Lagen 2,3,4',
    subtitle: 'C2 bis H4',
    frequencyMultipliers: [0.25, 0.5, 1],
  },
  {
    id: 'range-3-4-5',
    label: 'Lagen 3,4,5',
    subtitle: 'C3 bis H5',
    frequencyMultipliers: [0.5, 1, 2],
  },
  {
    id: 'range-2-3-4-5',
    label: 'Lagen 2,3,4,5',
    subtitle: 'C2 bis H5',
    frequencyMultipliers: [0.25, 0.5, 1, 2],
  },
]

export type CategoryProgressState = {
  levelIdx: number
  sectionIdx: number
  unlockedLevelIdx: number
}

export const TRAINING_DIFFICULTIES = {
  easy: { label: 'Leicht', toneStyleCount: 1 },
  medium: { label: 'Mittel', toneStyleCount: 2 },
  hard: { label: 'Schwer', toneStyleCount: 4 },
} as const

export type DifficultyId = Extract<keyof typeof TRAINING_DIFFICULTIES, string>
export const DIFFICULTY_IDS = Object.keys(TRAINING_DIFFICULTIES) as DifficultyId[]

export type CategoryDifficultyProgressState = Record<DifficultyId, CategoryProgressState[]>

export type ProgressState = {
  activeCategoryIdx?: number
  activeDifficultyId?: DifficultyId
  categoryProgress?: CategoryProgressState[]
  categoryDifficultyProgress?: Partial<Record<DifficultyId, CategoryProgressState[]>>
  levelIdx?: number
  sectionIdx?: number
  bestStreak?: number
  bestStreakByDifficulty?: Partial<Record<DifficultyId, number>>
  unlockedLevelIdx?: number
  selectedInstrumentId?: InstrumentId
  toneStyleMode?: string
  playbackVolume?: number
}

export const PROGRESS_STORAGE_KEY = 'earTrainer-progress-v2'
export const SECTION_COUNT = 4
export const SECTION_STEPS = [5, 5, 5, 10] as const
export const LEVEL_PROGRESS_TOTAL = SECTION_STEPS.reduce((sum, steps) => sum + steps, 0)

export function getOctaveFromMultiplier(frequencyMultiplier: number) {
  return 4 + Math.round(Math.log2(frequencyMultiplier))
}

export function formatPitchLabel(note: NoteName, frequencyMultiplier: number) {
  return `${note.toLowerCase()}${getOctaveFromMultiplier(frequencyMultiplier)}`
}
