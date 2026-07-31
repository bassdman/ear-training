import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTrainerProgress } from './useTrainerProgress'

const readProgressMock = vi.fn()
const writeProgressMock = vi.fn()

vi.mock('../storage', () => ({
  readProgress: (...args: unknown[]) => readProgressMock(...args),
  writeProgress: (...args: unknown[]) => writeProgressMock(...args),
}))

describe('useTrainerProgress', () => {
  beforeEach(() => {
    readProgressMock.mockReset()
    writeProgressMock.mockReset()
  })

  it('lädt Defaults wenn kein gespeicherter Fortschritt existiert', async () => {
    readProgressMock.mockResolvedValue(null)
    writeProgressMock.mockResolvedValue(undefined)

    const { result } = renderHook(() => useTrainerProgress())

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.levelIdx).toBe(0)
    expect(result.current.sectionIdx).toBe(0)
    expect(result.current.selectedInstrumentId).toBe('piano')
    expect(result.current.playbackVolume).toBe(100)
  })

  it('übernimmt gespeicherte Werte und clampt Lautstärke', async () => {
    readProgressMock.mockResolvedValue(
      JSON.stringify({
        activeCategoryIdx: 0,
        categoryProgress: [{ levelIdx: 2, sectionIdx: 1, unlockedLevelIdx: 2 }],
        bestStreak: 11,
        selectedInstrumentId: 'piano',
        playbackVolume: 200,
      }),
    )
    writeProgressMock.mockResolvedValue(undefined)

    const { result } = renderHook(() => useTrainerProgress())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    expect(result.current.levelIdx).toBe(2)
    expect(result.current.sectionIdx).toBe(1)
    expect(result.current.bestStreak).toBe(11)
    expect(result.current.selectedInstrumentId).toBe('piano')
    expect(result.current.playbackVolume).toBe(127)
  })

  it('speichert Änderungen', async () => {
    readProgressMock.mockResolvedValue(null)
    writeProgressMock.mockResolvedValue(undefined)

    const { result } = renderHook(() => useTrainerProgress())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => {
      result.current.setBestStreak(5)
      result.current.setSelectedInstrumentId('flute')
      result.current.setPlaybackVolume(84)
    })

    await waitFor(() => expect(writeProgressMock).toHaveBeenCalled())
    const latestPayload = writeProgressMock.mock.calls.at(-1)?.[1] as string
    expect(latestPayload).toContain('"bestStreak":5')
    expect(latestPayload).toContain('"selectedInstrumentId":"flute"')
    expect(latestPayload).toContain('"playbackVolume":84')
  })
})
