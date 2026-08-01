import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import EarTrainer from './EarTrainer'

describe('EarTrainer', () => {
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
        selectedInstrumentId="piano"
        playbackVolume={100}
        setPlaybackVolume={vi.fn()}
        onBackToCourse={vi.fn()}
      />,
    )

    expect(screen.getByText('Lade Fortschritt ...')).toBeInTheDocument()
  })

  it('rendert den statischen Ton-Button und das Audio-Panel', () => {
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
        selectedInstrumentId="piano"
        playbackVolume={100}
        setPlaybackVolume={() => {}}
        onBackToCourse={() => {}}
      />,
    )

    expect(screen.getByText('Klavier')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ton abspielen' })).toBeInTheDocument()
  })
})
