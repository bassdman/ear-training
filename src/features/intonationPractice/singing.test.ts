import { describe, expect, it } from 'vitest'

import {
  centsFromTarget,
  describePitch,
  INITIAL_SING_STATE,
  stableFrequency,
  stepSingState,
  type SingState,
  type SingStep,
} from './singing'

const options = { holdMs: 2000, toleranceCents: 50, graceMs: 1000, releaseMs: 200 }
const a4 = 440
const b4 = 440 * 2 ** (2 / 12)
const midiA4 = 69

// Spielt Messungen im 100-ms-Takt ab; null = Aussetzer
function run(targets: number[], frames: (number | null)[], from?: SingStep, startAt = 0) {
  let result: SingStep = from ?? { state: INITIAL_SING_STATE, holdProgress: 0, done: false }
  frames.forEach((frequency, index) => {
    result = stepSingState(result.state, targets, frequency, startAt + index * 100, options)
  })
  return result
}

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
  it('zählt die Haltezeit nur, solange der Ton getroffen wird', () => {
    const half = run([midiA4], Array(11).fill(a4))
    expect(half.holdProgress).toBeCloseTo(0.5)
    expect(half.done).toBe(false)
    expect(run([midiA4], Array(21).fill(a4)).done).toBe(true)
  })

  it('pausiert bei kurzen Aussetzern, statt zurückzusetzen', () => {
    // 1 s Ton, 0,5 s Aussetzer, danach reicht 1 s Ton für die restliche Zeit
    const first = run([midiA4], Array(11).fill(a4))
    const gap = run([midiA4], Array(5).fill(null), first, 1100)
    expect(gap.holdProgress).toBeCloseTo(0.5)
    const resumed = run([midiA4], Array(11).fill(a4), gap, 1600)
    expect(resumed.done).toBe(true)
  })

  it('pausiert auch bei einer einzelnen falschen Messung', () => {
    const first = run([midiA4], Array(11).fill(a4))
    const glitch = run([midiA4], [466.16], first, 1100)
    expect(glitch.holdProgress).toBeCloseTo(0.5)
    expect(run([midiA4], Array(11).fill(a4), glitch, 1200).done).toBe(true)
  })

  it('beginnt nach langem Aussetzen von vorn', () => {
    const first = run([midiA4], Array(11).fill(a4))
    const longGap = run([midiA4], Array(15).fill(null), first, 1100)
    expect(longGap.holdProgress).toBe(0)
    expect(run([midiA4], Array(11).fill(a4), longGap, 2600).done).toBe(false)
  })

  it('geht die Töne der Reihe nach durch', () => {
    const targets = [69, 71]
    const first = run(targets, Array(22).fill(a4))
    expect(first.done).toBe(false)
    expect(first.state.index).toBe(1)
    expect(run(targets, Array(22).fill(b4), first, 2200).done).toBe(true)
  })

  it('verlangt bei gleichem Folgeton erst eine Pause', () => {
    const targets = [69, 69]
    const first = run(targets, Array(22).fill(a4))
    expect(first.state.waitForRelease).toBe(true)

    const held = run(targets, Array(30).fill(a4), first, 2200)
    expect(held.done).toBe(false)
    expect(held.holdProgress).toBe(0)

    const released = run(targets, [null, null, null], held, 5200)
    expect(released.state.waitForRelease).toBe(false)
    expect(run(targets, Array(21).fill(a4), released, 5500).done).toBe(true)
  })

  it('begrenzt große Lücken zwischen zwei Messungen', () => {
    const state: SingState = { ...INITIAL_SING_STATE, lastTime: 0 }
    const step = stepSingState(state, [midiA4], a4, 60_000, options)
    expect(step.state.heldMs).toBe(100)
  })
})

describe('stableFrequency', () => {
  const stable = { minSamples: 3, maxDeviationCents: 50, minShare: 0.6 }

  it('verlangt mindestens minSamples Messungen', () => {
    expect(stableFrequency([440, 441], stable)).toBeNull()
  })

  it('ignoriert einzelne Ausreißer', () => {
    const result = stableFrequency([440, 441, 880, 439], stable)
    expect(result).toBeGreaterThanOrEqual(439)
    expect(result).toBeLessThanOrEqual(441)
  })

  it('liefert null bei uneinheitlichen Messungen', () => {
    expect(stableFrequency([220, 440, 880], stable)).toBeNull()
  })
})
