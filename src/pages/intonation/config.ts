import type { IntonationInstrumentId } from './types'

export const ASSETS_URL = 'http://intonation.manuelgelsen.de/assets'

export const possibleNotes = [
  'c2-disabled', 'cis2-disabled', 'd2-disabled', 'dis2-disabled', 'e2', 'f2', 'fis2', 'g2', 'gis2', 'a2', 'ais2', 'h2',
  'c3', 'cis3', 'd3', 'dis3', 'e3', 'f3', 'fis3', 'g3', 'gis3', 'a3', 'ais3', 'h3',
  'c4', 'cis4', 'd4', 'dis4', 'e4', 'f4', 'fis4', 'g4', 'gis4', 'a4', 'ais4', 'h4',
  'c5', 'cis5', 'd5', 'dis5', 'e5', 'f5-disabled', 'fis5-disabled', 'g5-disabled', 'gis5-disabled', 'a5-disabled', 'ais5-disabled', 'h5-disabled',
]

export const noteLabels = ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis', 'A', 'Ais', 'H']
export const noteNames = ['c', 'cis', 'd', 'dis', 'e', 'f', 'fis', 'g', 'gis', 'a', 'ais', 'h']
export const blackKeys = [false, true, false, true, false, false, true, false, true, false, true, false]

export const PITCH_TOLERANCE_CENTS = 50
export const REQUIRED_STABLE_SAMPLES = 8
export const REFERENCE_TONE_DURATION_MS = 900
export const INTONATION_SETTINGS_STORAGE_KEY = 'ear-training-intonation-settings-v1'

export const INTONATION_INSTRUMENT_OPTIONS: { id: IntonationInstrumentId, label: string }[] = [
  { id: 'none', label: 'Keines' },
  { id: 'random', label: 'Zufällig' },
  { id: 'piano', label: 'Klavier' },
  { id: 'guitar', label: 'Gitarre' },
  { id: 'flute', label: 'Flöte' },
  { id: 'organ', label: 'Orgel' },
]
