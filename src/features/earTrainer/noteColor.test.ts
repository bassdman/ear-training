import { describe, expect, it } from 'vitest'

import { getToneColor } from './noteColor'

describe('getToneColor', () => {
  it('verteilt die Hue-Werte gleichmäßig über 12 Töne', () => {
    expect(getToneColor('C', 1).hue).toBeCloseTo(0)
    expect(getToneColor('Cis', 1).hue).toBeCloseTo(30)
    expect(getToneColor('D', 1).hue).toBeCloseTo(60)
    expect(getToneColor('H', 1).hue).toBeCloseTo(330)
  })

  it('startet bei C2 mit Lightness 14 und steigt je Halbton um 0.5', () => {
    expect(getToneColor('C', 0.25).lightness).toBeCloseTo(14)
    expect(getToneColor('Cis', 0.25).lightness).toBeCloseTo(14.5)
    expect(getToneColor('D', 0.25).lightness).toBeCloseTo(15)
  })

  it('erhöht Lightness bei gleicher Tonklasse pro Oktave um 6', () => {
    const c3 = getToneColor('C', 0.5).lightness
    const c4 = getToneColor('C', 1).lightness
    const c5 = getToneColor('C', 2).lightness

    expect(c4 - c3).toBeCloseTo(6)
    expect(c5 - c4).toBeCloseTo(6)
  })
})
