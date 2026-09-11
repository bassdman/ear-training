import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Soundfont } from 'smplr'

import { INSTRUMENTS, type InstrumentId } from '../../features/earTrainer/config'

import './intonationTrainingPage.css'

const ASSETS_URL = 'http://intonation.manuelgelsen.de/assets'
const possibleNotes = [
  'c2-disabled', 'cis2-disabled', 'd2-disabled', 'dis2-disabled', 'e2-disabled', 'f2-disabled', 'fis2', 'g2', 'gis2', 'a2', 'ais2', 'h2',
  'c3', 'cis3', 'd3', 'dis3', 'e3', 'f3', 'fis3', 'g3', 'gis3', 'a3', 'ais3', 'h3',
  'c4', 'cis4', 'd4', 'dis4', 'e4', 'f4', 'fis4', 'g4', 'gis4', 'a4', 'ais4', 'h4',
  'c5', 'cis5', 'd5', 'dis5', 'e5', 'f5-disabled', 'fis5-disabled', 'g5-disabled', 'gis5-disabled', 'a5-disabled', 'ais5-disabled', 'h5-disabled'
]

const noteLabels = ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis', 'A', 'Ais', 'H']
const noteNames = ['c', 'cis', 'd', 'dis', 'e', 'f', 'fis', 'g', 'gis', 'a', 'ais', 'h']
const blackKeys = [false, true, false, true, false, false, true, false, true, false, true, false]
const PITCH_TOLERANCE_CENTS = 50
const REQUIRED_STABLE_SAMPLES = 8
const REFERENCE_TONE_DURATION_MS = 900
const INTONATION_SETTINGS_STORAGE_KEY = 'ear-training-intonation-settings-v1'

const INTONATION_INSTRUMENT_OPTIONS: { id: 'none' | 'random' | InstrumentId, label: string }[] = [
  { id: 'none', label: 'Keines' },
  { id: 'random', label: 'Zufällig' },
  { id: 'piano', label: 'Klavier' },
  { id: 'guitar', label: 'Gitarre' },
  { id: 'flute', label: 'Flöte' },
  { id: 'organ', label: 'Orgel' },
]

type IntonationInstrumentId = typeof INTONATION_INSTRUMENT_OPTIONS[number]['id']

type IntonationSettings = {
  microphoneEnabled: boolean
  selectedInstrumentId: IntonationInstrumentId
}

type PitchResult = {
  detectedNote: string
  cents: number
  isInTune: boolean
}

function getNoteConfig(noteId: string) {
  const normalizedNoteId = noteId.replace(/-disabled$/, '')
  const match = normalizedNoteId.match(/^(c(?:is)?|d(?:is)?|e|f(?:is)?|g(?:is)?|a(?:is)?|h)(\d+)$/)
  if (!match) return { note: '', octave: 0, disabled: false }

  return {
    note: match[1],
    octave: Number(match[2]),
    disabled: noteId.endsWith('-disabled'),
  }
}

type ActiveNote = string | null

export function readIntonationSettings(): IntonationSettings {
  const defaultSettings: IntonationSettings = {
    microphoneEnabled: false,
    selectedInstrumentId: 'none',
  }

  try {
    const storedValue = window.localStorage.getItem(INTONATION_SETTINGS_STORAGE_KEY)
    if (!storedValue) return defaultSettings

    const storedSettings = JSON.parse(storedValue) as Partial<IntonationSettings>
    const isValidInstrument = INTONATION_INSTRUMENT_OPTIONS.some(
      (instrument) => instrument.id === storedSettings.selectedInstrumentId,
    )

    return {
      microphoneEnabled: storedSettings.microphoneEnabled === true,
      selectedInstrumentId: isValidInstrument ? storedSettings.selectedInstrumentId! : 'none',
    }
  } catch {
    return defaultSettings
  }
}

