import { afterEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_TUNER_SETTINGS, readTunerSettings, TUNER_SETTINGS_STORAGE_KEY, validateTunerSettings } from './settings'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('Tuner-Einstellungen', () => {
  it('lehnt ungültige Bereiche und ungültige Zweierpotenzen ab', () => {
    for (const change of [
      { minVolumeRms: -1 }, { minPitchClarity: 1.1 }, { minFrequencyHz: 1200 },
      { maxFrequencyHz: 24001 }, { analysisFftSize: 1000 }, { analysisIntervalMs: 250 },
      { maxSampleGapMs: 50 }, { windowMs: 0 }, { windowMs: Number.NaN },
    ]) expect(validateTunerSettings({ ...DEFAULT_TUNER_SETTINGS, ...change })).not.toBeNull()
    expect(validateTunerSettings({ ...DEFAULT_TUNER_SETTINGS })).toBeNull()
  })

  it('meldet beschädigte gespeicherte Werte und verwendet Standardwerte', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.setItem(TUNER_SETTINGS_STORAGE_KEY, '{"windowMs":-1}')
    const result = readTunerSettings()
    expect(result.settings).toEqual(DEFAULT_TUNER_SETTINGS)
    expect(result.error).toContain('konnten nicht geladen werden')
    expect(localStorage.getItem(TUNER_SETTINGS_STORAGE_KEY)).toBe('{"windowMs":-1}')
  })
})
