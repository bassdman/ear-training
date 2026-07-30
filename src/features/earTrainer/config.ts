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

export const TONE_STYLES = {
  piano: {
    label: 'Klavier',
    playbackEngine: 'soundfont' as const,
    soundfontInstrument: 'acoustic_grand_piano',
    oscillatorType: 'triangle' as OscillatorType,
    envelope: { attack: 0.005, decay: 0.22, sustain: 0.15, release: 1.1 },
  },
  guitar: {
    label: 'Gitarre',
    playbackEngine: 'soundfont' as const,
    soundfontInstrument: 'acoustic_guitar_nylon',
    oscillatorType: 'sawtooth' as OscillatorType,
    envelope: { attack: 0.003, decay: 0.18, sustain: 0.04, release: 0.75 },
  },
  flute: {
    label: 'Flöte',
    playbackEngine: 'soundfont' as const,
    soundfontInstrument: 'flute',
    oscillatorType: 'sine' as OscillatorType,
    envelope: { attack: 0.06, decay: 0.08, sustain: 0.82, release: 0.5 },
  },
  organ: {
    label: 'Orgel',
    playbackEngine: 'soundfont' as const,
    soundfontInstrument: 'church_organ',
    oscillatorType: 'square' as OscillatorType,
    envelope: { attack: 0.01, decay: 0.04, sustain: 0.92, release: 0.65 },
  },
  synthWarm: {
    label: 'Synth Warm',
    playbackEngine: 'synth' as const,
    soundfontInstrument: 'acoustic_grand_piano',
    oscillatorType: 'triangle' as OscillatorType,
    envelope: { attack: 0.02, decay: 0.18, sustain: 0.62, release: 0.45 },
  },
  synthBright: {
    label: 'Synth Bright',
    playbackEngine: 'synth' as const,
    soundfontInstrument: 'acoustic_grand_piano',
    oscillatorType: 'sawtooth' as OscillatorType,
    envelope: { attack: 0.003, decay: 0.12, sustain: 0.36, release: 0.28 },
  },
  synthSoft: {
    label: 'Synth Soft',
    playbackEngine: 'synth' as const,
    soundfontInstrument: 'acoustic_grand_piano',
    oscillatorType: 'sine' as OscillatorType,
    envelope: { attack: 0.05, decay: 0.1, sustain: 0.74, release: 0.5 },
  },
  synthPulse: {
    label: 'Synth Pulse',
    playbackEngine: 'synth' as const,
    soundfontInstrument: 'acoustic_grand_piano',
    oscillatorType: 'square' as OscillatorType,
    envelope: { attack: 0.004, decay: 0.07, sustain: 0.5, release: 0.22 },
  },
} as const

export type ToneStyleId = Extract<keyof typeof TONE_STYLES, string>
export const TONE_STYLE_IDS = Object.keys(TONE_STYLES) as ToneStyleId[]
export type ToneStyleMode = ToneStyleId | 'auto'

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

export type ProgressState = {
  activeCategoryIdx?: number
  categoryProgress?: CategoryProgressState[]
  levelIdx?: number
  sectionIdx?: number
  bestStreak?: number
  unlockedLevelIdx?: number
  toneStyleMode?: ToneStyleMode
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
