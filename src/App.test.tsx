import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

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
      categoryProgress: [{ levelIdx: 0, sectionIdx: 0, unlockedLevelIdx: 0 }],
      toneStyleMode: 'auto',
      playbackVolume: 100,
      setToneStyleMode: vi.fn(),
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
      setCategoryLevelIdx: vi.fn(),
      setCategorySectionIdx: vi.fn(),
      setCategoryUnlockedLevelIdx: vi.fn(),
    })

    render(<App />)
    expect(screen.getByText('Kursübersicht')).toBeInTheDocument()
  })
})