export function getPitchResult(frequency: number, targetNoteId: string): PitchResult | null {
  const target = getNoteConfig(targetNoteId)
  const targetNoteIndex = noteNames.indexOf(target.note)
  if (!Number.isFinite(frequency) || frequency <= 0 || targetNoteIndex === -1) return null

  const detectedMidi = Math.round(69 + 12 * Math.log2(frequency / 440))
  const targetMidi = (target.octave + 1) * 12 + targetNoteIndex
  const detectedFrequency = 440 * 2 ** ((detectedMidi - 69) / 12)
  const cents = Math.round(1200 * Math.log2(frequency / detectedFrequency)) || 0
  const detectedNoteIndex = ((detectedMidi % 12) + 12) % 12
  const detectedOctave = Math.floor(detectedMidi / 12) - 1

  return {
    detectedNote: `${noteLabels[detectedNoteIndex]}${detectedOctave}`,
    cents,
    isInTune: Math.abs(1200 * Math.log2(frequency / (440 * 2 ** ((targetMidi - 69) / 12)))) <= PITCH_TOLERANCE_CENTS,
  }
}

export function getMicrophoneErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Der Mikrofonzugriff wurde blockiert. Erlaube Safari den Zugriff auf das Mikrofon für diese Website.'
  }

  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return 'Es wurde kein Mikrofon gefunden.'
  }

  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    return 'Das Mikrofon benötigt eine sichere HTTPS-Verbindung. Öffne die Seite nicht über http://.'
  }

  return 'Das Mikrofon konnte nicht verwendet werden. Versuche es erneut.'
}

function detectPitch(samples: Float32Array, sampleRate: number): number | null {
  let rms = 0
  for (const sample of samples) rms += sample * sample
  if (Math.sqrt(rms / samples.length) < 0.015) return null

  const minimumLag = Math.floor(sampleRate / 1000)
  const maximumLag = Math.floor(sampleRate / 70)
  let bestLag = -1
  let bestCorrelation = 0

  for (let lag = minimumLag; lag <= maximumLag; lag += 1) {
    let correlation = 0
    let firstEnergy = 0
    let delayedEnergy = 0
    for (let index = 0; index < samples.length - lag; index += 1) {
      correlation += samples[index] * samples[index + lag]
      firstEnergy += samples[index] * samples[index]
      delayedEnergy += samples[index + lag] * samples[index + lag]
    }
    const normalizedCorrelation = correlation / Math.sqrt(firstEnergy * delayedEnergy)
    if (normalizedCorrelation > bestCorrelation) {
      bestCorrelation = normalizedCorrelation
      bestLag = lag
    }
  }

  return bestLag === -1 || bestCorrelation < 0.75 ? null : sampleRate / bestLag
}

