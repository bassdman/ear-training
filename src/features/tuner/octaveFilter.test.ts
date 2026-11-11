import { describe, expect, it } from 'vitest'

import { createOctaveFilter } from './octaveFilter'

describe('Oktavfilter', () => {
  it('überspringt einzelne Sprünge nach oben und unten als Lücken', () => {
    const { filter } = createOctaveFilter()
    expect([220, 440, 220, 110, 220].map((value, i) => filter(value, i * 50, 250)))
      .toEqual([220, null, 220, null, 220])
  })

  it('übernimmt einen stabilen Oktavwechsel nach drei aufeinanderfolgenden Messungen', () => {
    const { filter } = createOctaveFilter()
    expect([220, 443, 440, 438, 440, 220, 221, 220].map((value, i) => filter(value, i * 50, 250)))
      .toEqual([220, null, null, 438, 440, null, null, 220])
  })

  it.each([
    [0, [220, 440, 440, 440, 440]],
    [1, [220, null, 440, 440, 440]],
    [3, [220, null, null, null, 440]],
  ])('überspringt genau %i Frames', (skipFrames, expected) => {
    const { filter } = createOctaveFilter(skipFrames)
    expect([220, 440, 440, 440, 440].map((value, i) => filter(value, i * 50, 250))).toEqual(expected)
  })

  it('lässt andere Intervalle zu und bestätigt wechselnde Kandidaten nicht', () => {
    const { filter } = createOctaveFilter()
    expect(filter(220, 0, 250)).toBe(220)
    expect(filter(330, 50, 250)).toBe(330)
    expect(filter(660, 100, 250)).toBeNull()
    expect(filter(330, 150, 250)).toBe(330)
    expect(filter(660, 200, 250)).toBeNull()
    expect(filter(330, 250, 250)).toBe(330)
  })

  it('akzeptiert einen Sprung außerhalb der Oktavtoleranz sofort', () => {
    const { filter } = createOctaveFilter()
    const belowOctaveTolerance = 220 * 2 ** (10.9 / 12)
    expect(filter(220, 0, 250)).toBe(220)
    expect(filter(belowOctaveTolerance, 50, 250)).toBe(belowOctaveTolerance)
  })

  it('setzt bei Stille, langen Lücken, Rückwärtszeit und explizitem Reset zurück', () => {
    const { filter, reset } = createOctaveFilter()
    expect(filter(220, 0, 250)).toBe(220)
    expect(filter(440, 50, 250)).toBeNull()
    expect(filter(null, 100, 250)).toBeNull()
    expect(filter(440, 150, 250)).toBe(440)
    expect(filter(220, 500, 250)).toBe(220)
    expect(filter(440, 400, 250)).toBe(440)
    reset()
    expect(filter(220, 450, 250)).toBe(220)
  })
})
