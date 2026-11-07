import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { TunerDisplay } from '../../features/tuner/components/TunerDisplay'
import { useLiveTuner } from '../../features/tuner/hooks/useLiveTuner'
import './tunerPage.css'

function usePitchSpan() {
  const [span, setSpan] = useState(() => window.innerWidth <= 600 ? 18 : 24)
  useEffect(() => {
    const update = () => setSpan(window.innerWidth <= 600 ? 18 : 24)
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return span
}

export function TunerPage() {
  const { status, error, points, timeMs, start, stop } = useLiveTuner()
  const span = usePitchSpan()
  const active = status === 'listening'
  const pending = status === 'starting'
  const frequency = points.at(-1)?.frequency ?? null
  const microphoneLabel = pending ? 'Mikrofonstart abbrechen'
    : active ? 'Mikrofon stoppen' : 'Mikrofon starten'
  const message = pending ? 'Mikrofon wird gestartet …'
    : active ? frequency === null ? 'Mikrofon aktiv – kein Ton erkannt' : 'Mikrofon aktiv – Ton erkannt'
      : status === 'error' ? 'Mikrofon nicht aktiv'
        : 'Mikrofon aus'

  return (
    <main className="tuner-page">
      <div className="tuner-shell">
        <Link className="tuner-back" to="/" aria-label="Zur Startseite">←</Link>
        <p className="tuner-status" role="status">{message}</p>
        {error && <p className="tuner-error" role="alert">{error}</p>}
        <TunerDisplay points={points} timeMs={timeMs} active={active} span={span} />
      </div>
      <div className="tuner-toolbar" role="toolbar" aria-label="Mikrofonsteuerung">
        <button
          type="button"
          className={`tuner-microphone${active ? ' is-active' : ''}${pending ? ' is-pending' : ''}`}
          aria-label={microphoneLabel}
          title={microphoneLabel}
          onClick={active || pending ? stop : () => void start()}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <path d="M12 19v3" />
            {!active && !pending && <path d="M3 3l18 18" />}
          </svg>
        </button>
      </div>
    </main>
  )
}
