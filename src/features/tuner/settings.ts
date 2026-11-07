export type TunerSettings = {
  minVolumeRms: number
  minPitchClarity: number
  minFrequencyHz: number
  maxFrequencyHz: number
  analysisFftSize: number
  analysisIntervalMs: number
  maxSampleGapMs: number
  windowMs: number
}

export const DEFAULT_TUNER_SETTINGS: Readonly<TunerSettings> = {
  minVolumeRms: 0.008,
  minPitchClarity: 0.85,
  minFrequencyHz: 55,
  maxFrequencyHz: 1200,
  analysisFftSize: 4096,
  analysisIntervalMs: 50,
  maxSampleGapMs: 250,
  windowMs: 5000,
}

export const TUNER_SETTINGS_STORAGE_KEY = 'ear-training-tuner-settings-v1'

export function validateTunerSettings(value: TunerSettings): string | null {
  const { minVolumeRms, minPitchClarity, minFrequencyHz, maxFrequencyHz,
    analysisFftSize, analysisIntervalMs, maxSampleGapMs, windowMs } = value
  if (!Number.isFinite(minVolumeRms) || minVolumeRms < 0 || minVolumeRms > 1
    || !Number.isFinite(minPitchClarity) || minPitchClarity < 0 || minPitchClarity > 1) {
    return 'Lautstärke und Klarheit müssen zwischen 0 und 1 liegen.'
  }
  if (!Number.isFinite(minFrequencyHz) || !Number.isFinite(maxFrequencyHz)
    || minFrequencyHz <= 0 || maxFrequencyHz > 24000 || minFrequencyHz >= maxFrequencyHz) {
    return 'Die untere Frequenz muss größer als 0 und kleiner als die obere Frequenz (höchstens 24000 Hz) sein.'
  }
  if (!Number.isInteger(analysisFftSize) || analysisFftSize < 32 || analysisFftSize > 32768
    || !Number.isInteger(Math.log2(analysisFftSize))) {
    return 'Das Analysefenster muss eine Zweierpotenz zwischen 32 und 32768 sein.'
  }
  if (!Number.isInteger(analysisIntervalMs) || !Number.isInteger(maxSampleGapMs)
    || !Number.isInteger(windowMs) || analysisIntervalMs < 1
    || maxSampleGapMs <= analysisIntervalMs || windowMs < 1
    || analysisIntervalMs > 600000 || maxSampleGapMs > 600000 || windowMs > 600000) {
    return 'Zeiten müssen ganze Millisekunden zwischen 1 und 600000 sein; der Lückenabstand muss größer als das Analyseintervall sein.'
  }
  return null
}

export function readTunerSettings(): { settings: TunerSettings, error: string | null } {
  try {
    const stored = localStorage.getItem(TUNER_SETTINGS_STORAGE_KEY)
    if (stored === null) return { settings: { ...DEFAULT_TUNER_SETTINGS }, error: null }
    const parsed: unknown = JSON.parse(stored)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('Ungültiges Einstellungsformat')
    }
    const values = Object.fromEntries(Object.entries(parsed))
    const keys = Object.keys(DEFAULT_TUNER_SETTINGS) as (keyof TunerSettings)[]
    if (keys.some((key) => typeof values[key] !== 'number')) throw new Error('Unvollständige Einstellungen')
    const settings = { ...DEFAULT_TUNER_SETTINGS }
    for (const key of keys) {
      const value = values[key]
      if (typeof value !== 'number') throw new Error('Ungültiger Einstellungswert')
      settings[key] = value
    }
    const error = validateTunerSettings(settings)
    if (error) throw new Error(error)
    return { settings, error: null }
  } catch (error) {
    console.error('Tuner-Einstellungen konnten nicht geladen werden:', error)
    return { settings: { ...DEFAULT_TUNER_SETTINGS }, error: 'Gespeicherte Einstellungen konnten nicht geladen werden. Standardwerte werden verwendet.' }
  }
}
