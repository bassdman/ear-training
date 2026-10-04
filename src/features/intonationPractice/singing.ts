export type SingState = {
  index: number
  // Summe der Zeit, in der der Ton getroffen wurde; Aussetzer pausieren sie nur
  heldMs: number
  // Zeit am Stück ohne passenden Ton
  lostMs: number
  lastTime: number | null
  // Gleiches Ziel wie zuvor: erst nach einer Pause zählt der nächste Ton
  waitForRelease: boolean
}

export const INITIAL_SING_STATE: SingState = {
  index: 0,
  heldMs: 0,
  lostMs: 0,
  lastTime: null,
  waitForRelease: false,
}

export type SingStep = { state: SingState; holdProgress: number; done: boolean }

export type SingOptions = {
  // So lange muss der Ton insgesamt getroffen werden
  holdMs: number
  toleranceCents: number
  // Erst nach so langem Aussetzen am Stück beginnt die Haltezeit von vorn
  graceMs: number
  // So lange muss pausiert werden, bevor derselbe Ton ein zweites Mal zählt
  releaseMs: number
}

// Begrenzt Lücken zwischen zwei Messungen (z. B. Tab im Hintergrund)
const MAX_FRAME_MS = 100

export function centsFromTarget(frequency: number, targetMidi: number): number {
  return 1200 * Math.log2(frequency / (440 * 2 ** ((targetMidi - 69) / 12)))
}

export type PitchReading = { midi: number; cents: number }

// Nächster Halbton zur Frequenz samt Abweichung in Cent.
export function describePitch(frequency: number): PitchReading {
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440))
  return { midi, cents: Math.round(centsFromTarget(frequency, midi)) }
}

// frequency null = kein verlässlicher Ton in diesem Moment.
export function stepSingState(
  state: SingState,
  targets: readonly number[],
  frequency: number | null,
  now: number,
  options: SingOptions,
): SingStep {
  const elapsed = state.lastTime === null ? 0 : Math.min(now - state.lastTime, MAX_FRAME_MS)
  const target = targets[state.index]
  const inTune = frequency !== null && Math.abs(centsFromTarget(frequency, target)) <= options.toleranceCents

  if (!inTune) {
    const lostMs = state.lostMs + elapsed
    const next: SingState = {
      ...state,
      lastTime: now,
      lostMs,
      heldMs: lostMs > options.graceMs ? 0 : state.heldMs,
      waitForRelease: lostMs >= options.releaseMs ? false : state.waitForRelease,
    }
    return { state: next, holdProgress: Math.min(1, next.heldMs / options.holdMs), done: false }
  }

  if (state.waitForRelease) {
    return { state: { ...state, lastTime: now, lostMs: 0 }, holdProgress: 0, done: false }
  }

  const heldMs = state.heldMs + elapsed
  if (heldMs < options.holdMs) {
    return {
      state: { ...state, lastTime: now, lostMs: 0, heldMs },
      holdProgress: heldMs / options.holdMs,
      done: false,
    }
  }

  const nextIndex = state.index + 1
  if (nextIndex >= targets.length) {
    return { state: { ...state, lastTime: now, lostMs: 0, heldMs }, holdProgress: 1, done: true }
  }
  return {
    state: {
      index: nextIndex,
      heldMs: 0,
      lostMs: 0,
      lastTime: now,
      waitForRelease: targets[nextIndex] === target,
    },
    holdProgress: 0,
    done: false,
  }
}

// Robuster Mittelwert der letzten Messungen; null, wenn zu wenige oder zu uneinheitliche.
export function stableFrequency(
  frequencies: readonly number[],
  options: { minSamples: number; maxDeviationCents: number; minShare: number },
): number | null {
  if (frequencies.length < options.minSamples) return null
  const sorted = [...frequencies].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const close = frequencies.filter(
    (frequency) => Math.abs(1200 * Math.log2(frequency / median)) <= options.maxDeviationCents,
  )
  return close.length / frequencies.length >= options.minShare ? median : null
}
