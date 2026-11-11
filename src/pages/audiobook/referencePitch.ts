import { createPitchAnalyzer, type PitchPoint } from '../../features/tuner/pitch'
import { DEFAULT_TUNER_SETTINGS } from '../../features/tuner/settings'

export type ReferencePitchJob = {
  id: string
  samples: Float32Array
  sampleRate: number
  start: number
}

export function analyzeReferencePitch({ samples, sampleRate, start }: ReferencePitchJob): PitchPoint[] {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0 || !Number.isFinite(start) || start < 0) throw new Error('Ungültige Audiodaten für die Tonhöhenanalyse')
  const { analysisFftSize, analysisIntervalMs } = DEFAULT_TUNER_SETTINGS
  const analyze = createPitchAnalyzer(analysisFftSize, DEFAULT_TUNER_SETTINGS)
  const window = new Float32Array(analysisFftSize)
  const count = Math.ceil(samples.length / sampleRate * 1000 / analysisIntervalMs)
  const points: PitchPoint[] = []
  for (let i = 0; i < count; i++) {
    const center = Math.round(i * analysisIntervalMs * sampleRate / 1000)
    const first = center - Math.floor(analysisFftSize / 2)
    window.fill(0)
    const from = Math.max(0, first)
    const to = Math.min(samples.length, first + analysisFftSize)
    if (to > from) window.set(samples.subarray(from, to), from - first)
    points.push({ timeMs: start * 1000 + i * analysisIntervalMs, frequency: analyze(window, sampleRate) })
  }
  return points
}
