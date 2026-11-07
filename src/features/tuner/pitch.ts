import { PitchDetector } from 'pitchy'

import { DEFAULT_TUNER_SETTINGS, type TunerSettings } from './settings'

export type PitchPoint = { timeMs: number, frequency: number | null }

const NOTE_NAMES = ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis', 'A', 'Ais', 'H']

export function frequencyToMidi(frequency: number): number {
  return 69 + 12 * Math.log2(frequency / 440)
}

export function describePitch(frequency: number) {
  const position = frequencyToMidi(frequency)
  const midi = Math.round(position)
  const note = NOTE_NAMES[((midi % 12) + 12) % 12]
  return {
    note: `${note}${Math.floor(midi / 12) - 1}`,
    cents: Math.round((position - midi) * 100) || 0,
  }
}

export function formatMidi(midi: number): string {
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`
}

export function createPitchAnalyzer(size: number, settings: TunerSettings = DEFAULT_TUNER_SETTINGS) {
  const detector = PitchDetector.forFloat32Array(size)
  detector.minVolumeAbsolute = settings.minVolumeRms
  return (samples: Float32Array, sampleRate: number): number | null => {
    const [frequency, clarity] = detector.findPitch(samples, sampleRate)
    return Number.isFinite(frequency)
      && frequency >= settings.minFrequencyHz
      && frequency <= settings.maxFrequencyHz
      && clarity >= settings.minPitchClarity
      ? frequency
      : null
  }
}
