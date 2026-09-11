import { INTONATION_INSTRUMENT_OPTIONS, INTONATION_SETTINGS_STORAGE_KEY } from '../config'
import type { IntonationSettings } from '../types'

export function readIntonationSettings(): IntonationSettings {
  const defaultSettings: IntonationSettings = {
    microphoneEnabled: false,
    selectedInstrumentId: 'none',
  }

  try {
    const storedValue = window.localStorage.getItem(INTONATION_SETTINGS_STORAGE_KEY)
    if (!storedValue) return defaultSettings

    const storedSettings = JSON.parse(storedValue) as Partial<IntonationSettings>
    const isValidInstrument = INTONATION_INSTRUMENT_OPTIONS.some(
      (instrument) => instrument.id === storedSettings.selectedInstrumentId,
    )

    return {
      microphoneEnabled: storedSettings.microphoneEnabled === true,
      selectedInstrumentId: isValidInstrument ? storedSettings.selectedInstrumentId! : 'none',
    }
  } catch {
    return defaultSettings
  }
}

export function saveIntonationSettings(settings: IntonationSettings): void {
  try {
    window.localStorage.setItem(INTONATION_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Ignore storage errors
  }
}
