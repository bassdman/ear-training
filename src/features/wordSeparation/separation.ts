export type Segment = { start: number, end: number }

export const WINDOW_SECONDS = 0.01
export const MIN_PAUSE_SECONDS = 0.12
export const EDGE_SECONDS = 0.02
export const SILENCE_RMS = 0.01

export async function findSoundSegments(buffer: AudioBuffer, sourceStart: number, duration: number, signal?: AbortSignal): Promise<Segment[]> {
  if (!Number.isFinite(sourceStart) || sourceStart < 0 || !Number.isFinite(duration) || duration <= 0
    || sourceStart + duration > buffer.duration + 1 / buffer.sampleRate) {
    throw new Error('Ungültiger Audiobereich')
  }
  const rate = buffer.sampleRate
  const first = Math.round(sourceStart * rate)
  const last = Math.min(buffer.length, Math.round((sourceStart + duration) * rate))
  const windowSize = Math.max(1, Math.round(WINDOW_SECONDS * rate))
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i))
  if (!channels.length || last <= first) throw new Error('Ungültige Audiodaten')
  const pauses: Segment[] = []
  let quietStart: number | null = null
  let count = 0
  const recordPause = (end: number) => {
    if (quietStart !== null && (end - quietStart) / rate + 1e-9 >= MIN_PAUSE_SECONDS) {
      pauses.push({ start: (quietStart - first) / rate, end: (end - first) / rate })
    }
    quietStart = null
  }
  for (let position = first; position < last; position += windowSize) {
    if (signal?.aborted) throw new DOMException('Analyse abgebrochen', 'AbortError')
    const end = Math.min(last, position + windowSize)
    let loudestRms = 0
    for (const samples of channels) {
      let sum = 0
      for (let i = position; i < end; i++) sum += samples[i] * samples[i]
      loudestRms = Math.max(loudestRms, Math.sqrt(sum / (end - position)))
    }
    if (loudestRms < SILENCE_RMS) quietStart ??= position
    else recordPause(position)
    if (++count % 500 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
  recordPause(last)
  const length = (last - first) / rate
  if (pauses.length === 1 && pauses[0].start === 0 && pauses[0].end === length) return []
  const result: Segment[] = []
  let start = 0
  for (const pause of pauses) {
    const left = pause.start === 0 ? 0 : Math.min(length, pause.start + EDGE_SECONDS)
    const right = pause.end === length ? length : Math.max(left, pause.end - EDGE_SECONDS)
    if (left > start) result.push({ start, end: left })
    start = right
  }
  if (start < length) result.push({ start, end: length })
  return result
}
