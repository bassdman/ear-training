import { describe, expect, it } from 'vitest'

import { ANALYSIS_FFT_SIZE, MAX_FREQUENCY_HZ, MIN_FREQUENCY_HZ, MIN_VOLUME_RMS } from './config'
import { createPitchAnalyzer, describePitch, frequencyToMidi } from './pitch'

describe('Tonhöhenerkennung', () => {
  it('ordnet Frequenzen stufenlos Noten und Cent zu', () => {
    expect(frequencyToMidi(440)).toBe(69)
    expect(describePitch(440)).toEqual({ note: 'A4', cents: 0 })
    const halfway = 440 * 2 ** (0.5 / 12)
    expect(frequencyToMidi(halfway)).toBeCloseTo(69.5)
    expect(Math.abs(describePitch(halfway).cents)).toBe(50)
  })

  it('erkennt echte Sinussignale mit Pitchy und verwirft Stille', () => {
    const sampleRate = 48000
    const analyze = createPitchAnalyzer(ANALYSIS_FFT_SIZE)
    for (const frequency of [70, 110, 440, 880]) {
      const samples = Float32Array.from({ length: ANALYSIS_FFT_SIZE }, (_, index) =>
        0.3 * Math.sin(2 * Math.PI * frequency * index / sampleRate),
      )
      expect(analyze(samples, sampleRate)).toBeCloseTo(frequency, 0)
    }
    expect(analyze(new Float32Array(ANALYSIS_FFT_SIZE), sampleRate)).toBeNull()
  })

  it('wendet die konfigurierte Lautstärke- und Frequenzgrenze an', () => {
    const sampleRate = 48000
    const analyze = createPitchAnalyzer(ANALYSIS_FFT_SIZE)
    const tone = (frequency: number, amplitude: number) =>
      Float32Array.from({ length: ANALYSIS_FFT_SIZE }, (_, index) =>
        amplitude * Math.sin(2 * Math.PI * frequency * index / sampleRate),
      )

    expect(analyze(tone(440, MIN_VOLUME_RMS), sampleRate)).toBeNull()
    expect(analyze(tone(440, MIN_VOLUME_RMS * 2), sampleRate)).toBeCloseTo(440, 0)
    expect(analyze(tone(MIN_FREQUENCY_HZ * 0.8, 0.3), sampleRate)).toBeNull()
    expect(analyze(tone(MAX_FREQUENCY_HZ * 1.2, 0.3), sampleRate)).toBeNull()
  })
})
