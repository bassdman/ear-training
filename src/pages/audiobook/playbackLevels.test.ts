import { afterEach, describe, expect, it, vi } from 'vitest'
import { PlaybackDiagnostics } from './playbackDiagnostics'
import { startPlaybackLevels } from './playbackLevels'

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('Audiopegel-Diagnose', () => {
  it('misst an separaten Abzweigungen und entfernt sie ohne den Hörpfad zu verändern', () => {
    vi.useFakeTimers()
    const nodes: { fftSize: number, getFloatTimeDomainData: (array: Float32Array) => void, disconnect: ReturnType<typeof vi.fn> }[] = []
    const context = {
      state: 'running', sampleRate: 48000, baseLatency: 0.01,
      createAnalyser: () => {
        const samples = nodes.length === 0 ? [0.8, -0.8] : [0.2, -0.2]
        const node = {
          fftSize: 0,
          getFloatTimeDomainData: (array: Float32Array) => array.forEach((_, i) => { array[i] = samples[i % 2] }),
          disconnect: vi.fn(),
        }
        nodes.push(node)
        return node
      },
    } as unknown as AudioContext
    const gain = { gain: { value: 4 }, connect: vi.fn(), disconnect: vi.fn() }
    const diagnostics = new PlaybackDiagnostics()
    const stop = startPlaybackLevels(context, new Map([['private-id', gain as unknown as GainNode]]), diagnostics, 'playback', () => 12)
    vi.advanceTimersByTime(1000)
    const events = diagnostics.snapshot().events
    expect(events).toContainEqual(expect.objectContaining({
      type: 'audio-level', detail: { mode: 'playback', track: 1, position: 12, gain: 4, peak: 0.2, rms: 0.2 },
    }))
    expect(events).toContainEqual(expect.objectContaining({
      type: 'audio-level', detail: { mode: 'playback', track: 0, position: 12, gain: 1, peak: 0.8, rms: 0.8 },
    }))
    expect(JSON.stringify(events)).not.toContain('private-id')
    stop()
    expect(gain.disconnect).toHaveBeenCalledTimes(2)
    expect(gain.disconnect).toHaveBeenCalledWith(nodes[0])
    expect(gain.disconnect).toHaveBeenCalledWith(nodes[1])
    vi.advanceTimersByTime(2000)
    expect(diagnostics.snapshot().events.filter((event) => event.type === 'audio-level')).toHaveLength(2)
  })

  it('protokolliert Fehler und entfernt bereits verbundene Messknoten', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    let count = 0
    const context = {
      createAnalyser: () => {
        count++
        if (count === 3) throw new Error('Messung nicht verfügbar')
        return { fftSize: 0, disconnect: vi.fn() }
      },
    } as unknown as AudioContext
    const gain = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() }
    const log = new PlaybackDiagnostics()
    startPlaybackLevels(context, new Map([
      ['a', gain as unknown as GainNode], ['b', gain as unknown as GainNode],
    ]), log, 'recording', () => 0)
    expect(gain.disconnect).toHaveBeenCalledTimes(2)
    expect(log.snapshot().events).toContainEqual(expect.objectContaining({ type: 'level-monitor-error' }))
    expect(error).toHaveBeenCalledOnce()
  })

  it('beendet bei einem Messfehler den Timer und kann anschließend erneut gestoppt werden', () => {
    vi.useFakeTimers()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const context = {
      state: 'running', sampleRate: 48000,
      createAnalyser: () => ({
        fftSize: 2048,
        getFloatTimeDomainData: () => { throw new Error('Messfehler') },
        disconnect: vi.fn(),
      }),
    } as unknown as AudioContext
    const gain = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() }
    const log = new PlaybackDiagnostics()
    const stop = startPlaybackLevels(context, new Map([['a', gain as unknown as GainNode]]), log, 'playback', () => 0)
    vi.advanceTimersByTime(1000)
    expect(vi.getTimerCount()).toBe(0)
    expect(log.snapshot().events).toContainEqual(expect.objectContaining({ type: 'level-monitor-error' }))
    stop()
    expect(gain.disconnect).toHaveBeenCalledTimes(2)
    expect(error).toHaveBeenCalledOnce()
  })
})
