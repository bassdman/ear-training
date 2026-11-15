import { FFmpeg } from '@ffmpeg/ffmpeg'
import { loadFFmpegCore } from '../../ffmpegCore'

async function decodeDuration(blob: Blob): Promise<number> {
  const context = new AudioContext()
  try {
    const duration = (await context.decodeAudioData(await blob.arrayBuffer())).duration
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('Die Aufnahme hat keine gültige Dauer.')
    return duration
  } finally {
    await context.close()
  }
}

export async function prepareRecording(blob: Blob): Promise<{ audio: Blob, duration: number }> {
  try {
    return { audio: blob, duration: await decodeDuration(blob) }
  } catch (cause) {
    console.warn('Aufnahme wird für die Wiedergabe in WAV umgewandelt:', cause)
  }

  const ffmpeg = new FFmpeg()
  try {
    await loadFFmpegCore(ffmpeg)
    await ffmpeg.writeFile('recording', new Uint8Array(await blob.arrayBuffer()))
    const result = await ffmpeg.exec(['-i', 'recording', '-c:a', 'pcm_s16le', 'recording.wav'])
    if (result !== 0) throw new Error('Die Aufnahme konnte nicht in WAV umgewandelt werden.')
    const data = await ffmpeg.readFile('recording.wav')
    if (typeof data === 'string' || data.length === 0) throw new Error('Die umgewandelte Aufnahme ist leer.')
    const audio = new Blob([new Uint8Array(data)], { type: 'audio/wav' })
    return { audio, duration: await decodeDuration(audio) }
  } finally {
    ffmpeg.terminate()
  }
}
