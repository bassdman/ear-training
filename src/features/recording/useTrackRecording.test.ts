import { Blob as NodeBlob } from 'node:buffer'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import type { AudioTrack } from '../../pages/audiobook/audioStorage'
import { useTrackRecording } from './useTrackRecording'
import { PlaybackDiagnostics } from '../../pages/audiobook/playbackDiagnostics'

afterEach(() => {
  Reflect.deleteProperty(navigator, 'mediaDevices')
  Reflect.deleteProperty(navigator, 'audioSession')
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('nimmt in die ausgewählte Spur auf und spielt nur die anderen Spuren ab', async () => {
  const sourceStart = vi.fn()
  const microphoneStop = vi.fn()
  const save = vi.fn().mockResolvedValue(undefined)
  const session = { type: 'auto' }
  Object.defineProperty(navigator, 'audioSession', { configurable: true, value: session })
  const gains: { value: number }[] = []
  const analyser = vi.fn(() => ({ fftSize: 2048, getFloatTimeDomainData: vi.fn((data: Float32Array) => data.fill(0.25)), disconnect: vi.fn() }))
  class TestRecorder {
    state = 'inactive'
    mimeType = 'audio/webm'
    onstart: (() => void) | null = null
    onstop: (() => void) | null = null
    onerror: (() => void) | null = null
    ondataavailable: ((event: { data: Blob }) => void) | null = null
    start() { this.state = 'recording'; this.onstart?.() }
    stop() {
      this.state = 'inactive'
      this.ondataavailable?.({ data: new Blob(['recording'], { type: 'audio/webm' }) })
      this.onstop?.()
    }
  }
  class TestContext {
    state = 'running'
    currentTime = 10
    destination = {}
    createBufferSource() { return { buffer: null, connect: vi.fn(), disconnect: vi.fn(), start: sourceStart, stop: vi.fn() } }
    createGain() {
      const gain = { value: 1 }
      gains.push(gain)
      return { gain, connect: vi.fn(), disconnect: vi.fn() }
    }
    createAnalyser = analyser
    decodeAudioData = vi.fn().mockResolvedValue({ duration: 2 })
    close = vi.fn().mockResolvedValue(undefined)
  }
  vi.stubGlobal('Blob', NodeBlob)
  vi.stubGlobal('MediaRecorder', TestRecorder)
  vi.stubGlobal('AudioContext', TestContext)
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true, value: { getUserMedia: vi.fn().mockImplementation(async () => {
      expect(session.type).toBe('play-and-record')
      return {
        getTracks: () => [{ stop: () => {
          expect(session.type).toBe('play-and-record')
          microphoneStop()
        } }],
        getAudioTracks: () => [{ onended: null }],
      }
    }) },
  })
  const target: AudioTrack = { id: 'target', projectId: 'p', name: '', createdAt: 1, clips: [] }
  const buffer = { duration: 10 } as AudioBuffer
  const diagnostics = new PlaybackDiagnostics()
  const { result, unmount, rerender } = renderHook(({ log }) => useTrackRecording(save, undefined, log), {
    initialProps: { log: null as PlaybackDiagnostics | null },
  })
  await act(async () => {
    await result.current.start(target, 3, [
      { id: 'a', trackId: 'target', buffer, volume: 1, muted: false, start: 0 },
      { id: 'b', trackId: 'other', buffer, volume: 4, muted: false, start: 1 },
    ], {})
  })
  expect(result.current.phase).toBe('recording')
  expect(session.type).toBe('play-and-record')
  expect(sourceStart).toHaveBeenCalledTimes(1)
  expect(sourceStart).toHaveBeenCalledWith(10, 2, 8)
  expect(gains[0].value).toBe(4)
  expect(analyser).not.toHaveBeenCalled()
  vi.useFakeTimers()
  rerender({ log: diagnostics })
  act(() => vi.advanceTimersByTime(1000))
  expect(diagnostics.snapshot().events).toContainEqual(expect.objectContaining({
    type: 'audio-level', detail: expect.objectContaining({ mode: 'recording', track: 1, gain: 4, peak: 0.25, rms: 0.25 }),
  }))
  rerender({ log: null })
  expect(vi.getTimerCount()).toBe(0)
  vi.useRealTimers()
  act(() => result.current.stop())
  await waitFor(() => expect(result.current.phase).toBe('idle'))
  expect(save).toHaveBeenCalledWith(target, expect.objectContaining({ start: 3, duration: 2 }), {})
  expect(microphoneStop).toHaveBeenCalled()
  expect(session.type).toBe('playback')
  unmount()
  expect(session.type).toBe('auto')
})

it('gibt ein verspätet freigegebenes Mikrofon nach Abbruch frei', async () => {
  let grant: (stream: MediaStream) => void = () => { throw new Error('Berechtigung wurde nicht angefordert') }
  const stop = vi.fn()
  const session = { type: 'auto' }
  Object.defineProperty(navigator, 'audioSession', { configurable: true, value: session })
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true, value: { getUserMedia: () => new Promise<MediaStream>((resolve) => { grant = resolve }) },
  })
  vi.stubGlobal('MediaRecorder', class {})
  const target: AudioTrack = { id: 'target', projectId: 'p', name: '', createdAt: 1, clips: [] }
  const save = vi.fn()
  const { result } = renderHook(() => useTrackRecording(save))
  let pending: Promise<void>
  act(() => { pending = result.current.start(target, 0, [], {}) })
  expect(result.current.phase).toBe('preparing')
  act(() => result.current.stop())
  expect(result.current.phase).toBe('idle')
  expect(session.type).toBe('playback')
  await act(async () => {
    grant({ getTracks: () => [{ stop }] } as unknown as MediaStream)
    await pending
  })
  expect(stop).toHaveBeenCalledOnce()
  expect(session.type).toBe('playback')
  expect(save).not.toHaveBeenCalled()
})

