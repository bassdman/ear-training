import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useLiveTuner } from './useLiveTuner'
import { DEFAULT_TUNER_SETTINGS } from '../settings'

describe('Live-Tuner', () => {
  const track = { stop: vi.fn(), onended: null as (() => void) | null }
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] }
  const getUserMedia = vi.fn()
  const close = vi.fn().mockResolvedValue(undefined)
  const resume = vi.fn().mockResolvedValue(undefined)
  let frame: FrameRequestCallback | undefined
  let time = 100
  let initialContextState: 'running' | 'suspended' = 'running'
  let frequency = 440

  beforeEach(() => {
    track.stop.mockClear()
    track.onended = null
    getUserMedia.mockReset().mockResolvedValue(stream)
    close.mockClear()
    resume.mockClear()
    time = 100
    initialContextState = 'running'
    frequency = 440
    vi.spyOn(performance, 'now').mockImplementation(() => time)
    vi.stubGlobal('isSecureContext', true)
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    })
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      frame = callback
      return 1
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal('AudioContext', class {
      state = initialContextState
      sampleRate = 48000
      close = close
      resume = () => {
        this.state = 'running'
        return resume()
      }
      createAnalyser() {
        return {
          fftSize: 2048,
          getFloatTimeDomainData(samples: Float32Array) {
            for (let i = 0; i < samples.length; i++) samples[i] = 0.3 * Math.sin(2 * Math.PI * frequency * i / 48000)
          },
        }
      }
      createMediaStreamSource() { return { connect: vi.fn() } }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('fordert erst beim Start das Mikrofon an und friert den Verlauf beim Stoppen ein', async () => {
    const { result, unmount } = renderHook(() => useLiveTuner())
    expect(getUserMedia).not.toHaveBeenCalled()
    await act(async () => { await result.current.start() })
    expect(result.current.status).toBe('listening')
    time = 200
    act(() => frame?.(time))
    expect(result.current.points.at(-1)?.frequency).toBeCloseTo(440, 0)
    const recorded = result.current.points
    act(() => result.current.stop())
    expect(result.current.status).toBe('idle')
    expect(result.current.points).toEqual(recorded)
    expect(track.stop).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
    unmount()
  })

  it('unterdrückt kurze Oktavsprünge und erkennt anhaltende Wechsel', async () => {
    const { result } = renderHook(() => useLiveTuner())
    await act(async () => { await result.current.start() })
    time = 200
    act(() => frame?.(time))
    expect(result.current.points.at(-1)?.frequency).toBeCloseTo(440, 0)
    frequency = 880
    time += 50
    act(() => frame?.(time))
    expect(result.current.points.at(-1)?.frequency).toBeNull()
    time += 50
    act(() => frame?.(time))
    expect(result.current.points.at(-1)?.frequency).toBeNull()
    time += 50
    act(() => frame?.(time))
    expect(result.current.points.at(-1)?.frequency).toBeCloseTo(880, 0)
    act(() => result.current.clear())
    frequency = 440
    time += 50
    act(() => frame?.(time))
    expect(result.current.points.at(-1)?.frequency).toBeCloseTo(440, 0)
  })

  it('übernimmt geänderte Analyseparameter während der Aufnahme ohne Neustart', async () => {
    const initial = { ...DEFAULT_TUNER_SETTINGS }
    const { result, rerender } = renderHook(({ settings }) => useLiveTuner(settings), {
      initialProps: { settings: initial },
    })

    await act(async () => { await result.current.start() })
    time = 200
    act(() => frame?.(time))
    expect(result.current.points.at(-1)?.frequency).toBeCloseTo(440, 0)
    rerender({ settings: { ...initial, minVolumeRms: 0.3, analysisFftSize: 2048 } })
    time = 300
    act(() => frame?.(time))
    expect(result.current.points.at(-1)?.frequency).toBeNull()
    expect(result.current.status).toBe('listening')
    expect(getUserMedia).toHaveBeenCalledOnce()
    expect(track.stop).not.toHaveBeenCalled()
  })

  it('übernimmt die Anzahl übersprungener Frames beim Start und während der Aufnahme', async () => {
    const initial = { ...DEFAULT_TUNER_SETTINGS }
    const { result, rerender } = renderHook(({ settings }) => useLiveTuner(settings), { initialProps: { settings: initial } })
    rerender({ settings: { ...initial, octaveSkipFrames: 0 } })
    await act(async () => { await result.current.start() })
    time = 200
    act(() => frame?.(time))
    frequency = 880
    time += 50
    act(() => frame?.(time))
    expect(result.current.points.at(-1)?.frequency).toBeCloseTo(880, 0)
    rerender({ settings: { ...initial, octaveSkipFrames: 1 } })
    time += 50
    act(() => frame?.(time))
    frequency = 440
    time += 50
    act(() => frame?.(time))
    expect(result.current.points.at(-1)?.frequency).toBeNull()
    time += 50
    act(() => frame?.(time))
    expect(result.current.points.at(-1)?.frequency).toBeCloseTo(440, 0)
  })

  it('aktiviert einen angehaltenen AudioContext vor dem Berechtigungsdialog', async () => {
    initialContextState = 'suspended'
    const { result } = renderHook(() => useLiveTuner())
    await act(async () => { await result.current.start() })
    expect(result.current.status).toBe('listening')
    expect(resume).toHaveBeenCalledOnce()
    expect(resume.mock.invocationCallOrder[0]).toBeLessThan(getUserMedia.mock.invocationCallOrder[0])
  })

  it('stoppt einen verspätet freigegebenen Stream nach Abbruch', async () => {
    let resolveStream: (value: typeof stream) => void = () => {}
    getUserMedia.mockReturnValue(new Promise((resolve) => { resolveStream = resolve }))
    const { result } = renderHook(() => useLiveTuner())
    let pending: Promise<void>
    act(() => { pending = result.current.start() })
    expect(result.current.status).toBe('starting')
    act(() => result.current.stop())
    await act(async () => { resolveStream(stream); await pending })
    expect(track.stop).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
    expect(result.current.status).toBe('idle')
  })

  it('gibt einen verspätet freigegebenen Stream nach Verlassen der Seite frei', async () => {
    let resolveStream: (value: typeof stream) => void = () => {}
    getUserMedia.mockReturnValue(new Promise((resolve) => { resolveStream = resolve }))
    const { result, unmount } = renderHook(() => useLiveTuner())
    let pending: Promise<void>
    act(() => { pending = result.current.start() })
    unmount()
    await act(async () => { resolveStream(stream); await pending })
    expect(track.stop).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
  })

  it('löscht den Verlauf ohne das Mikrofon zu stoppen', async () => {
    const { result } = renderHook(() => useLiveTuner())
    await act(async () => { await result.current.start() })
    time = 200
    act(() => frame?.(time))
    expect(result.current.points).toHaveLength(1)
    act(() => result.current.clear())
    expect(result.current.points).toEqual([])
    expect(result.current.timeMs).toBe(0)
    expect(result.current.status).toBe('listening')
    expect(track.stop).not.toHaveBeenCalled()
    time = 300
    act(() => frame?.(time))
    expect(result.current.points[0]?.timeMs).toBe(100)
  })

  it('meldet eine getrennte Mikrofonquelle und gibt Ressourcen frei', async () => {
    const { result } = renderHook(() => useLiveTuner())
    await act(async () => { await result.current.start() })
    act(() => track.onended?.())
    expect(result.current.status).toBe('error')
    expect(result.current.error).toContain('getrennt')
    expect(track.stop).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
  })

  it('zeigt einen Berechtigungsfehler an und gibt den AudioContext frei', async () => {
    getUserMedia.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => useLiveTuner())
    await act(async () => { await result.current.start() })
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toContain('verweigert')
    expect(close).toHaveBeenCalledOnce()
    log.mockRestore()
  })
})
