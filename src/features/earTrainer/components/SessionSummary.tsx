import { LEVEL_COUNT, SECTION_COUNT } from '../config'

type SessionSummaryProps = {
  sessionCorrect: number
  sessionGuesses: number
  accuracy: number | null
  levelIdx: number
  sectionIdx: number
  bestStreak: number
  onNewSession: () => void
}

export function SessionSummary({
  sessionCorrect,
  sessionGuesses,
  accuracy,
  levelIdx,
  sectionIdx,
  bestStreak,
  onNewSession,
}: SessionSummaryProps) {
  return (
    <div className="ear-session-panel">
      <div className="ear-session-title">Session beendet</div>
      <div className="ear-session-copy">
        {sessionCorrect} von {sessionGuesses} richtig ({accuracy}%)
        <br />
        Übung {levelIdx + 1} / {LEVEL_COUNT} · Abschnitt {sectionIdx + 1} / {SECTION_COUNT}
        <br />
        Beste Serie insgesamt: {bestStreak}
      </div>
      <button onClick={onNewSession} className="ear-button ear-button-primary">
        Neue Session starten
      </button>
    </div>
  )
}
