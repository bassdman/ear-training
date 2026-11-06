import { describe, expect, it } from 'vitest'

import { appendPoint, buildPitchPath, nextPitchCenter } from './history'
import type { PitchPoint } from './pitch'

describe('Verlauf', () => {
  it('begrenzt das Fenster und behält höchstens einen Punkt vor dem Rand', () => {
    const points: PitchPoint[] = [
      { timeMs: 0, frequency: 440 },
      { timeMs: 1000, frequency: null },
      { timeMs: 5000, frequency: 440 },
    ]
    expect(appendPoint(points, { timeMs: 6500, frequency: 440 })).toEqual([
      { timeMs: 1000, frequency: null },
      { timeMs: 5000, frequency: 440 },
      { timeMs: 5001, frequency: null },
      { timeMs: 6500, frequency: 440 },
    ])
  })

  it('zeichnet Lücken und unterbrochene Analyse nicht als Verbindung', () => {
    let points: PitchPoint[] = []
    for (const point of [
      { timeMs: 0, frequency: 440 },
      { timeMs: 50, frequency: 440 },
      { timeMs: 100, frequency: null },
      { timeMs: 150, frequency: 440 },
      { timeMs: 500, frequency: 440 },
    ]) points = appendPoint(points, point)
    const path = buildPitchPath(points, 0, 5000, 69, 18)
    expect(path.match(/M/g)).toHaveLength(3)
    expect(path.match(/L/g)).toHaveLength(1)
  })

  it('führt bei den äußeren 15 Prozent des Tonbereichs nach', () => {
    expect(nextPitchCenter(null, 440, 18)).toBe(69)
    expect(nextPitchCenter(69, 440 * 2 ** (6 / 12), 18)).toBe(69)
    expect(nextPitchCenter(69, 440 * 2 ** (8 / 12), 18)).toBeCloseTo(70.7)
    expect(nextPitchCenter(69, 440 * 2 ** (-8 / 12), 18)).toBeCloseTo(67.3)
  })
})
