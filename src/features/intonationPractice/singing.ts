export type SingState = {
  index: number
  inTuneSince: number | null
  // Gleiches Ziel wie zuvor: erst nach einer Pause oder Abweichung zählt der nächste Ton
  waitForRelease: boolean
}

export const INITIAL_SING_STATE: SingState = { index: 0, inTuneSince: null, waitForRelease: false }

export type SingStep = { state: SingState; holdProgress: number; done: boolean }

export function centsFromTarget(frequency: number, targetMidi: number): number {
  return 1200 * Math.log2(frequency / (440 * 2 ** ((targetMidi - 69) / 12)))
}

export type PitchReading = { midi: number; cents: number }

// Nächster Halbton zur Frequenz samt Abweichung in Cent.
export function describePitch(frequency: number): PitchReading {
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440))
  return { midi, cents: Math.round(centsFromTarget(frequency, midi)) }
}

// frequency null = nichts gesungen; sonst die stabilisierte Frequenz.
export function stepSingState(
  state: SingState,
  targets: readonly number[],
  frequency: number | null,
  now: number,
  options: { holdMs: number; toleranceCents: number },
): SingStep {
  if (frequency === null) {
    return { state: { ...state, inTuneSince: null, waitForRelease: false }, holdProgress: 0, done: false }
  }

  const target = targets[state.index]
  const inTune = Math.abs(centsFromTarget(frequency, target)) <= options.toleranceCents
  if (!inTune) {
    return { state: { ...state, inTuneSince: null, waitForRelease: false }, holdProgress: 0, done: false }
  }
  if (state.waitForRelease) return { state, holdProgress: 0, done: false }

  const since = state.inTuneSince ?? now
  const elapsed = now - since
  if (elapsed < options.holdMs) {
    return { state: { ...state, inTuneSince: since }, holdProgress: elapsed / options.holdMs, done: false }
  }

  const next = state.index + 1
  if (next >= targets.length) return { state: { ...state, inTuneSince: since }, holdProgress: 1, done: true }
  return {
    state: { index: next, inTuneSince: null, waitForRelease: targets[next] === target },
    holdProgress: 0,
    done: false,
  }
}
