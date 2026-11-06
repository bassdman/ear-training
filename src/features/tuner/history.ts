import { MAX_SAMPLE_GAP_MS, WINDOW_MS } from './config'
import { frequencyToMidi, type PitchPoint } from './pitch'

export function appendPoint(points: readonly PitchPoint[], point: PitchPoint): PitchPoint[] {
  const previous = points.at(-1)
  const updated = [...points]
  if (previous && point.timeMs - previous.timeMs > MAX_SAMPLE_GAP_MS && previous.frequency !== null) {
    updated.push({ timeMs: previous.timeMs + 1, frequency: null })
  }
  updated.push(point)
  const start = point.timeMs - WINDOW_MS
  const firstInWindow = updated.findIndex((entry) => entry.timeMs >= start)
  return updated.slice(Math.max(0, firstInWindow - 1))
}

export function nextPitchCenter(center: number | null, frequency: number, span: number): number {
  const midi = frequencyToMidi(frequency)
  if (center === null) return midi
  const innerRadius = span * 0.35
  if (midi > center + innerRadius) return midi - innerRadius
  if (midi < center - innerRadius) return midi + innerRadius
  return center
}

export function buildPitchPath(
  points: readonly PitchPoint[],
  startMs: number,
  endMs: number,
  center: number,
  span: number,
): string {
  const left = 46
  const width = 344
  const top = 12
  const height = 540
  let drawing = false
  let path = ''
  for (const point of points) {
    if (point.frequency === null) {
      drawing = false
      continue
    }
    const x = left + ((point.timeMs - startMs) / (endMs - startMs)) * width
    const y = top + ((center + span / 2 - frequencyToMidi(point.frequency)) / span) * height
    path += `${drawing ? ' L' : ' M'}${x.toFixed(2)} ${y.toFixed(2)}`
    drawing = true
  }
  return path.trim()
}
