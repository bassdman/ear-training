import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSongTransport } from './useSongTransport'

const sources: { start: ReturnType<typeof vi.fn>, stop: ReturnType<typeof vi.fn>, disconnect: ReturnType<typeof vi.fn>, connect: ReturnType<typeof vi.fn> }[] = []
const contexts: TestContext[] = []
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
  constructor() { contexts.push(this) }
}

const buffers = [{ duration: 10 }, { duration: 4 }] as AudioBuffer[]

beforeEach(() => {
  sources.length = 0
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
})
