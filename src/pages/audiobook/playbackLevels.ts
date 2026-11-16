import type { PlaybackDiagnostics } from './playbackDiagnostics'

type Meter = { node: AnalyserNode, samples: Float32Array<ArrayBuffer> }

export function startPlaybackLevels(
  context: AudioContext,
  gains: Map<string, GainNode>,
  diagnostics: PlaybackDiagnostics,
  mode: 'playback' | 'recording',
  position: () => number,
): () => void {
  const connections: { gain: GainNode, meter: AnalyserNode }[] = []
  const meters: { track: number, gain: GainNode, meter: Meter }[] = []
  let mix: Meter | undefined
  let timer: ReturnType<typeof setInterval> | undefined

  const cleanup = () => {
    if (timer !== undefined) clearInterval(timer)
    timer = undefined
    const reportDisconnectError = (cause: unknown) => {
      console.error('Audiopegelmessung konnte nicht getrennt werden:', cause)
      diagnostics.event('level-monitor-error', { mode, error: cause instanceof Error ? cause.name : 'unknown' })
    }
    for (const { gain, meter } of connections.splice(0)) {
      try {
        gain.disconnect(meter)
      } catch (cause) {
        reportDisconnectError(cause)
      }
    }
    const nodes = meters.splice(0).map(({ meter }) => meter.node)
    if (mix) nodes.push(mix.node)
    mix = undefined
    for (const node of nodes) {
      try { node.disconnect() } catch (cause) { reportDisconnectError(cause) }
    }
  }
  const createMeter = (): Meter => {
    const node = context.createAnalyser()
    node.fftSize = 2048
    return { node, samples: new Float32Array(node.fftSize) }
  }
  const readMeter = ({ node, samples }: Meter) => {
    node.getFloatTimeDomainData(samples)
    let peak = 0
    let squares = 0
    for (const sample of samples) {
      peak = Math.max(peak, Math.abs(sample))
      squares += sample * sample
    }
    return { peak: Math.round(peak * 10000) / 10000, rms: Math.round(Math.sqrt(squares / samples.length) * 10000) / 10000 }
  }
  try {
    mix = createMeter()
    for (const [id, gain] of gains) {
      const meter = createMeter()
      meters.push({ track: diagnostics.trackNumber(id), gain, meter })
      gain.connect(meter.node)
      connections.push({ gain, meter: meter.node })
      gain.connect(mix.node)
      connections.push({ gain, meter: mix.node })
    }
    diagnostics.event('level-monitor-start', {
      mode, tracks: meters.length, sampleRate: context.sampleRate, state: context.state,
      baseLatency: context.baseLatency ?? null, outputLatency: context.outputLatency ?? null,
    })
    timer = setInterval(() => {
      try {
        const time = position()
        for (const { track, gain, meter } of meters) {
          diagnostics.event('audio-level', { mode, track, position: time, gain: gain.gain.value, ...readMeter(meter) })
        }
        if (mix) diagnostics.event('audio-level', { mode, track: 0, position: time, gain: 1, ...readMeter(mix) })
      } catch (cause) {
        console.error('Audiopegel konnten nicht gemessen werden:', cause)
        diagnostics.event('level-monitor-error', { mode, error: cause instanceof Error ? cause.name : 'unknown' })
        cleanup()
      }
    }, 1000)
    return cleanup
  } catch (cause) {
    cleanup()
    console.error('Audiopegelmessung konnte nicht gestartet werden:', cause)
    diagnostics.event('level-monitor-error', { mode, error: cause instanceof Error ? cause.name : 'unknown' })
    return () => {}
  }
}
