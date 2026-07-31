import type { KeyboardEvent } from 'react'

import {
  TONE_STYLES,
  type Feedback,
  type GuessOption,
  type NoteName,
  type ToneStyleId,
} from '../config'

type ActiveSessionProps = {
  accuracy: number | null
  forcedTrial: {
    note: NoteName
    toneStyle: ToneStyleId
    frequencyMultiplier: number
  } | null
  isPlaying: boolean
  awaitingGuess: boolean
  hasCurrentTrial: boolean
  feedback: Feedback | null
  guessOptions: GuessOption[]
  onStartTrialPress: () => void
  onStartTrialRelease: () => void
  onReplayPress: () => void
  onReplayRelease: () => void
  onGuess: (guessOptionId: string) => void
}

export function ActiveSession({
  accuracy,
  forcedTrial,
  isPlaying,
  awaitingGuess,
  hasCurrentTrial,
  feedback,
  guessOptions,
  onStartTrialPress,
  onStartTrialRelease,
  onReplayPress,
  onReplayRelease,
  onGuess,
}: ActiveSessionProps) {
  const holdHandlers = (onPress: () => void, onRelease: () => void) => ({
    onPointerDown: () => onPress(),
    onPointerUp: () => onRelease(),
    onPointerCancel: () => onRelease(),
    onPointerLeave: () => onRelease(),
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.repeat) return
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        onPress()
      }
    },
    onKeyUp: (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        onRelease()
      }
    },
  })

  return (
    <>
      <div className="ear-stats">
        {accuracy !== null && <span>Trefferquote: {accuracy}%</span>}
      </div>

      {forcedTrial && (
        <div className="ear-retry">
          Wiederholung: gleicher Tonstil und gleicher Ton wie eben
        </div>
      )}

      <div className="ear-player">
        <div className="ear-ring-wrap">
          {isPlaying && <div className="ear-ring" />}
          <div className={`ear-dot ${isPlaying ? 'is-playing' : ''}`} />
        </div>

        <div className="ear-actions">
          <button
            disabled={awaitingGuess && !isPlaying}
            className="ear-button ear-button-primary"
            {...holdHandlers(onStartTrialPress, onStartTrialRelease)}
          >
            {feedback || hasCurrentTrial ? 'Weiter' : 'Ton abspielen'}
          </button>
          <button
            disabled={!hasCurrentTrial}
            className="ear-button ear-button-secondary"
            {...holdHandlers(onReplayPress, onReplayRelease)}
          >
            Nochmal hören
          </button>
        </div>
      </div>

      <div className="ear-note-grid">
        {guessOptions.map((option) => {
          const isCorrect =
            feedback?.actual === option.note &&
            feedback?.actualFrequencyMultiplier === option.frequencyMultiplier
          const isWrong =
            feedback?.guessed === option.note &&
            feedback?.guessedFrequencyMultiplier === option.frequencyMultiplier &&
            !feedback.correct
          const stateClass = isCorrect
            ? 'is-correct'
            : isWrong
              ? 'is-wrong'
              : ''

          return (
            <button
              key={option.id}
              onClick={() => onGuess(option.id)}
              disabled={!awaitingGuess}
              className={`ear-note-button ${stateClass}`}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      {feedback && (
        <div className={`toast ear-feedback ${feedback.correct ? 'is-correct' : 'is-wrong'}`}>
          {feedback.correct
            ? `Richtig · ${feedback.actualLabel} (${TONE_STYLES[feedback.toneStyle].label})`
            : `Gehört war ${feedback.actualLabel} (${TONE_STYLES[feedback.toneStyle].label}) · geraten: ${feedback.guessedLabel}`}
        </div>
      )}
    </>
  )
}
