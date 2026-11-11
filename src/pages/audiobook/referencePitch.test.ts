import { describe, expect, it } from 'vitest'

import { analyzeReferencePitch } from './referencePitch'

describe('Referenztonhöhen', () => {
  it('erkennt einen Ton und setzt die Zeitpunkte an den Clipbeginn', () => {
    const sampleRate = 16000
    const samples = Float32Array.from({ length: sampleRate }, (_, i) => 0.3 * Math.sin(2 * Math.PI * 220 * i / sampleRate))
    const points = analyzeReferencePitch({ id: 'clip', samples, sampleRate, start: 12.5 })
    expect(points).toHaveLength(20)
    expect(points[0].timeMs).toBe(12500)
    expect(points[10].timeMs).toBe(13000)
    expect(points[10].frequency).toBeCloseTo(220, 0)
  })

  it('erkennt Stille als Lücke und weist ungültige Audiodaten zurück', () => {
    const points = analyzeReferencePitch({ id: 'clip', samples: new Float32Array(8000), sampleRate: 8000, start: 0 })
    expect(points.every((point) => point.frequency === null)).toBe(true)
    expect(() => analyzeReferencePitch({ id: 'clip', samples: new Float32Array(1), sampleRate: 0, start: 0 })).toThrow()
  })
})
