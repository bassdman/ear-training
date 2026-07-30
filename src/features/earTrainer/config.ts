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
    oscillatorType: 'triangle' as OscillatorType,
    envelope: { attack: 0.005, decay: 0.22, sustain: 0.15, release: 1.1 },
  },
  guitar: {
    label: 'Gitarre',
    oscillatorType: 'sawtooth' as OscillatorType,
    envelope: { attack: 0.003, decay: 0.18, sustain: 0.04, release: 0.75 },
  },
  flute: {
    label: 'Flöte',
    oscillatorType: 'sine' as OscillatorType,
    envelope: { attack: 0.06, decay: 0.08, sustain: 0.82, release: 0.5 },
  },
  organ: {
    label: 'Orgel',
    oscillatorType: 'square' as OscillatorType,
    envelope: { attack: 0.01, decay: 0.04, sustain: 0.92, release: 0.65 },
  },
} as const

export type ToneStyleId = Extract<keyof typeof TONE_STYLES, string>
export const TONE_STYLE_IDS = Object.keys(TONE_STYLES) as ToneStyleId[]

export type Trial = {
  note: NoteName
  toneStyle: ToneStyleId
}

export type Feedback = {
  correct: boolean
  guessed: NoteName
  actual: NoteName
  toneStyle: ToneStyleId
}

export type ProgressState = {
  levelIdx?: number
  sectionIdx?: number
  bestStreak?: number
  unlockedLevelIdx?: number
}

export const PROGRESS_STORAGE_KEY = 'earTrainer-progress-v2'
export const SECTION_COUNT = 4
export const STREAK_TARGET = 5
