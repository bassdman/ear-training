import type { ListeningPitchState } from '../types'

type LiveTunerProps = {
  listeningPitchState?: ListeningPitchState | null
}

export function LiveTuner({ listeningPitchState }: LiveTunerProps) {
  const currentNote = listeningPitchState?.note ?? '---'
  const currentCents = listeningPitchState?.cents ?? null
  const isInTune = listeningPitchState?.isInTune ?? false

  const clampedCents = currentCents !== null ? Math.max(-50, Math.min(50, currentCents)) : 0
  const needlePositionPercent = currentCents !== null ? ((clampedCents + 50) / 100) * 100 : 50

  return (
    <div className="intonation-live-tuner" role="status" aria-live="polite">
      <div className="intonation-tuner-header">
        <span className={`intonation-tuner-note ${isInTune ? 'is-in-tune' : ''}`}>
          {currentNote}
        </span>
        {currentCents !== null && currentNote !== '---' && (
          <span className={`intonation-tuner-cents ${isInTune ? 'is-in-tune' : 'is-out'}`}>
            {currentCents > 0 ? `+${currentCents}` : currentCents} ct
          </span>
        )}
      </div>
      <div className="intonation-tuner-gauge">
        <div className="intonation-tuner-track">
          <div className="intonation-tuner-target-zone" />
          <div className="intonation-tuner-center-line" />
          <div
            className={`intonation-tuner-needle ${isInTune ? 'is-in-tune' : ''} ${currentNote === '---' ? 'is-silent' : ''}`}
            style={{ left: `${needlePositionPercent}%` }}
          />
        </div>
      </div>
    </div>
  )
}
