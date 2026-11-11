import { describe, expect, it, vi } from 'vitest'

import * as pitch from '../../features/tuner/pitch'
import { analyzeReferencePitch } from './referencePitch'

describe('Referenztonhöhen', () => {
  it('erkennt einen Ton und setzt die Zeitpunkte an den Clipbeginn', () => {
    const sampleRate = 16000
    const samples = Float32Array.from({ length: sampleRate }, (_, i) => 0.3 * Math.sin(2 * Math.PI * 220 * i / sampleRate))
    const points = analyzeReferencePitch({ id: 'clip', samples, sampleRate, start: 12.5, octaveSkipFrames: 2 })
    expect(points).toHaveLength(20)
    expect(points[0].timeMs).toBe(12500)
    expect(points[10].timeMs).toBe(13000)
    expect(points[10].frequency).toBeCloseTo(220, 0)
  })

  it('erkennt Stille als Lücke und weist ungültige Audiodaten zurück', () => {
    const points = analyzeReferencePitch({ id: 'clip', samples: new Float32Array(8000), sampleRate: 8000, start: 0, octaveSkipFrames: 2 })
    expect(points.every((point) => point.frequency === null)).toBe(true)
    expect(() => analyzeReferencePitch({ id: 'clip', samples: new Float32Array(1), sampleRate: 0, start: 0, octaveSkipFrames: 2 })).toThrow()
  })

  it('filtert Oktavsprünge in der Referenz und bestätigt anhaltende Wechsel', () => {
    const frequencies = [220, 440, 220, 440, 440, 440, null, 220]
    const analyzer = vi.spyOn(pitch, 'createPitchAnalyzer').mockReturnValue(() => frequencies.shift() ?? null)
    try {
      const points = analyzeReferencePitch({ id: 'clip', samples: new Float32Array(400), sampleRate: 1000, start: 5, octaveSkipFrames: 2 })
      expect(points.map((point) => point.frequency)).toEqual([220, null, 220, null, null, 440, null, 220])
      expect(points.map((point) => point.rawFrequency)).toEqual([220, 440, 220, 440, 440, 440, null, 220])
      expect(points[1].timeMs).toBe(5050)
    } finally {
      analyzer.mockRestore()
    }
  })

  it('filtert im Debug-Trace beobachtete große Sprünge und behält ihre Rohwerte', () => {
    const frequencies = [196.82843525927052, 446.4459060989098, 222.66966367604047]
    const analyzer = vi.spyOn(pitch, 'createPitchAnalyzer').mockReturnValue(() => frequencies.shift() ?? null)
    try {
      const points = analyzeReferencePitch({ id: 'clip', samples: new Float32Array(150), sampleRate: 1000, start: 28.37667677878304, octaveSkipFrames: 1 })
      expect(points.map((point) => point.frequency)).toEqual([196.82843525927052, null, 222.66966367604047])
      expect(points[1].rawFrequency).toBe(446.4459060989098)
      expect(points[1].timeMs / 1000).toBeCloseTo(28.42667677878304, 8)
    } finally {
      analyzer.mockRestore()
    }
  })

  it.each([
    [0, [220, 440, 440, 440]],
    [1, [220, null, 440, 440]],
    [3, [220, null, null, null]],
  ])('wendet %i übersprungene Frames auf die Referenz an', (octaveSkipFrames, expected) => {
    const frequencies = [220, 440, 440, 440]
    const analyzer = vi.spyOn(pitch, 'createPitchAnalyzer').mockReturnValue(() => frequencies.shift() ?? null)
    try {
      const points = analyzeReferencePitch({ id: 'clip', samples: new Float32Array(200), sampleRate: 1000, start: 0, octaveSkipFrames })
      expect(points.map((point) => point.frequency)).toEqual(expected)
    } finally {
      analyzer.mockRestore()
    }
  })
})
