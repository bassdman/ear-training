import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSongTransport, type PlaybackTrack } from './useSongTransport'

const sources: { start: ReturnType<typeof vi.fn>, stop: ReturnType<typeof vi.fn>, disconnect: ReturnType<typeof vi.fn>, connect: ReturnType<typeof vi.fn> }[] = []
const contexts: TestContext[] = []
const gains: { gain: { value: number }, connect: ReturnType<typeof vi.fn>, disconnect: ReturnType<typeof vi.fn> }[] = []
let frame: FrameRequestCallback | undefined

class TestContext {
  state: AudioContextState = 'running'
  currentTime = 0
  destination = {}
  resume = vi.fn(async () => { this.state = 'running' })
  close = vi.fn(async () => { this.state = 'closed' })
  createBufferSource() {
    const source = { start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), connect: vi.fn(), buffer: null }
    sources.push(source)
    return source
  }
  createGain() {
    const gain = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() }
    gains.push(gain)
    return gain
  }
  constructor() { contexts.push(this) }
}

const buffers: PlaybackTrack[] = [
  { id: 'one', buffer: { duration: 10 } as AudioBuffer, volume: 1, muted: false },
  { id: 'two', buffer: { duration: 4 } as AudioBuffer, volume: 1, muted: false },
]

beforeEach(() => {
  sources.length = 0
  gains.length = 0
  contexts.length = 0
  frame = undefined
  vi.stubGlobal('AudioContext', TestContext)
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frame = callback; return 1 }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Songtransport', () => {
  it('startet alle Spuren gleichzeitig, pausiert und setzt an derselben Stelle fort', async () => {
    const { result, unmount } = renderHook(() => useSongTransport(buffers, 10, true, 'one,two'))
    await act(async () => result.current.play())
    expect(sources).toHaveLength(2)
    expect(sources[0].start).toHaveBeenCalledWith(0, 0)
    expect(sources[1].start).toHaveBeenCalledWith(0, 0)
    act(() => { contexts[0].currentTime = 2.5; frame?.(0) })
    expect(result.current.position).toBe(2.5)
    act(() => result.current.pause())
    expect(sources[0].stop).toHaveBeenCalledOnce()
    expect(sources[1].stop).toHaveBeenCalledOnce()
    expect(result.current.playing).toBe(false)
    await act(async () => result.current.play())
    expect(sources[2].start).toHaveBeenCalledWith(2.5, 2.5)
    expect(sources[3].start).toHaveBeenCalledWith(2.5, 2.5)
    unmount()
    expect(sources[2].stop).toHaveBeenCalledOnce()
    expect(contexts[0].close).toHaveBeenCalledOnce()
  })

  it('springt während der Wiedergabe gemeinsam und überspringt beendete kurze Spuren', async () => {
    const { result } = renderHook(() => useSongTransport(buffers, 10, true, 'one,two'))
    await act(async () => result.current.play())
    act(() => { contexts[0].currentTime = 1; result.current.seek(7) })
    expect(sources[0].stop).toHaveBeenCalledOnce()
    expect(sources[1].stop).toHaveBeenCalledOnce()
    expect(sources).toHaveLength(3)
    expect(sources[2].start).toHaveBeenCalledWith(1, 7)
    expect(result.current.position).toBe(7)
    expect(result.current.playing).toBe(true)
    act(() => { contexts[0].currentTime = 4; frame?.(0) })
    expect(result.current.position).toBe(10)
    expect(result.current.playing).toBe(false)
    await act(async () => result.current.play())
    expect(sources[3].start).toHaveBeenCalledWith(4, 0)
    expect(sources[4].start).toHaveBeenCalledWith(4, 0)
  })

  it('pausiert beim Hinzufügen einer Spur', async () => {
    const { result, rerender } = renderHook(({ key }) => useSongTransport(buffers, 10, true, key), { initialProps: { key: 'one' } })
    await act(async () => result.current.play())
    act(() => { contexts[0].currentTime = 3 })
    rerender({ key: 'one,two' })
    expect(result.current.playing).toBe(false)
    expect(result.current.position).toBe(3)
    expect(sources[0].stop).toHaveBeenCalledOnce()
  })

  it('meldet Fehler beim Starten', async () => {
    vi.stubGlobal('AudioContext', class { constructor() { throw new Error('Nicht verfügbar') } })
    const { result } = renderHook(() => useSongTransport(buffers, 10, true, 'one'))
    await act(async () => result.current.play())
    expect(result.current.error).toContain('konnte nicht gestartet werden')
    expect(result.current.playing).toBe(false)
  })

  it('bricht einen noch wartenden Start beim Pausieren ab', async () => {
    let resume: (() => void) | undefined
    class SuspendedContext extends TestContext {
      state: AudioContextState = 'suspended'
      resume = vi.fn(() => new Promise<void>((resolve) => {
        resume = () => { this.state = 'running'; resolve() }
      }))
    }
    vi.stubGlobal('AudioContext', SuspendedContext)
    const { result } = renderHook(() => useSongTransport(buffers, 10, true, 'one'))
    let pending: Promise<void>
    act(() => { pending = result.current.play() })
    expect(result.current.starting).toBe(true)
    act(() => result.current.pause())
    await act(async () => { resume?.(); await pending })
    expect(sources).toHaveLength(0)
    expect(result.current.starting).toBe(false)
  })

  it('ändert Lautstärke und Mute live unabhängig und bewahrt die Lautstärke beim Entmuten', async () => {
    const { result, rerender } = renderHook(({ tracks }) => useSongTransport(tracks, 10, true, 'one,two'), { initialProps: { tracks: buffers } })
    await act(async () => result.current.play())
    rerender({ tracks: [{ ...buffers[0], volume: 0.35 }, buffers[1]] })
    expect(gains[0].gain.value).toBe(0.35)
    expect(gains[1].gain.value).toBe(1)
    expect(sources).toHaveLength(2)
    rerender({ tracks: [{ ...buffers[0], volume: 0.35, muted: true }, buffers[1]] })
    expect(gains[0].gain.value).toBe(0)
    rerender({ tracks: [{ ...buffers[0], volume: 0.6, muted: true }, buffers[1]] })
    expect(gains[0].gain.value).toBe(0)
    rerender({ tracks: [{ ...buffers[0], volume: 0.6 }, buffers[1]] })
    expect(gains[0].gain.value).toBe(0.6)
    expect(result.current.playing).toBe(true)
    act(() => result.current.seek(2))
    expect(gains[2].gain.value).toBe(0.6)
    expect(gains[3].gain.value).toBe(1)
  })

  it('plant zeitversetzte Blöcke und setzt sie beim Springen korrekt fort', async () => {
    const clips = [
      { ...buffers[0], id: 'clip-a', trackId: 'spur', start: 5 },
      { ...buffers[1], id: 'clip-b', trackId: 'spur', start: 20 },
    ]
    const { result, rerender } = renderHook(({ tracks }) => useSongTransport(tracks, 24, true, 'clips'), { initialProps: { tracks: clips } })
    await act(async () => result.current.play())
    expect(sources[0].start).toHaveBeenCalledWith(5, 0)
    expect(sources[1].start).toHaveBeenCalledWith(20, 0)
    rerender({ tracks: clips.map((clip) => ({ ...clip, muted: true })) })
    expect(gains[0].gain.value).toBe(0)
    expect(gains[1].gain.value).toBe(0)
    act(() => result.current.seek(8))
    expect(sources[2].start).toHaveBeenCalledWith(0, 3)
    expect(sources[3].start).toHaveBeenCalledWith(12, 0)
  })
})
