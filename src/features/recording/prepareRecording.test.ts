import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, expect, it, vi } from 'vitest'

import { prepareRecording } from './prepareRecording'

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  writeFile: vi.fn(),
  exec: vi.fn(),
  readFile: vi.fn(),
  terminate: vi.fn(),
}))
vi.mock('../../ffmpegCore', () => ({ loadFFmpegCore: mocks.load }))
vi.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: class {
    writeFile = mocks.writeFile
    exec = mocks.exec
    readFile = mocks.readFile
    terminate = mocks.terminate
  },
}))

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('wandelt ein nicht direkt dekodierbares Aufnahmeformat lokal in WAV um', async () => {
  vi.stubGlobal('Blob', NodeBlob)
  const decode = vi.fn().mockRejectedValueOnce(new Error('Format')).mockResolvedValueOnce({ duration: 2 })
  const close = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('AudioContext', class { decodeAudioData = decode; close = close })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  mocks.exec.mockResolvedValue(0)
  mocks.readFile.mockResolvedValue(new Uint8Array([1, 2, 3]))

  const result = await prepareRecording(new Blob(['webm'], { type: 'audio/webm' }))
  expect(result.audio.type).toBe('audio/wav')
  expect(result.duration).toBe(2)
  expect(mocks.exec).toHaveBeenCalledWith(['-i', 'recording', '-c:a', 'pcm_s16le', 'recording.wav'])
  expect(mocks.terminate).toHaveBeenCalledOnce()
  expect(close).toHaveBeenCalledTimes(2)
})

it('meldet einen Konvertierungsfehler und beendet FFmpeg', async () => {
  vi.stubGlobal('Blob', NodeBlob)
  vi.stubGlobal('AudioContext', class {
    decodeAudioData = vi.fn().mockRejectedValue(new Error('Format'))
    close = vi.fn().mockResolvedValue(undefined)
  })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  mocks.exec.mockResolvedValue(1)
  await expect(prepareRecording(new Blob(['webm']))).rejects.toThrow('umgewandelt')
  expect(mocks.terminate).toHaveBeenCalledOnce()
})
