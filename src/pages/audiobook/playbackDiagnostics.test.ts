import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadPlaybackDiagnostics, PlaybackDiagnostics } from './playbackDiagnostics'

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('Wiedergabe-Diagnose', () => {
  it('aggregiert Messungen, begrenzt den Speicher und entfernt Listener beim Stoppen', () => {
    vi.useFakeTimers()
    const log = new PlaybackDiagnostics()
    log.start()
    log.measure('waveformCacheHits', 1)
    log.measure('waveformCacheHits', 1)
    vi.advanceTimersByTime(1000)
    expect(log.snapshot().events).toContainEqual(expect.objectContaining({
      type: 'metric', detail: { name: 'waveformCacheHits', count: 2, total: 2, max: 1 },
    }))
    for (let i = 0; i < 3100; i++) log.event('seek', { origin: 'scroll', to: i })
    expect(log.snapshot().events).toHaveLength(3000)
    expect(log.snapshot().droppedEvents).toBeGreaterThan(0)
    log.stop()
    const count = log.snapshot().events.length
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(2000)
    expect(log.snapshot().events).toHaveLength(count)
  })

  it('exportiert JSON und gibt die Objekt-URL wieder frei', () => {
    vi.useFakeTimers()
    const create = vi.fn(() => 'blob:log')
    const revoke = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    downloadPlaybackDiagnostics(new PlaybackDiagnostics())
    expect(create).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(1000)
    expect(revoke).toHaveBeenCalledWith('blob:log')
  })

  it('protokolliert einen nicht verfügbaren Long-Task-Observer und läuft weiter', () => {
    class BrokenObserver {
      static supportedEntryTypes = ['longtask']
      observe() { throw new Error('Nicht unterstützt') }
      disconnect() {}
    }
    vi.stubGlobal('PerformanceObserver', BrokenObserver)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const log = new PlaybackDiagnostics()
    log.start()
    log.start()
    expect(log.snapshot().events.filter((event) => event.type === 'diagnostics-start')).toHaveLength(1)
    expect(log.snapshot().events).toContainEqual(expect.objectContaining({ type: 'longtask-observer-error' }))
    expect(error).toHaveBeenCalledOnce()
    log.stop()
    log.stop()
    expect(log.snapshot().events.filter((event) => event.type === 'diagnostics-stop')).toHaveLength(1)
  })
})
