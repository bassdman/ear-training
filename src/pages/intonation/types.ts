import type { INSTRUMENTS } from '../../features/earTrainer/config'

export type InstrumentId = keyof typeof INSTRUMENTS

export type IntonationInstrumentId = 'none' | 'random' | InstrumentId

export type IntonationSettings = {
  microphoneEnabled: boolean
  selectedInstrumentId: IntonationInstrumentId
}

export type PitchResult = {
  detectedNote: string
  cents: number
  isInTune: boolean
}

export type ActiveNote = string | null

export type NoteConfig = {
  note: string
  octave: number
  disabled: boolean
}
