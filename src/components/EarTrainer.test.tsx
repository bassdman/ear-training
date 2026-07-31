import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import EarTrainer from './EarTrainer'

const mockUseEarTrainerGame = vi.fn()
const mockUseTonePlayer = vi.fn()

vi.mock('../features/earTrainer/hooks/useEarTrainerGame', () => ({
  useEarTrainerGame: (...args: unknown[]) => mockUseEarTrainerGame(...args),
}))

vi.mock('../features/earTrainer/hooks/useTonePlayer', () => ({
  useTonePlayer: (...args: unknown[]) => mockUseTonePlayer(...args),
}))

describe('EarTrainer', () => {
  beforeEach(() => {
    mockUseEarTrainerGame.mockReturnValue({
      toneSet: ['C', 'D', 'E'],
      guessOptions: [{ id: 'C|1', note: 'C', frequencyMultiplier: 1, label: 'c4' }],
      unlockedToneStyles: ['piano'],
      levelProgress: 3,
      levelProgressTotal: 25,
      forcedTrial: null,
      awaitingGuess: false,
      feedback: null,
      leveledUpToast: null,
      accuracy: 80,
      startTrial: vi.fn(() => ({ note: 'C', toneStyle: 'piano', frequencyMultiplier: 1 })),
      getCurrentTrial: vi.fn(() => ({ note: 'C', toneStyle: 'piano', frequencyMultiplier: 1 })),
      handleGuess: vi.fn(),
    })

    mockUseTonePlayer.mockReturnValue({
      isPlaying: false,
      isPreloading: false,
      overallLoad: { loaded: 1, total: 1 },
      startTone: vi.fn(async () => {}),
      stopTone: vi.fn(),
      preloadToneStyles: vi.fn(async () => {}),
    })
  })

  it('zeigt Loading-Zustand', () => {
    render(
      <EarTrainer
        loaded={false}
        levelIdx={0}
        sectionIdx={0}
        bestStreak={0}
        setLevelIdx={vi.fn()}
        setSectionIdx={vi.fn()}
        setBestStreak={vi.fn()}
        setUnlockedLevelIdx={vi.fn()}
        rangeLabel="Mittlere Lage"
        rangeSubtitle="C4 bis H4"
        rangeFrequencyMultipliers={[1]}
        toneStyleMode="auto"
        playbackVolume={100}
        setToneStyleMode={vi.fn()}
        setPlaybackVolume={vi.fn()}
        onBackToCourse={vi.fn()}
      />,
    )

    expect(screen.getByText('Lade Fortschritt ...')).toBeInTheDocument()
  })

  it('rendert Audio-Panel und Back-Button', () => {
    const onBackToCourse = vi.fn()
    const setToneStyleMode = vi.fn()
    const setPlaybackVolume = vi.fn()

    render(
      <EarTrainer
        loaded
        levelIdx={0}
        sectionIdx={0}
        bestStreak={0}
        setLevelIdx={vi.fn()}
        setSectionIdx={vi.fn()}
        setBestStreak={vi.fn()}
        setUnlockedLevelIdx={vi.fn()}
        rangeLabel="Mittlere Lage"
        rangeSubtitle="C4 bis H4"
        rangeFrequencyMultipliers={[1]}
        toneStyleMode="auto"
        playbackVolume={100}
        setToneStyleMode={setToneStyleMode}
        setPlaybackVolume={setPlaybackVolume}
        onBackToCourse={onBackToCourse}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Zur Kursseite' }))
    expect(onBackToCourse).toHaveBeenCalledTimes(1)

    fireEvent.change(screen.getByLabelText('Instrument'), { target: { value: 'piano' } })
    expect(setToneStyleMode).toHaveBeenCalledWith('piano')

    fireEvent.change(screen.getByLabelText('Lautstärke'), { target: { value: '90' } })
    expect(setPlaybackVolume).toHaveBeenCalledWith(90)
    expect(screen.getByText('Samples bereit')).toBeInTheDocument()
  })
})
