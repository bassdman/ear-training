import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ActiveSession } from './ActiveSession'
import type { Feedback, GuessOption, NoteName, ToneStyleId } from '../config'

function createProps() {
  const guessOptions: GuessOption[] = [
    { id: 'C|1', note: 'C' as NoteName, frequencyMultiplier: 1, label: 'c4' },
    { id: 'D|1', note: 'D' as NoteName, frequencyMultiplier: 1, label: 'd4' },
  ]

  return {
    accuracy: 85,
    forcedTrial: null,
    isPlaying: false,
    awaitingGuess: false,
    hasCurrentTrial: false,
    feedback: null,
    guessOptions,
    onStartTrialPress: vi.fn(),
    onStartTrialRelease: vi.fn(),
    onReplayPress: vi.fn(),
    onReplayRelease: vi.fn(),
    onGuess: vi.fn(),
  }
}

describe('ActiveSession', () => {
  it('triggert Hold-Events auf Startbutton (Pointer + Tastatur)', () => {
    const props = createProps()
    render(<ActiveSession {...props} />)

    const startButton = screen.getByRole('button', { name: 'Ton abspielen' })
    fireEvent.pointerDown(startButton)
    fireEvent.pointerUp(startButton)
    fireEvent.keyDown(startButton, { key: 'Enter' })
    fireEvent.keyUp(startButton, { key: 'Enter' })

    expect(props.onStartTrialPress).toHaveBeenCalledTimes(2)
    expect(props.onStartTrialRelease).toHaveBeenCalledTimes(2)
  })

  it('aktiviert Guess-Buttons nur beim Raten und meldet Auswahl', () => {
    const onGuess = vi.fn()
    const props = { ...createProps(), awaitingGuess: true, hasCurrentTrial: true, onGuess }
    render(<ActiveSession {...props} />)

    const guessButton = screen.getByRole('button', { name: 'c4' })
    expect(guessButton).toBeEnabled()
    fireEvent.click(guessButton)
    expect(onGuess).toHaveBeenCalledWith('C|1')
  })

  it('zeigt Feedback und Wiederholungs-Hinweis', () => {
    const feedback: Feedback = {
      correct: false,
      guessed: 'D',
      actual: 'C',
      guessedFrequencyMultiplier: 1,
      actualFrequencyMultiplier: 1,
      guessedLabel: 'd4',
      actualLabel: 'c4',
      toneStyle: 'colorA' as ToneStyleId,
    }

    const props = {
      ...createProps(),
      forcedTrial: {
        note: 'C' as NoteName,
        toneStyle: 'colorA' as ToneStyleId,
        frequencyMultiplier: 1,
      },
      feedback,
    }

    render(<ActiveSession {...props} />)

    expect(screen.getByText(/Wiederholung:/)).toBeInTheDocument()
    expect(screen.getByText(/Gehört war c4/)).toBeInTheDocument()
  })
})
