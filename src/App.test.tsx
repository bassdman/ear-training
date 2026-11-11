import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { TRAINING_DIFFICULTIES } from './features/earTrainer/config'
import { AUDIOBOOK_STORAGE_KEY } from './pages/audiobook/storage'

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
  it('bietet den Tuner auf der Startseite an', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Zum Tuner' })).toHaveAttribute('href', '/tuner')
    expect(screen.getByRole('link', { name: 'Zum Audiobook' })).toHaveAttribute('href', '/audiobook')
    expect(screen.queryByRole('link', { name: 'Zur Kampagne' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Intonationsübungen' })).not.toBeInTheDocument()
  })

  it('leitet alte Übungslinks um, ohne gespeicherte Daten zu löschen', () => {
    const key = 'ear-training-intonation-practice-v1'
    localStorage.setItem(key, '[{"id":"test"}]')
    render(
      <MemoryRouter initialEntries={['/intonation-exercises/create']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Zum Tuner' })).toBeInTheDocument()
    expect(localStorage.getItem(key)).toBe('[{"id":"test"}]')
    localStorage.removeItem(key)
  })

  it('öffnet die Übungsansicht über einen direkten Projektlink', async () => {
    localStorage.setItem(AUDIOBOOK_STORAGE_KEY, JSON.stringify([{ id: 'song', name: 'Mein Lied' }]))
    const view = render(<MemoryRouter initialEntries={['/audiobook/song/exercise']}><App /></MemoryRouter>)
    expect(await screen.findByText(/Übungsansicht: Die Spuren sind schreibgeschützt/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Exercise' })).toHaveAttribute('aria-current', 'page')
    view.unmount()
    localStorage.removeItem(AUDIOBOOK_STORAGE_KEY)
  })

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
