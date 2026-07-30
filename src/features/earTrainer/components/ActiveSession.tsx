import { TONE_STYLES, type Feedback, type NoteName, type ToneStyleId } from '../config'

type ActiveSessionProps = {
  accuracy: number | null
  forcedTrial: { note: NoteName; toneStyle: ToneStyleId } | null
  isPlaying: boolean
  awaitingGuess: boolean
  hasCurrentTrial: boolean
  feedback: Feedback | null
  toneSet: readonly NoteName[]
  onStartTrial: () => void
  onReplay: () => void
  onGuess: (note: NoteName) => void
}

export function ActiveSession({
  accuracy,
  forcedTrial,
  isPlaying,
  awaitingGuess,
  hasCurrentTrial,
  feedback,
  toneSet,
  onStartTrial,
  onReplay,
  onGuess,
}: ActiveSessionProps) {
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
            onClick={onStartTrial}
            disabled={awaitingGuess}
            className="ear-button ear-button-primary"
          >
            {feedback || hasCurrentTrial ? 'Weiter' : 'Ton abspielen'}
          </button>
          <button
            onClick={onReplay}
            disabled={!hasCurrentTrial}
            className="ear-button ear-button-secondary"
          >
            Nochmal hören
          </button>
        </div>
      </div>

      <div className="ear-note-grid">
        {toneSet.map((note) => {
          const isCorrect = feedback?.actual === note
          const isWrong = feedback?.guessed === note && !feedback.correct
          const stateClass = isCorrect
            ? 'is-correct'
            : isWrong
              ? 'is-wrong'
              : ''

          return (
            <button
              key={note}
              onClick={() => onGuess(note)}
              disabled={!awaitingGuess}
              className={`ear-note-button ${stateClass}`}
            >
              {note}
            </button>
          )
        })}
      </div>

      {feedback && (
        <div className={`toast ear-feedback ${feedback.correct ? 'is-correct' : 'is-wrong'}`}>
          {feedback.correct
            ? `Richtig · ${feedback.actual} (${TONE_STYLES[feedback.toneStyle].label})`
            : `Gehört war ${feedback.actual} (${TONE_STYLES[feedback.toneStyle].label}) · geraten: ${feedback.guessed}`}
        </div>
      )}
    </>
  )
}
