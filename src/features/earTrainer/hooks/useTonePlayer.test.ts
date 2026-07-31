import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTonePlayer } from './useTonePlayer'

const { startMock, disposeMock, soundfontMock } = vi.hoisted(() => {
  const start = vi.fn(() => vi.fn())
  const dispose = vi.fn()
  const soundfont = vi.fn(() => ({
    ready: Promise.resolve(),
    start,
    dispose,
    output: { volume: 100 },
  }))

  return {
    startMock: start,
    disposeMock: dispose,
    soundfontMock: soundfont,
  }
})

vi.mock('smplr', () => ({
  Soundfont: soundfontMock,
}))

class FakeAudioContext {
  state: AudioContextState = 'suspended'
  currentTime = 0
  destination = {}

  createOscillator() {
    return {
      type: 'sine' as OscillatorType,
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }
  }

  createGain() {
    const gain = {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
    }

    return {
      gain,
      connect: vi.fn(),
    }
  }

  async resume() {
    this.state = 'running'
  }

  async close() {
    this.state = 'closed'
  }
}

describe('useTonePlayer', () => {
  beforeEach(() => {
    soundfontMock.mockClear()
    startMock.mockClear()
    disposeMock.mockClear()
    vi.stubGlobal('AudioContext', FakeAudioContext as unknown as typeof AudioContext)
  })

  it('lädt Soundfont-Instrumente vor', async () => {
    const { result } = renderHook(() => useTonePlayer())

    await act(async () => {
      await result.current.preloadInstrument('piano')
    })

    expect(soundfontMock).toHaveBeenCalledTimes(1)
    expect(result.current.loadStateByInstrument.piano.ready).toBe(true)
  })

  it('startet und stoppt Soundfont-Ton', async () => {
    const { result } = renderHook(() => useTonePlayer())

    await act(async () => {
      await result.current.startTone('C', 'piano', 'colorA', 1, 90)
    })

    await waitFor(() => expect(startMock).toHaveBeenCalled())
    expect(result.current.isPlaying).toBe(true)

    act(() => {
      result.current.stopTone()
    })

    expect(result.current.isPlaying).toBe(false)
  })

  it('nutzt bei Synth-Stil den Fallback ohne Soundfont-Aufruf', async () => {
    const { result } = renderHook(() => useTonePlayer())

    await act(async () => {
      await result.current.startTone('C', 'synth', 'colorA', 1, 100)
    })

    expect(soundfontMock).not.toHaveBeenCalled()
    expect(result.current.isPlaying).toBe(true)
  })
})
