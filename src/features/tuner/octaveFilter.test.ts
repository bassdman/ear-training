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

  it('filtert Sprünge ab zehn Halbtönen in beide Richtungen, kleinere nicht', () => {
    const { filter } = createOctaveFilter()
    const belowThreshold = 220 * 2 ** (9.99 / 12)
    expect(filter(220, 0, 250)).toBe(220)
    expect(filter(belowThreshold, 50, 250)).toBe(belowThreshold)
    resetTo220()
    expect(filter(220 * 2 ** (10 / 12), 50, 250)).toBeNull()
    resetTo220()
    expect(filter(220 / 2 ** (10 / 12), 50, 250)).toBeNull()
    resetTo220()
    expect(filter(220 * 3, 50, 250)).toBeNull()

    function resetTo220() {
      filter(null, 0, 250)
      filter(220, 0, 250)
    }
  })

  it('filtert die auffälligen Messungen aus dem Debug-Trace, ohne den Folgeton zu unterdrücken', () => {
    const { filter } = createOctaveFilter(1)
    const values = [195.3611266671163, 194.97808270411747, 87.49882687312811, 182.6273299404534,
      181.06772749419497, 167.05633427275484, 196.82843525927052, 446.4459060989098, 222.66966367604047]
    expect(values.map((value, i) => filter(value, i * 50, 250)))
      .toEqual([values[0], values[1], null, values[3], values[4], values[5], values[6], null, values[8]])
  })

  it('respektiert die Frameanzahl bei dem großen Sprung um 29,63 Sekunden', () => {
    const values = [99.46041984736527, 97.01664462509457, 299.23639723371633, 301.9727225809246]
    const single = createOctaveFilter(1)
    const two = createOctaveFilter(2)
    expect(values.map((value, i) => single.filter(value, i * 50, 250)))
      .toEqual([values[0], values[1], null, values[3]])
    expect(values.map((value, i) => two.filter(value, i * 50, 250)))
      .toEqual([values[0], values[1], null, null])
    expect(two.filter(300, 200, 250)).toBe(300)
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