it('gibt die Audiositzung beim Wechsel in den Übungsmodus frei', async () => {
  let grant: (stream: MediaStream) => void = () => { throw new Error('Berechtigung wurde nicht angefordert') }
  const stop = vi.fn()
  const session = { type: 'auto' }
  Object.defineProperty(navigator, 'audioSession', { configurable: true, value: session })
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true, value: { getUserMedia: () => new Promise<MediaStream>((resolve) => { grant = resolve }) },
  })
  vi.stubGlobal('MediaRecorder', class {})
  const { result, rerender } = renderHook(({ enabled }) => useTrackRecording(vi.fn(), undefined, null, enabled), {
    initialProps: { enabled: true },
  })
  let pending: Promise<void>
  act(() => { pending = result.current.start({ id: 't', projectId: 'p', name: '', createdAt: 1 }, 0, [], {}) })
  expect(session.type).toBe('play-and-record')
  rerender({ enabled: false })
  expect(session.type).toBe('auto')
  act(() => result.current.stop())
  await act(async () => {
    grant({ getTracks: () => [{ stop }] } as unknown as MediaStream)
    await pending
  })
  expect(stop).toHaveBeenCalledOnce()
  expect(session.type).toBe('auto')
})

it('zeigt eine verweigerte Mikrofonberechtigung an', async () => {
  const session = { type: 'auto' }
  Object.defineProperty(navigator, 'audioSession', { configurable: true, value: session })
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true, value: { getUserMedia: vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError')) },
  })
  vi.stubGlobal('MediaRecorder', class {})
  const { result, unmount } = renderHook(() => useTrackRecording(vi.fn()))
  await act(async () => result.current.start({ id: 't', projectId: 'p', name: '', createdAt: 1 }, 0, [], {}))
  expect(result.current.phase).toBe('idle')
  expect(result.current.error).toContain('verweigert')
  expect(session.type).toBe('playback')
  unmount()
  expect(session.type).toBe('auto')
})

it('überschreibt keine zwischenzeitlich anderweitig geänderte Audiositzung', async () => {
  const session = { type: 'auto' }
  Object.defineProperty(navigator, 'audioSession', { configurable: true, value: session })
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true, value: { getUserMedia: vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError')) },
  })
  vi.stubGlobal('MediaRecorder', class {})
  const { result, unmount } = renderHook(() => useTrackRecording(vi.fn()))
  await act(async () => result.current.start({ id: 't', projectId: 'p', name: '', createdAt: 1 }, 0, [], {}))
  session.type = 'ambient'
  unmount()
  expect(session.type).toBe('ambient')
})

it('zeigt den Mikrofonfehler auch dann an, wenn der Browser die Audiositzung nicht umstellen kann', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  Object.defineProperty(navigator, 'audioSession', {
    configurable: true, value: { get type() { return 'auto' }, set type(_value: string) { throw new Error('Nicht unterstützt') } },
  })
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true, value: { getUserMedia: vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError')) },
  })
  vi.stubGlobal('MediaRecorder', class {})
  const { result } = renderHook(() => useTrackRecording(vi.fn()))
  await act(async () => result.current.start({ id: 't', projectId: 'p', name: '', createdAt: 1 }, 0, [], {}))
  expect(result.current.error).toContain('verweigert')
  expect(warn).toHaveBeenCalled()
})

it('bietet die Aufnahme bei einem Speicherfehler zum Sichern an', async () => {
  vi.stubGlobal('Blob', NodeBlob)
  vi.stubGlobal('MediaRecorder', class {
    state = 'inactive'
    mimeType = 'audio/ogg'
    onstart: (() => void) | null = null
    onstop: (() => void) | null = null
    ondataavailable: ((event: { data: Blob }) => void) | null = null
    start() { this.state = 'recording'; this.onstart?.() }
    stop() {
      this.state = 'inactive'
      this.ondataavailable?.({ data: new Blob(['audio']) })
      this.onstop?.()
    }
  })
  vi.stubGlobal('AudioContext', class {
    state = 'running'
    currentTime = 0
    decodeAudioData = vi.fn().mockResolvedValue({ duration: 1 })
    close = vi.fn().mockResolvedValue(undefined)
  })
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:recovery'), revokeObjectURL: vi.fn() })
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }], getAudioTracks: () => [{ onended: null }],
    }) },
  })
  const { result } = renderHook(() => useTrackRecording(vi.fn().mockRejectedValue(new Error('Speicher voll'))))
  await act(async () => result.current.start({ id: 't', projectId: 'p', name: '', createdAt: 1 }, 0, [], {}))
  act(() => result.current.stop())
  await waitFor(() => expect(result.current.phase).toBe('idle'))
  expect(result.current.error).toContain('Speicher voll')
  expect(result.current.recovery).toEqual({ url: 'blob:recovery', name: 'aufnahme.ogg' })
  act(() => result.current.discardRecovery())
  expect(result.current.recovery).toBeNull()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:recovery')
})
