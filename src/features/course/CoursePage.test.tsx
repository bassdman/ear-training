import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CoursePage } from './CoursePage'
import { TONE_STYLES, TRAINING_CATEGORIES } from '../earTrainer/config'

describe('CoursePage', () => {
  it('zeigt Loading-State', () => {
    render(
      <CoursePage
        loaded={false}
        categories={TRAINING_CATEGORIES}
        toneStyles={TONE_STYLES}
        activeCategoryIdx={0}
        categoryProgress={[]}
        toneStyleMode="auto"
        playbackVolume={100}
        onToneStyleModeChange={vi.fn()}
        onPlaybackVolumeChange={vi.fn()}
        onOpenLevel={vi.fn()}
        onContinue={vi.fn()}
      />,
    )

    expect(screen.getByText('Lade Kurs ...')).toBeInTheDocument()
  })

  it('lässt Audio-Einstellungen ändern und öffnet freigeschaltete Übungen', () => {
    const onToneStyleModeChange = vi.fn()
    const onPlaybackVolumeChange = vi.fn()
    const onOpenLevel = vi.fn()
    const onContinue = vi.fn()

    render(
      <CoursePage
        loaded
        categories={TRAINING_CATEGORIES.slice(0, 1)}
        toneStyles={TONE_STYLES}
        activeCategoryIdx={0}
        categoryProgress={[{ levelIdx: 0, sectionIdx: 0, unlockedLevelIdx: 0 }]}
        toneStyleMode="auto"
        playbackVolume={100}
        onToneStyleModeChange={onToneStyleModeChange}
        onPlaybackVolumeChange={onPlaybackVolumeChange}
        onOpenLevel={onOpenLevel}
        onContinue={onContinue}
      />,
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'piano' } })
    expect(onToneStyleModeChange).toHaveBeenCalledWith('piano')

    fireEvent.change(screen.getByRole('slider'), { target: { value: '87' } })
    expect(onPlaybackVolumeChange).toHaveBeenCalledWith(87)

    fireEvent.click(screen.getByRole('button', { name: /Weiter in/ }))
    expect(onContinue).toHaveBeenCalledTimes(1)

    const grid = screen.getByLabelText('Sehr tiefe Männerlage Übungen')
    const levelButtons = within(grid).getAllByRole('button')
    fireEvent.click(levelButtons[0])
    expect(onOpenLevel).toHaveBeenCalledWith(0, 0)

    expect(screen.getByRole('button', { name: /Übung 2/ })).toBeDisabled()
  })
})
