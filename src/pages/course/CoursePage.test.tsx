import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { navigateMock, useTrainerProgressMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  useTrainerProgressMock: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')

  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('../../features/earTrainer/hooks/useTrainerProgress', () => ({
  useTrainerProgress: () => useTrainerProgressMock(),
}))

import { CoursePage } from './CoursePage'
import {
  DIFFICULTY_IDS,
  INSTRUMENTS,
  TRAINING_CATEGORIES,
  TRAINING_DIFFICULTIES,
} from '../../features/earTrainer/config'

const buildDifficultyProgress = () => ({
  easy: TRAINING_CATEGORIES.map(() => ({ levelIdx: 0, sectionIdx: 0, unlockedLevelIdx: 0 })),
  medium: TRAINING_CATEGORIES.map(() => ({ levelIdx: 0, sectionIdx: 0, unlockedLevelIdx: 0 })),
  hard: TRAINING_CATEGORIES.map(() => ({ levelIdx: 0, sectionIdx: 0, unlockedLevelIdx: 0 })),
})

describe('CoursePage', () => {
  const buildProgress = () => ({
    loaded: true,
    activeCategoryIdx: 0,
    activeDifficultyId: 'easy' as const,
    difficultyIds: DIFFICULTY_IDS,
    difficultyConfig: TRAINING_DIFFICULTIES,
    categoryDifficultyProgress: buildDifficultyProgress(),
    selectedInstrumentId: 'piano' as const,
    playbackVolume: 100,
    setSelectedInstrumentId: vi.fn(),
    setPlaybackVolume: vi.fn(),
    setActiveCategoryIdx: vi.fn(),
    setActiveDifficultyId: vi.fn(),
    setCategoryLevelIdx: vi.fn(),
    setCategorySectionIdx: vi.fn(),
  })

  beforeEach(() => {
    navigateMock.mockReset()
    useTrainerProgressMock.mockReset()
  })

  it('zeigt Loading-State', () => {
    useTrainerProgressMock.mockReturnValue({
      ...buildProgress(),
      loaded: false,
    })

    render(<CoursePage />)

    expect(screen.getByText('Lade Kurs ...')).toBeInTheDocument()
  })

  it('lässt Audio-Einstellungen ändern und öffnet freigeschaltete Übungen', () => {
    const progress = buildProgress()
    useTrainerProgressMock.mockReturnValue(progress)

    render(<CoursePage />)

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'guitar' } })
    expect(progress.setSelectedInstrumentId).toHaveBeenCalledWith('guitar')

    fireEvent.change(screen.getByRole('slider'), { target: { value: '87' } })
    expect(progress.setPlaybackVolume).toHaveBeenCalledWith(87)

    const firstTablist = screen.getByRole('tablist', { name: 'Sehr tiefe Männerlage Schwierigkeitsgrad' })
    fireEvent.click(within(firstTablist).getByRole('tab', { name: 'Mittel' }))
    expect(progress.setActiveDifficultyId).toHaveBeenCalledWith('medium')

    fireEvent.click(screen.getByRole('button', { name: /Weiter in/ }))
    expect(navigateMock).toHaveBeenCalledWith('/trainer')

    const grid = screen.getByLabelText('Sehr tiefe Männerlage Übungen')
    const levelButtons = within(grid).getAllByRole('button')
    fireEvent.click(levelButtons[0])
    expect(progress.setActiveCategoryIdx).toHaveBeenCalledWith(0)
    expect(progress.setActiveDifficultyId).toHaveBeenCalledWith('medium')
    expect(progress.setCategoryLevelIdx).toHaveBeenCalledWith(0, 'medium', 0)
    expect(progress.setCategorySectionIdx).toHaveBeenCalledWith(0, 'medium', 0)
    expect(navigateMock).toHaveBeenCalledWith('/trainer')

    expect(levelButtons[1]).toBeDisabled()
  }, 15000)
})
