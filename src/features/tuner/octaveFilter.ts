import { frequencyToMidi } from './pitch'
import { DEFAULT_TUNER_SETTINGS } from './settings'

const OCTAVE_SEMITONES = 12
const OCTAVE_TOLERANCE = 1

export function createOctaveFilter(skipFrames = DEFAULT_TUNER_SETTINGS.octaveSkipFrames) {
  let accepted: number | null = null
  let previousTime: number | null = null
  let candidate: number | null = null
  let count = 0

  const reset = () => {
    accepted = null
    previousTime = null
    candidate = null
    count = 0
  }

  const filter = (frequency: number | null, timeMs: number, maxGapMs: number): number | null => {
    if (frequency === null || !Number.isFinite(frequency) || frequency <= 0) {
      reset()
      return null
    }
    if (previousTime !== null && (timeMs < previousTime || timeMs - previousTime > maxGapMs)) reset()
    previousTime = timeMs
    const midi = frequencyToMidi(frequency)
    if (accepted !== null && Math.abs(Math.abs(midi - frequencyToMidi(accepted)) - OCTAVE_SEMITONES) <= OCTAVE_TOLERANCE) {
      if (candidate !== null && Math.abs(midi - frequencyToMidi(candidate)) <= OCTAVE_TOLERANCE) {
        count++
      } else {
        count = 1
      }
      candidate = frequency
      if (count <= skipFrames) return null
    }
    accepted = frequency
    candidate = null
    count = 0
    return frequency
  }

  return { filter, reset }
}
