import { describe, expect, it } from 'vitest'

import { centsFromTarget, describePitch, INITIAL_SING_STATE, stepSingState } from './singing'

const options = { holdMs: 2000, toleranceCents: 50 }
const a4 = 440
const midiA4 = 69

describe('centsFromTarget', () => {
  it('liefert 0 beim exakten Ton und 100 bei einem Halbton darüber', () => {
    expect(centsFromTarget(440, midiA4)).toBeCloseTo(0)
    expect(centsFromTarget(440 * 2 ** (1 / 12), midiA4)).toBeCloseTo(100)
  })
})

describe('describePitch', () => {
  it('liefert den nächsten Halbton und die Abweichung in Cent', () => {
    expect(describePitch(440)).toEqual({ midi: 69, cents: 0 })
    expect(describePitch(440 * 2 ** (30 / 1200))).toEqual({ midi: 69, cents: 30 })
    expect(describePitch(261.63).midi).toBe(60)
  })
})

describe('stepSingState', () => {
  it('zählt die Haltezeit nur im Toleranzbereich', () => {
    const first = stepSingState(INITIAL_SING_STATE, [midiA4], a4, 0, options)
    expect(first.done).toBe(false)
    const half = stepSingState(first.state, [midiA4], a4, 1000, options)
    expect(half.holdProgress).toBeCloseTo(0.5)
    const done = stepSingState(half.state, [midiA4], a4, 2000, options)
    expect(done.done).toBe(true)
  })

  it('setzt die Haltezeit zurück, wenn der Ton danebenliegt oder verstummt', () => {
    const start = stepSingState(INITIAL_SING_STATE, [midiA4], a4, 0, options)
    const off = stepSingState(start.state, [midiA4], 466.16, 1000, options)
    expect(off.state.inTuneSince).toBeNull()
    const again = stepSingState(off.state, [midiA4], a4, 1500, options)
    expect(stepSingState(again.state, [midiA4], a4, 3000, options).done).toBe(false)
    expect(stepSingState(again.state, [midiA4], a4, 3500, options).done).toBe(true)

    const silent = stepSingState(start.state, [midiA4], null, 1000, options)
    expect(silent.state.inTuneSince).toBeNull()
  })

  it('geht die Töne der Reihe nach durch', () => {
    const targets = [69, 71]
    const first = stepSingState(INITIAL_SING_STATE, targets, a4, 0, options)
    const advanced = stepSingState(first.state, targets, a4, 2000, options)
    expect(advanced.done).toBe(false)
    expect(advanced.state.index).toBe(1)

    const b4 = 440 * 2 ** (2 / 12)
    const second = stepSingState(advanced.state, targets, b4, 2100, options)
    expect(stepSingState(second.state, targets, b4, 4100, options).done).toBe(true)
  })

  it('verlangt bei gleichem Folgeton erst eine Pause', () => {
    const targets = [69, 69]
    const first = stepSingState(INITIAL_SING_STATE, targets, a4, 0, options)
    const advanced = stepSingState(first.state, targets, a4, 2000, options)
    expect(advanced.state.waitForRelease).toBe(true)

    const held = stepSingState(advanced.state, targets, a4, 2100, options)
    expect(held.state.inTuneSince).toBeNull()

    const released = stepSingState(held.state, targets, null, 2200, options)
    const restart = stepSingState(released.state, targets, a4, 2300, options)
    expect(stepSingState(restart.state, targets, a4, 4300, options).done).toBe(true)
  })
})
