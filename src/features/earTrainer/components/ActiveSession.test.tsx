import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ActiveSession } from './ActiveSession'

function createProps() {
  return {
    accuracy: 85,
    forcedTrial: null,
    isPlaying: false,
    awaitingGuess: false,
    hasCurrentTrial: false,
    feedback: null,
    guessOptions: [
      { id: 'C|1', note: 'C', frequencyMultiplier: 1, label: 'c4' },
      { id: 'D|1', note: 'D', frequencyMultiplier: 1, label: 'd4' },
    ],
    onStartTrialPress: vi.fn(),
    onStartTrialRelease: vi.fn(),
    onReplayPress: vi.fn(),
    onReplayRelease: vi.fn(),
    onGuess: vi.fn(),
  } as const
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
    const props = {
      ...createProps(),
      forcedTrial: { note: 'C', toneStyle: 'piano', frequencyMultiplier: 1 },
      feedback: {
        correct: false,
        guessed: 'D',
        actual: 'C',
        guessedFrequencyMultiplier: 1,
        actualFrequencyMultiplier: 1,
        guessedLabel: 'd4',
        actualLabel: 'c4',
        toneStyle: 'piano',
      },
    }

    render(<ActiveSession {...props} />)

    expect(screen.getByText(/Wiederholung:/)).toBeInTheDocument()
    expect(screen.getByText(/Gehört war c4/)).toBeInTheDocument()
  })
})
