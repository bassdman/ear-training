import { useEffect, useRef, useState } from 'react'

import { DEFAULT_TUNER_SETTINGS, validateTunerSettings, type TunerSettings } from '../settings'

type Props = {
  settings: TunerSettings
  onChange: (settings: TunerSettings) => void
  onClose: () => void
  storageError: string | null
}

type Field = {
  key: keyof TunerSettings
  label: string
  hint: string
  min: number
  max: number
  step: number | 'any'
}

const fields: Field[] = [
  { key: 'minVolumeRms', label: 'Mindestlautstärke (RMS)', hint: '0 bis 1. Kleiner erkennt leisere Töne, aber auch mehr Hintergrundgeräusche.', min: 0, max: 1, step: 'any' },
  { key: 'minPitchClarity', label: 'Mindestklarheit', hint: '0 bis 1. Kleiner akzeptiert unklarere Töne, erhöht aber das Risiko falscher Treffer.', min: 0, max: 1, step: 'any' },
  { key: 'minFrequencyHz', label: 'Tiefste Frequenz (Hz)', hint: 'Größer als 0 und kleiner als die höchste Frequenz.', min: 0, max: 24000, step: 'any' },
  { key: 'maxFrequencyHz', label: 'Höchste Frequenz (Hz)', hint: 'Größer als die tiefste Frequenz, höchstens 24000 Hz.', min: 0, max: 24000, step: 'any' },
  { key: 'analysisIntervalMs', label: 'Analyseintervall (ms)', hint: '1 bis 600000 ms. Kleiner aktualisiert häufiger, benötigt aber mehr Rechenleistung.', min: 1, max: 600000, step: 1 },
  { key: 'maxSampleGapMs', label: 'Maximaler Messabstand (ms)', hint: 'Größer als das Analyseintervall, höchstens 600000 ms. Längere Unterbrechungen erzeugen eine Lücke.', min: 1, max: 600000, step: 1 },
  { key: 'windowMs', label: 'Sichtbarer Verlauf (ms)', hint: '1 bis 600000 ms. Bereits verworfene ältere Messwerte können nicht wiederhergestellt werden.', min: 1, max: 600000, step: 1 },
  { key: 'octaveSkipFrames', label: 'Große Tonsprünge: Frames überspringen', hint: '0 bis 100. Bei Sprüngen ab 10 Halbtönen werden so viele aufeinanderfolgende Messungen ausgelassen; 0 deaktiviert den Filter. Gilt für Mikrofon und Vocal-Referenz.', min: 0, max: 100, step: 1 },
]

function strings(settings: TunerSettings): Record<keyof TunerSettings, string> {
  return {
    minVolumeRms: String(settings.minVolumeRms),
    minPitchClarity: String(settings.minPitchClarity),
    minFrequencyHz: String(settings.minFrequencyHz),
    maxFrequencyHz: String(settings.maxFrequencyHz),
    analysisFftSize: String(settings.analysisFftSize),
    analysisIntervalMs: String(settings.analysisIntervalMs),
    maxSampleGapMs: String(settings.maxSampleGapMs),
    windowMs: String(settings.windowMs),
    octaveSkipFrames: String(settings.octaveSkipFrames),
  }
}

export function TunerSettingsPanel({ settings, onChange, onClose, storageError }: Props) {
  const [draft, setDraft] = useState(() => strings(settings))
  const [error, setError] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  const change = (key: keyof TunerSettings, value: string) => {
    const nextDraft = { ...draft, [key]: value }
    setDraft(nextDraft)
    if (Object.values(nextDraft).some((entry) => entry.trim() === '')) {
      setError('Bitte alle Einstellungen ausfüllen.')
      return
    }
    const next = {
      minVolumeRms: Number(nextDraft.minVolumeRms),
      minPitchClarity: Number(nextDraft.minPitchClarity),
      minFrequencyHz: Number(nextDraft.minFrequencyHz),
      maxFrequencyHz: Number(nextDraft.maxFrequencyHz),
      analysisFftSize: Number(nextDraft.analysisFftSize),
      analysisIntervalMs: Number(nextDraft.analysisIntervalMs),
      maxSampleGapMs: Number(nextDraft.maxSampleGapMs),
      windowMs: Number(nextDraft.windowMs),
      octaveSkipFrames: Number(nextDraft.octaveSkipFrames),
    }
    const validationError = validateTunerSettings(next)
    setError(validationError)
    if (!validationError) onChange(next)
  }

  const reset = () => {
    const defaults = { ...DEFAULT_TUNER_SETTINGS }
    setDraft(strings(defaults))
    setError(null)
    onChange(defaults)
  }

  return (
    <div className="tuner-settings-backdrop" onClick={onClose}>
      <div
        ref={panelRef}
        className="tuner-settings"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tuner-settings-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onClose()
          } else if (event.key === 'Tab') {
            const focusable = panelRef.current?.querySelectorAll<HTMLElement>('button, input, select')
            if (!focusable?.length) return
            const first = focusable[0]
            const last = focusable[focusable.length - 1]
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault()
              last.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault()
              first.focus()
            }
          }
        }}
      >
        <div className="tuner-settings-header">
          <h2 id="tuner-settings-title">Einstellungen</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Einstellungen schließen">×</button>
        </div>
            {storageError && <p className="tuner-settings-error" role="alert">{storageError}</p>}
        {error && <p className="tuner-settings-error" role="alert">{error} Ungültige Änderungen werden nicht übernommen.</p>}
        <div className="tuner-settings-fields">
          {fields.map((field) => (
            <label key={field.key}>
              <span>{field.label}</span>
              <small id={`tuner-setting-${field.key}-hint`}>{field.hint}</small>
              <input
                type="number" min={field.min} max={field.max} step={field.step}
                aria-label={field.label}
                aria-describedby={`tuner-setting-${field.key}-hint`}
                value={draft[field.key]}
                onChange={(event) => change(field.key, event.target.value)}
              />
            </label>
          ))}
          <label>
            <span>Analysefenster (Samples)</span>
            <small id="tuner-setting-fft-hint">Zweierpotenz von 32 bis 32768. Größer hilft bei tiefen Tönen, erhöht aber Verzögerung und Rechenaufwand.</small>
            <select aria-label="Analysefenster (Samples)" aria-describedby="tuner-setting-fft-hint" value={draft.analysisFftSize} onChange={(event) => change('analysisFftSize', event.target.value)}>
              {Array.from({ length: 11 }, (_, index) => 2 ** (index + 5)).map((size) =>
                <option key={size} value={size}>{size}</option>,
              )}
            </select>
          </label>
        </div>
        <button type="button" className="tuner-settings-reset" onClick={reset}>Standardwerte wiederherstellen</button>
      </div>
    </div>
  )
}
