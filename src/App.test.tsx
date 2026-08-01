import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { TRAINING_DIFFICULTIES } from './features/earTrainer/config'

const { useTrainerProgressMock } = vi.hoisted(() => ({
  useTrainerProgressMock: vi.fn(),
}))

vi.mock('./features/earTrainer/hooks/useTrainerProgress', () => ({
  useTrainerProgress: () => useTrainerProgressMock(),
}))

vi.mock('./components/EarTrainer', () => ({
  default: () => <div>Mock EarTrainer</div>,
}))

import App from './App'

describe('App', () => {
  it('startet auf der Kursseite', () => {
    useTrainerProgressMock.mockReturnValue({
      loaded: true,
      activeCategoryIdx: 0,
      activeDifficultyId: 'easy',
      difficultyIds: ['easy', 'medium', 'hard'],
      difficultyConfig: TRAINING_DIFFICULTIES,
      categoryDifficultyProgress: {
        easy: [{ levelIdx: 0, sectionIdx: 0, unlockedLevelIdx: 0 }],
        medium: [{ levelIdx: 0, sectionIdx: 0, unlockedLevelIdx: 0 }],
        hard: [{ levelIdx: 0, sectionIdx: 0, unlockedLevelIdx: 0 }],
      },
      categoryProgress: [{ levelIdx: 0, sectionIdx: 0, unlockedLevelIdx: 0 }],
      selectedInstrumentId: 'piano',
      playbackVolume: 100,
      setSelectedInstrumentId: vi.fn(),
      setPlaybackVolume: vi.fn(),
      levelIdx: 0,
      sectionIdx: 0,
      bestStreak: 0,
      unlockedLevelIdx: 0,
      setActiveCategoryIdx: vi.fn(),
      setLevelIdx: vi.fn(),
      setSectionIdx: vi.fn(),
      setBestStreak: vi.fn(),
      setUnlockedLevelIdx: vi.fn(),
      setActiveDifficultyId: vi.fn(),
      setCategoryLevelIdx: vi.fn((_, __, value) => value),
      setCategorySectionIdx: vi.fn((_, __, value) => value),
      setCategoryUnlockedLevelIdx: vi.fn((_, __, value) => value),
    })

    render(
      <MemoryRouter initialEntries={['/course']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByText('Kursübersicht')).toBeInTheDocument()
  })
})
