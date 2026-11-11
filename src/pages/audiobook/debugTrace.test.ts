import { afterEach, describe, expect, it, vi } from 'vitest'

import { createVocalDebugTrace, downloadVocalDebugTrace } from './debugTrace'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Vocal-Debug-Trace', () => {
  it('startet einen lokalen JSON-Download und gibt die temporäre URL frei', () => {
    vi.useFakeTimers()
    const blobUrl = vi.fn(() => 'blob:trace')
    const revoke = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: blobUrl, revokeObjectURL: revoke })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('vocal-debug-trace.json')
      expect(this.href).toBe('blob:trace')
      expect(this.isConnected).toBe(true)
    })
    const trace = createVocalDebugTrace({ id: 'v', projectId: 'p', name: 'Lead', createdAt: 1 }, 1, 2, [])
    downloadVocalDebugTrace(trace)
    expect(blobUrl).toHaveBeenCalledWith(expect.objectContaining({ type: 'application/json' }))
    expect(click).toHaveBeenCalledOnce()
    expect(document.querySelector('a[download="vocal-debug-trace.json"]')).toBeNull()
    expect(revoke).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(revoke).toHaveBeenCalledWith('blob:trace')
  })
})
