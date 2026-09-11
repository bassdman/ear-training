import { useNavigate } from 'react-router-dom'

import { INTONATION_INSTRUMENT_OPTIONS } from '../config'
import type { IntonationInstrumentId } from '../types'

type IntonationHeaderProps = {
  selectedInstrumentId: IntonationInstrumentId
  microphoneEnabled: boolean
  audioError: string | null
  onSelectInstrument: (instrumentId: IntonationInstrumentId) => void
  onToggleMicrophone: () => void
}

export function IntonationHeader({
  selectedInstrumentId,
  microphoneEnabled,
  audioError,
  onSelectInstrument,
  onToggleMicrophone,
}: IntonationHeaderProps) {
  const navigate = useNavigate()

  return (
    <header className="intonation-header">
      <button className="intonation-back" onClick={() => navigate('/')}>
        Zur Startseite
      </button>
      <p className="intonation-kicker">Freies Training</p>
      <h1>Intonationstraining</h1>
      <p className="intonation-subtitle">
        Spiele einzelne Töne in verschiedenen Lagen und überprüfe deine Intonation.
      </p>
      <div className="intonation-controls">
        <label className="intonation-instrument-select">
          <span>Referenzinstrument</span>
          <select
            value={selectedInstrumentId}
            onChange={(event) => onSelectInstrument(event.target.value as IntonationInstrumentId)}
          >
            {INTONATION_INSTRUMENT_OPTIONS.map((instrument) => (
              <option key={instrument.id} value={instrument.id}>{instrument.label}</option>
            ))}
          </select>
        </label>
        <label className="intonation-microphone-toggle">
          <span>Mikrofonprüfung</span>
          <input
            type="checkbox"
            checked={microphoneEnabled}
            onChange={onToggleMicrophone}
          />
          <span className="intonation-toggle-track" aria-hidden="true" />
        </label>
      </div>
      {audioError && <p className="intonation-audio-error" role="alert">{audioError}</p>}
    </header>
  )
}
