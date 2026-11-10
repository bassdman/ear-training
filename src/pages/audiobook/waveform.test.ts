import { describe, expect, it } from 'vitest'

import { extractWaveform, formatSeconds, getTickInterval } from './waveform'

describe('Wellenform und Zeitskala', () => {
  it('ermittelt die maximalen Absolutwerte aller Kanäle je Zeitabschnitt', () => {
    const channels = [
      new Float32Array([0.1, -0.5, 0.2, 0]),
      new Float32Array([0.3, 0.1, -0.8, 0.4]),
    ]
    const buffer = {
      duration: 0.02,
      sampleRate: 200,
      numberOfChannels: 2,
      getChannelData: (channel: number) => channels[channel],
    }
    const result = extractWaveform(buffer as AudioBuffer)
    expect(result.peaks).toHaveLength(2)
    expect(result.peaks[0]).toBeCloseTo(0.5)
    expect(result.peaks[1]).toBeCloseTo(0.8)
  })

  it('verkleinert die Sekundenabstände beim Hineinzoomen', () => {
    const wide = getTickInterval(5)
    const close = getTickInterval(200)
    expect(wide).toBe(20)
    expect(close).toBe(0.5)
    expect(formatSeconds(1.5, close)).toBe('1.5 s')
    expect(formatSeconds(20, wide)).toBe('20 s')
  })
})
