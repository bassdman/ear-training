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
  const message = pending ? 'Mikrofon wird gestartet …'
    : active ? frequency === null ? 'Mikrofon aktiv – kein Ton erkannt' : 'Mikrofon aktiv – Ton erkannt'
      : status === 'error' ? 'Mikrofon nicht aktiv'
        : 'Mikrofon aus'

  return (
    <main className="tuner-page">
      <div className="tuner-shell">
        <Link className="tuner-back" to="/">← Zur Startseite</Link>
        <header className="tuner-header">
          <p>EAR TRAINING</p>
          <h1>Stimm-Tuner</h1>
          <p>Sieh, wie sich deine Stimme über die Zeit bewegt.</p>
        </header>
        <div className="tuner-controls">
          {active || pending ? (
            <button type="button" className="tuner-primary" onClick={stop}>Mikrofon stoppen</button>
          ) : (
            <button type="button" className="tuner-primary" onClick={() => void start()}>Mikrofon starten</button>
          )}
        </div>
        <p className="tuner-status" role="status">{message}</p>
        {error && <p className="tuner-error" role="alert">{error}</p>}
        <TunerDisplay points={points} timeMs={timeMs} active={active} span={span} />
      </div>
    </main>
  )
}
