import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as audioStorage from './audioStorage'
import { exportProjectMp3 } from './projectMp3'

const mocks = vi.hoisted(() => ({
  load: vi.fn().mockResolvedValue(true),
  writeFile: vi.fn(),
  exec: vi.fn(),
  readFile: vi.fn(),
  terminate: vi.fn(),
}))
vi.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: class {
    load = mocks.load
    writeFile = mocks.writeFile
    exec = mocks.exec
    readFile = mocks.readFile
    terminate = mocks.terminate
  },
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('MP3-Export', () => {
  it('mischt Schnitte, Quellpositionen, Lautstärke und stumme Spuren und kodiert MP3', async () => {
    vi.stubGlobal('Blob', NodeBlob)
    const starts: number[][] = []
    const gains: number[] = []
    const buffer = { duration: 10 }
    const samples = new Float32Array(2)
    vi.stubGlobal('AudioContext', class {
      decodeAudioData = vi.fn().mockResolvedValue(buffer)
      close = vi.fn().mockResolvedValue(undefined)
    })
    vi.stubGlobal('OfflineAudioContext', class {
      destination = {}
      constructor(_channels: number, length: number, _rate: number) {
        expect(length).toBe(12 * 44100)
      }
      createBufferSource() {
        return { buffer: null, connect: vi.fn(), start: (...args: number[]) => starts.push(args) }
      }
      createGain() {
        const gain = { value: 0 }
        gains.push(0)
        const index = gains.length - 1
        Object.defineProperty(gain, 'value', { set: (value: number) => { gains[index] = value } })
        return { gain, connect: vi.fn() }
      }
      startRendering() {
        return Promise.resolve({ numberOfChannels: 2, length: 2, sampleRate: 44100, getChannelData: () => samples })
      }
    })
    vi.spyOn(audioStorage, 'readTracks').mockResolvedValue([
      { id: 'a', projectId: 'p', name: '', createdAt: 1, volume: 0.4, clips: [{ id: 'c', name: 'c', audio: new Blob(['a']), start: 5, sourceStart: 2, duration: 3 }] },
      { id: 'b', projectId: 'p', name: '', createdAt: 2, muted: true, clips: [{ id: 'd', name: 'd', audio: new Blob(['b']), start: 2 }] },
    ])
    mocks.exec.mockResolvedValue(0)
    mocks.readFile.mockResolvedValue(new Uint8Array([0xff, 0xfb, 1]))
    const result = await exportProjectMp3('p')
    expect(starts).toEqual([[5, 2, 3], [2, 0, 10]])
    expect(gains).toEqual([0.4, 0])
    const config = mocks.load.mock.calls[0][0]
    expect(new URL(config.coreURL).origin).toBe(window.location.origin)
    expect(new URL(config.wasmURL).origin).toBe(window.location.origin)
    expect(config.coreURL).toMatch(/ffmpeg-core.*\.js/)
    expect(config.wasmURL).toMatch(/ffmpeg-core.*\.wasm/)
    expect(mocks.exec).toHaveBeenCalledWith(['-i', 'song.wav', '-codec:a', 'libmp3lame', '-b:a', '192k', 'song.mp3'])
    expect(result.type).toBe('audio/mpeg')
    expect([...new Uint8Array(await result.arrayBuffer())]).toEqual([0xff, 0xfb, 1])
    expect(mocks.terminate).toHaveBeenCalled()
  })

  it('meldet ein leeres Projekt', async () => {
    vi.spyOn(audioStorage, 'readTracks').mockResolvedValue([])
    await expect(exportProjectMp3('empty')).rejects.toThrow('keine Audioblöcke')
  })
})
