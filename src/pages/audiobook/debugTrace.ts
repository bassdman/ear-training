import { describePitch } from '../../features/tuner/pitch'
import { DEFAULT_TUNER_SETTINGS } from '../../features/tuner/settings'
import type { AudioTrack } from './audioStorage'
import type { ReferencePitchPoint } from './referencePitch'

export type TracePoint = ReferencePitchPoint & {
  clipId: string
  kind: 'sample' | 'clip-end'
}

export function createVocalDebugTrace(track: AudioTrack, trackNumber: number, octaveSkipFrames: number, points: TracePoint[]) {
  const { minVolumeRms, minPitchClarity, minFrequencyHz, maxFrequencyHz, analysisFftSize, analysisIntervalMs, maxSampleGapMs } = DEFAULT_TUNER_SETTINGS
  return {
    format: 'ear-training-vocal-debug-trace',
    version: 1,
    exportedAt: new Date().toISOString(),
    projectId: track.projectId,
    track: { id: track.id, name: track.name, number: trackNumber },
    analysis: {
      minVolumeRms, minPitchClarity, minFrequencyHz, maxFrequencyHz, analysisFftSize, analysisIntervalMs, maxSampleGapMs,
      octaveSkipFrames,
      timeUnit: 'seconds from song start',
      description: 'frequencyHz is displayed after octave filtering; rawFrequencyHz is before filtering. null means no pitch. clip-end marks a display gap.',
    },
    points: points.map((point) => ({
      timeSeconds: point.timeMs / 1000,
      clipId: point.clipId,
      kind: point.kind,
      frequencyHz: point.frequency,
      note: point.frequency === null ? null : describePitch(point.frequency).note,
      rawFrequencyHz: point.rawFrequency,
      rawNote: point.rawFrequency === null ? null : describePitch(point.rawFrequency).note,
    })),
  }
}

export function downloadVocalDebugTrace(trace: ReturnType<typeof createVocalDebugTrace>) {
  const blob = new Blob([JSON.stringify(trace, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  try {
    link.href = url
    link.download = 'vocal-debug-trace.json'
    link.hidden = true
    document.body.append(link)
    link.click()
  } finally {
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
