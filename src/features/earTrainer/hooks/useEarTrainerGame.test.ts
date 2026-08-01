import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useEarTrainerGame } from './useEarTrainerGame'

describe('useEarTrainerGame', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('erstellt Trial und aktiviert Ratemodus', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const progressSetters = {
      setLevelIdx: vi.fn(),
      setSectionIdx: vi.fn(),
      setBestStreak: vi.fn(),
      setUnlockedLevelIdx: vi.fn(),
    }

    const { result } = renderHook(() =>
      useEarTrainerGame({
        levelIdx: 0,
        sectionIdx: 0,
        bestStreak: 0,
        progressSetters,
        frequencyMultipliers: [1],
        toneStyleCount: 1,
      }),
    )

    let trial!: ReturnType<typeof result.current.startTrial>
    act(() => {
      trial = result.current.startTrial()
    })

    expect(trial).toEqual({ note: 'D', toneStyle: 'colorA', frequencyMultiplier: 1 })
    expect(result.current.awaitingGuess).toBe(true)
    expect(result.current.guessOptions[0].id).toContain('|1')
  })

  it('setzt bei falschem Guess Forced-Trial und Abschnittsfortschritt zurück', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const progressSetters = {
      setLevelIdx: vi.fn(),
      setSectionIdx: vi.fn(),
      setBestStreak: vi.fn(),
      setUnlockedLevelIdx: vi.fn(),
    }

    const { result } = renderHook(() =>
      useEarTrainerGame({
        levelIdx: 0,
        sectionIdx: 0,
        bestStreak: 0,
        progressSetters,
        frequencyMultipliers: [1],
        toneStyleCount: 1,
      }),
    )

    let trial!: ReturnType<typeof result.current.startTrial>
    act(() => {
      trial = result.current.startTrial()
    })

    act(() => {
      result.current.handleGuess('F|1')
    })

    expect(result.current.feedback?.correct).toBe(false)
    expect(result.current.forcedTrial).toEqual(trial)
    expect(result.current.levelProgress).toBe(0)
  })

  it('schaltet nach 5 richtigen Antworten den nächsten Abschnitt frei', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const progressSetters = {
      setLevelIdx: vi.fn(),
      setSectionIdx: vi.fn(),
      setBestStreak: vi.fn(),
      setUnlockedLevelIdx: vi.fn(),
    }

    const { result } = renderHook(() =>
      useEarTrainerGame({
        levelIdx: 0,
        sectionIdx: 0,
        bestStreak: 0,
        progressSetters,
        frequencyMultipliers: [1],
        toneStyleCount: 1,
      }),
    )

    for (let i = 0; i < 5; i += 1) {
      let trial!: ReturnType<typeof result.current.startTrial>
      act(() => {
        trial = result.current.startTrial()
      })

      act(() => {
        result.current.handleGuess(`${trial?.note}|${trial?.frequencyMultiplier}`)
      })
    }

    expect(progressSetters.setSectionIdx).toHaveBeenCalledWith(1)
  })
})
