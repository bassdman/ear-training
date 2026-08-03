import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CoursePage } from './CoursePage'
import {
  DIFFICULTY_IDS,
  INSTRUMENTS,
  TRAINING_CATEGORIES,
  TRAINING_DIFFICULTIES,
} from '../earTrainer/config'

const buildDifficultyProgress = () => ({
  easy: [{ levelIdx: 0, sectionIdx: 0, unlockedLevelIdx: 0 }],
  medium: [{ levelIdx: 0, sectionIdx: 0, unlockedLevelIdx: 0 }],
  hard: [{ levelIdx: 0, sectionIdx: 0, unlockedLevelIdx: 0 }],
})

describe('CoursePage', () => {
  it('zeigt Loading-State', () => {
    render(
      <CoursePage
        loaded={false}
        categories={TRAINING_CATEGORIES}
        instruments={INSTRUMENTS}
        activeCategoryIdx={0}
        activeDifficultyId="easy"
        difficultyIds={DIFFICULTY_IDS}
        difficultyConfig={TRAINING_DIFFICULTIES}
        categoryDifficultyProgress={buildDifficultyProgress()}
        selectedInstrumentId="piano"
        playbackVolume={100}
        onSelectedInstrumentChange={vi.fn()}
        onPlaybackVolumeChange={vi.fn()}
        onActiveDifficultyChange={vi.fn()}
        onOpenLevel={vi.fn()}
        onContinue={vi.fn()}
        onOpenCampaign={vi.fn()}
      />,
    )

    expect(screen.getByText('Lade Kurs ...')).toBeInTheDocument()
  })

  it('lässt Audio-Einstellungen ändern und öffnet freigeschaltete Übungen', () => {
    const onSelectedInstrumentChange = vi.fn()
    const onPlaybackVolumeChange = vi.fn()
    const onActiveDifficultyChange = vi.fn()
    const onOpenLevel = vi.fn()
    const onContinue = vi.fn()
    const onOpenCampaign = vi.fn()

    render(
      <CoursePage
        loaded
        categories={TRAINING_CATEGORIES.slice(0, 1)}
        instruments={INSTRUMENTS}
        activeCategoryIdx={0}
        activeDifficultyId="easy"
        difficultyIds={DIFFICULTY_IDS}
        difficultyConfig={TRAINING_DIFFICULTIES}
        categoryDifficultyProgress={buildDifficultyProgress()}
        selectedInstrumentId="piano"
        playbackVolume={100}
        onSelectedInstrumentChange={onSelectedInstrumentChange}
        onPlaybackVolumeChange={onPlaybackVolumeChange}
        onActiveDifficultyChange={onActiveDifficultyChange}
        onOpenLevel={onOpenLevel}
        onContinue={onContinue}
        onOpenCampaign={onOpenCampaign}
      />,
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'piano' } })
    expect(onSelectedInstrumentChange).toHaveBeenCalledWith('piano')

    fireEvent.change(screen.getByRole('slider'), { target: { value: '87' } })
    expect(onPlaybackVolumeChange).toHaveBeenCalledWith(87)

    fireEvent.click(screen.getByRole('tab', { name: 'Mittel' }))
    expect(onActiveDifficultyChange).toHaveBeenCalledWith('medium')

    fireEvent.click(screen.getByRole('button', { name: /Weiter in/ }))
    expect(onContinue).toHaveBeenCalledWith(0, 'medium')

    const grid = screen.getByLabelText('Sehr tiefe Männerlage Übungen')
    const levelButtons = within(grid).getAllByRole('button')
    fireEvent.click(levelButtons[0])
    expect(onOpenLevel).toHaveBeenCalledWith(0, 'medium', 0)

    expect(screen.getByRole('button', { name: /Übung 2/ })).toBeDisabled()
  }, 15000)
})