export function IntonationTrainingPage() {
  const navigate = useNavigate()
  const [activeNote, setActiveNote] = useState<ActiveNote>(null)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [settings, setSettings] = useState<IntonationSettings>(readIntonationSettings)
  const [listeningNote, setListeningNote] = useState<ActiveNote>(null)
  const [pitchResult, setPitchResult] = useState<{ noteId: string, result: PitchResult } | null>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const activeTimerRef = useRef<number | null>(null)
  const referenceAudioTimerRef = useRef<number | null>(null)
  const microphoneTimerRef = useRef<number | null>(null)
  const instrumentAudioContextRef = useRef<AudioContext | null>(null)
  const instrumentsRef = useRef<Partial<Record<InstrumentId, ReturnType<typeof Soundfont>>>>({})
  const activeInstrumentStopRef = useRef<(() => void) | null>(null)
  const microphoneStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const octaves = [...new Set(possibleNotes.map((noteId) => getNoteConfig(noteId).octave))].sort((a, b) => a - b)
  const { microphoneEnabled, selectedInstrumentId } = settings

  const getReferenceInstrumentId = (): InstrumentId | null => {
    if (selectedInstrumentId === 'none') return null
    if (selectedInstrumentId !== 'random') return selectedInstrumentId

    const instrumentIds = Object.keys(INSTRUMENTS) as InstrumentId[]
    return instrumentIds[Math.floor(Math.random() * instrumentIds.length)]
  }

  const playNote = async (noteId: string) => {
    const noteConfig = getNoteConfig(noteId)
    if (noteConfig.disabled) return

    currentAudioRef.current?.pause()
    activeInstrumentStopRef.current?.()
    if (activeTimerRef.current !== null) window.clearTimeout(activeTimerRef.current)
    if (referenceAudioTimerRef.current !== null) window.clearTimeout(referenceAudioTimerRef.current)
    if (microphoneTimerRef.current !== null) window.clearTimeout(microphoneTimerRef.current)

    const referenceInstrumentId = getReferenceInstrumentId()
    const noteIndex = noteNames.indexOf(noteConfig.note)
    const audioPath = `${ASSETS_URL}/sounds/${noteConfig.octave}${noteConfig.note}.mp3`
    const audio = new Audio(audioPath)
    const microphoneRequest = microphoneEnabled && window.isSecureContext && navigator.mediaDevices?.getUserMedia
      ? navigator.mediaDevices.getUserMedia({ audio: true })
      : undefined
    currentAudioRef.current = audio
    audio.preload = 'auto'
    audio.addEventListener('error', () => {
      if (currentAudioRef.current !== audio) return
      setAudioError(`Die Audiodatei ${audioPath} konnte nicht geladen werden.`)
      setActiveNote(null)
    }, { once: true })
    setAudioError(null)
    setActiveNote(noteId)

    if (referenceInstrumentId) {
      // Keep the HTML audio user-gesture authorized for Safari until it is audible.
      audio.volume = 0
      void audio.play()

      try {
        if (!instrumentAudioContextRef.current || instrumentAudioContextRef.current.state === 'closed') {
          instrumentAudioContextRef.current = new AudioContext()
        }
        const audioContext = instrumentAudioContextRef.current
        if (audioContext.state === 'suspended') await audioContext.resume()

        let instrument = instrumentsRef.current[referenceInstrumentId]
        if (!instrument) {
          instrument = Soundfont(audioContext, {
            instrument: INSTRUMENTS[referenceInstrumentId].soundfontInstrument,
            volume: 100,
            velocity: 95,
          })
          instrumentsRef.current[referenceInstrumentId] = instrument
          await instrument.ready
        }
        activeInstrumentStopRef.current = instrument.start({
          note: `${noteLabels[noteIndex].replace('is', '#').replace('H', 'B')}${noteConfig.octave}`,
          duration: REFERENCE_TONE_DURATION_MS / 1000,
        })
      } catch {
        setAudioError('Das Referenzinstrument konnte nicht geladen werden.')
        setActiveNote(null)
        return
      }

      referenceAudioTimerRef.current = window.setTimeout(() => {
        if (currentAudioRef.current !== audio) return
        audio.currentTime = 0
        audio.volume = 1
      }, REFERENCE_TONE_DURATION_MS)
    } else {
      audio.currentTime = 0
      void audio.play().catch(() => {
        if (currentAudioRef.current !== audio) return
        setAudioError(`Die Audiodatei ${audioPath} kann dieser Browser nicht abspielen.`)
        setActiveNote(null)
      })
    }

    const totalReferenceDuration = referenceInstrumentId
      ? REFERENCE_TONE_DURATION_MS * 2
      : REFERENCE_TONE_DURATION_MS
    activeTimerRef.current = window.setTimeout(() => setActiveNote(null), totalReferenceDuration)
    if (microphoneEnabled) {
      microphoneTimerRef.current = window.setTimeout(
        () => void startListening(noteId, microphoneRequest),
        totalReferenceDuration,
      )
    }
  }

  const stopListening = () => {
    if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current)
    microphoneStreamRef.current?.getTracks().forEach((track) => track.stop())
    void audioContextRef.current?.close()
    microphoneStreamRef.current = null
    audioContextRef.current = null
    animationFrameRef.current = null
    setListeningNote(null)
  }

  const startListening = async (noteId: string, microphoneRequest?: Promise<MediaStream>) => {
    stopListening()
    setPitchResult(null)

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setAudioError(getMicrophoneErrorMessage(null))
      return
    }

    try {
      const stream = microphoneRequest
        ? await microphoneRequest
        : await navigator.mediaDevices.getUserMedia({ audio: true })
      const audioContext = new AudioContext()
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 2048
      audioContext.createMediaStreamSource(stream).connect(analyser)
      const samples = new Float32Array(analyser.fftSize)
      const stableFrequencies: number[] = []

      microphoneStreamRef.current = stream
      audioContextRef.current = audioContext
      setListeningNote(noteId)

      const analyse = () => {
        analyser.getFloatTimeDomainData(samples)
        const frequency = detectPitch(samples, audioContext.sampleRate)
        if (frequency !== null) {
          stableFrequencies.push(frequency)
          if (stableFrequencies.length > REQUIRED_STABLE_SAMPLES) stableFrequencies.shift()
          const lowestFrequency = Math.min(...stableFrequencies)
          const highestFrequency = Math.max(...stableFrequencies)
          const spreadInCents = 1200 * Math.log2(highestFrequency / lowestFrequency)

          if (stableFrequencies.length === REQUIRED_STABLE_SAMPLES && spreadInCents < 15) {
            const averageFrequency = stableFrequencies.reduce((sum, value) => sum + value, 0) / stableFrequencies.length
            const result = getPitchResult(averageFrequency, noteId)
            if (result) setPitchResult({ noteId, result })
            stopListening()
            return
          }
        } else {
          stableFrequencies.length = 0
        }
        animationFrameRef.current = window.requestAnimationFrame(analyse)
      }

      animationFrameRef.current = window.requestAnimationFrame(analyse)
    } catch (error) {
      setAudioError(getMicrophoneErrorMessage(error))
      stopListening()
    }
  }

  const toggleMicrophone = () => {
    if (microphoneEnabled) stopListening()
    setSettings((currentSettings) => ({
      ...currentSettings,
      microphoneEnabled: !currentSettings.microphoneEnabled,
    }))
  }

  const selectInstrument = (instrumentId: IntonationInstrumentId) => {
    setSettings((currentSettings) => ({
      ...currentSettings,
      selectedInstrumentId: instrumentId,
    }))
  }

  useEffect(() => {
    window.localStorage.setItem(INTONATION_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => () => {
    currentAudioRef.current?.pause()
    activeInstrumentStopRef.current?.()
    Object.values(instrumentsRef.current).forEach((instrument) => instrument?.dispose())
    void instrumentAudioContextRef.current?.close()
    if (activeTimerRef.current !== null) window.clearTimeout(activeTimerRef.current)
    if (referenceAudioTimerRef.current !== null) window.clearTimeout(referenceAudioTimerRef.current)
    if (microphoneTimerRef.current !== null) window.clearTimeout(microphoneTimerRef.current)
    stopListening()
  }, [])

  return (
    <main className="intonation-page">
      <div className="intonation-shell">
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
                onChange={(event) => selectInstrument(event.target.value as IntonationInstrumentId)}
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
                onChange={toggleMicrophone}
              />
              <span className="intonation-toggle-track" aria-hidden="true" />
            </label>
          </div>
          {audioError && <p className="intonation-audio-error" role="alert">{audioError}</p>}
        </header>

        <section className="intonation-octaves" aria-label="Noten nach Oktave">
          {octaves.map((octave) => {
            const octaveNotes = possibleNotes.filter((noteId) => getNoteConfig(noteId).octave === octave)

            return (
              <section className="intonation-octave" key={octave}>
                <h2>Oktave {octave}</h2>
                <div className="intonation-notes">
                  {octaveNotes.map((noteId) => {
                    const noteConfig = getNoteConfig(noteId)
                    const noteIndex = noteNames.indexOf(noteConfig.note)
                    const isActive = activeNote === noteId
                    const isListening = listeningNote === noteId
                    const result = pitchResult?.noteId === noteId ? pitchResult.result : null

                    return (
                      <div className="intonation-note-group" key={noteId}>
                        <button
                          className={`intonation-note ${blackKeys[noteIndex] ? 'is-black' : ''} ${isActive ? 'is-active' : ''}`}
                          disabled={noteConfig.disabled}
                          onClick={() => playNote(noteId)}
                        >
                          {noteLabels[noteIndex]}{octave}
                        </button>
                        {microphoneEnabled && !noteConfig.disabled && (
                          <button
                            className={`intonation-microphone ${isListening ? 'is-listening' : ''}`}
                            onClick={() => isListening ? stopListening() : void startListening(noteId)}
                            aria-label={`${isListening ? 'Mikrofon stoppen für' : 'Mikrofon starten für'} ${noteLabels[noteIndex]}${octave}`}
                          >
                            {isListening ? 'Stopp' : 'Mikrofon'}
                          </button>
                        )}
                        {isListening && <p className="intonation-listening">Höre zu ...</p>}
                        {result && (
                          <p className={`intonation-pitch-result ${result.isInTune ? 'is-in-tune' : 'is-out-of-tune'}`} role="status">
                            {result.isInTune
                              ? `Richtig (${result.cents > 0 ? '+' : ''}${result.cents} Cent)`
                              : `Daneben. Das war ${result.detectedNote}.`}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </section>
      </div>
    </main>
  )
}