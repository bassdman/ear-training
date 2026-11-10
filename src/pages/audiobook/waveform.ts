export type WaveformData = {
  duration: number
  peaks: Float32Array
  peaksPerSecond: number
}

const PEAKS_PER_SECOND = 100

export function extractWaveform(buffer: AudioBuffer): WaveformData {
  const count = Math.ceil(buffer.duration * PEAKS_PER_SECOND)
  const peaks = new Float32Array(count)
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel)
    for (let i = 0; i < samples.length; i++) {
      const bin = Math.min(count - 1, Math.floor(i * PEAKS_PER_SECOND / buffer.sampleRate))
      peaks[bin] = Math.max(peaks[bin], Math.abs(samples[i]))
    }
  }
  return { duration: buffer.duration, peaks, peaksPerSecond: PEAKS_PER_SECOND }
}

export async function decodeWaveform(blob: Blob): Promise<WaveformData> {
  const context = new AudioContext()
  try {
    const data = await blob.arrayBuffer()
    const buffer = await context.decodeAudioData(data)
    return extractWaveform(buffer)
  } finally {
    await context.close()
  }
}

export function getTickInterval(pixelsPerSecond: number): number {
  const target = 80 / pixelsPerSecond
  const magnitude = 10 ** Math.floor(Math.log10(target))
  const fraction = target / magnitude
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * magnitude
}

export function formatSeconds(seconds: number, interval: number): string {
  const decimals = Math.max(0, Math.min(6, -Math.floor(Math.log10(interval))))
  return `${seconds.toFixed(decimals)} s`
}
