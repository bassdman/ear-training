import { FFmpeg } from '@ffmpeg/ffmpeg'
import { loadFFmpegCore } from '../../ffmpegCore'
import { getTrackClips, getTrackMix, readTracks } from './audioStorage'

const SAMPLE_RATE = 44100

function encodeWav(buffer: AudioBuffer): Uint8Array<ArrayBuffer> {
  const channels = buffer.numberOfChannels
  const bytes = new Uint8Array(44 + buffer.length * channels * 2)
  const view = new DataView(bytes.buffer)
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i))
  }
  text(0, 'RIFF')
  view.setUint32(4, bytes.length - 8, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, buffer.sampleRate, true)
  view.setUint32(28, buffer.sampleRate * channels * 2, true)
  view.setUint16(32, channels * 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, bytes.length - 44, true)
  const samples = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel))
  let offset = 44
  for (let frame = 0; frame < buffer.length; frame++) {
    for (const channel of samples) {
      const sample = Math.max(-1, Math.min(1, channel[frame]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }
  return bytes
}

export async function exportProjectMp3(projectId: string): Promise<Blob> {
  const tracks = await readTracks(projectId)
  const clips = tracks.flatMap((track) => getTrackClips(track).map((clip) => ({ clip, mix: getTrackMix(track) })))
  if (!clips.length) throw new Error('Das Projekt enthält keine Audioblöcke.')
  const decoder = new AudioContext()
  let decoded: { clip: typeof clips[number]['clip'], mix: typeof clips[number]['mix'], buffer: AudioBuffer, duration: number }[]
  try {
    decoded = await Promise.all(clips.map(async ({ clip, mix }) => {
      const buffer = await decoder.decodeAudioData(await clip.audio.arrayBuffer())
      const sourceStart = clip.sourceStart ?? 0
      const duration = Math.min(clip.duration ?? buffer.duration - sourceStart, buffer.duration - sourceStart)
      if (!Number.isFinite(duration) || duration <= 0) throw new Error(`Ungültiger Audiobereich: ${clip.name}`)
      return { clip, mix, buffer, duration }
    }))
  } finally {
    await decoder.close()
  }
  const duration = Math.max(...decoded.map(({ clip, duration: length }) => clip.start + length))
  const renderer = new OfflineAudioContext(2, Math.ceil(duration * SAMPLE_RATE), SAMPLE_RATE)
  for (const { clip, mix, buffer, duration: length } of decoded) {
    const source = renderer.createBufferSource()
    const gain = renderer.createGain()
    source.buffer = buffer
    gain.gain.value = mix.muted ? 0 : mix.volume
    source.connect(gain)
    gain.connect(renderer.destination)
    source.start(clip.start, clip.sourceStart ?? 0, length)
  }
  const wav = encodeWav(await renderer.startRendering())
  const ffmpeg = new FFmpeg()
  try {
    await loadFFmpegCore(ffmpeg)
    await ffmpeg.writeFile('song.wav', wav)
    const exitCode = await ffmpeg.exec(['-i', 'song.wav', '-codec:a', 'libmp3lame', '-b:a', '192k', 'song.mp3'])
    if (exitCode !== 0) throw new Error('MP3-Kodierung fehlgeschlagen.')
    const result = await ffmpeg.readFile('song.mp3')
    if (typeof result === 'string' || result.length === 0) throw new Error('MP3-Datei ist leer oder ungültig.')
    return new Blob([new Uint8Array(result)], { type: 'audio/mpeg' })
  } finally {
    ffmpeg.terminate()
  }
}
