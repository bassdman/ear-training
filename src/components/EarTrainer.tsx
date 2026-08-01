import { useEffect, useRef, useState } from 'react'
import { Soundfont } from 'smplr'

import { ActiveSession } from '../features/earTrainer/components/ActiveSession'
import { ProgressPanel } from '../features/earTrainer/components/ProgressPanel'
import { TrainerHeader } from '../features/earTrainer/components/TrainerHeader'
import {
  INSTRUMENTS,
  getOctaveFromMultiplier,
  type NoteName,
  type InstrumentId,
  type ToneStyleId,
} from '../features/earTrainer/config'
import { useEarTrainerGame } from '../features/earTrainer/hooks/useEarTrainerGame'
import '../features/earTrainer/earTrainer.css'

type ToneButtonConfig = {
  id: string
  label: string
  mode: 'start' | 'replay'
}

const TONE_BUTTONS: ToneButtonConfig[] = [
  { id: 'replay', label: 'nochmals anhören', mode: 'replay' },
  { id: 'trial', label: 'Weiter', mode: 'start' },
]

const TONE_STYLE_INSTRUMENT_VARIANTS: Record<InstrumentId, Record<ToneStyleId, string>> = {
  piano: {
    colorA: 'acoustic_grand_piano',
    colorB: 'bright_acoustic_piano',
    colorC: 'electric_piano_1',
    colorD: 'harpsichord',
  },
  guitar: {
    colorA: 'acoustic_guitar_nylon',
    colorB: 'acoustic_guitar_steel',
    colorC: 'electric_guitar_clean',
    colorD: 'electric_guitar_muted',
  },
  flute: {
    colorA: 'flute',
    colorB: 'recorder',
    colorC: 'clarinet',
    colorD: 'oboe',
  },
  organ: {
    colorA: 'church_organ',
    colorB: 'reed_organ',
    colorC: 'accordion',
    colorD: 'harmonica',
  },
}

const SOUNDFONT_INSTRUMENT_LABELS_DE: Record<string, string> = {
  acoustic_grand_piano: 'Akustischer Konzertflügel',
  bright_acoustic_piano: 'Helles Klavier',
  electric_piano_1: 'E-Piano',
  harpsichord: 'Cembalo',
  acoustic_guitar_nylon: 'Konzertgitarre (Nylon)',
  acoustic_guitar_steel: 'Westerngitarre (Stahl)',
  electric_guitar_clean: 'E-Gitarre (Clean)',
  electric_guitar_muted: 'E-Gitarre (Muted)',
  flute: 'Flöte',
  recorder: 'Blockflöte',
  clarinet: 'Klarinette',
  oboe: 'Oboe',
  church_organ: 'Kirchenorgel',
  reed_organ: 'Harmonium',
  accordion: 'Akkordeon',
  harmonica: 'Mundharmonika',
}

const NOTE_TO_SMPLR: Record<NoteName, string> = {
  C: 'C',
  Cis: 'C#',
  D: 'D',
  Dis: 'D#',
  E: 'E',
  F: 'F',
  Fis: 'F#',
  G: 'G',
  Gis: 'G#',
  A: 'A',
  Ais: 'A#',
  H: 'B',
}

function toSmplrNoteName(note: NoteName, frequencyMultiplier: number) {
  const octave = getOctaveFromMultiplier(frequencyMultiplier)
  return `${NOTE_TO_SMPLR[note]}${octave}`
}

type EarTrainerProps = {
  loaded: boolean
  levelIdx: number
  sectionIdx: number
  bestStreak: number
  setLevelIdx: React.Dispatch<React.SetStateAction<number>>
  setSectionIdx: React.Dispatch<React.SetStateAction<number>>
  setBestStreak: React.Dispatch<React.SetStateAction<number>>
  setUnlockedLevelIdx: React.Dispatch<React.SetStateAction<number>>
  rangeLabel: string
  rangeSubtitle: string
  rangeFrequencyMultipliers: number[]
  selectedInstrumentId: InstrumentId
  playbackVolume: number
  setPlaybackVolume: React.Dispatch<React.SetStateAction<number>>
  onBackToCourse: () => void
}

export default function EarTrainer({
  loaded,
  levelIdx,
  sectionIdx,
  bestStreak,
  setLevelIdx,
  setSectionIdx,
  setBestStreak,
  setUnlockedLevelIdx,
  rangeLabel,
  rangeSubtitle,
  rangeFrequencyMultipliers,
  selectedInstrumentId,
  playbackVolume,
  setPlaybackVolume,
  onBackToCourse,
}: EarTrainerProps) {
  const {
    toneSet,
    guessOptions,
    unlockedToneStyles,
    levelProgress,
    levelProgressTotal,
    forcedTrial,
    awaitingGuess,
    feedback,
    leveledUpToast,
    startTrial,
    getCurrentTrial,
    handleGuess,
  } = useEarTrainerGame({
    levelIdx,
    sectionIdx,
    bestStreak,
    progressSetters: {
      setLevelIdx,
      setSectionIdx,
      setBestStreak,
      setUnlockedLevelIdx,
    },
    frequencyMultipliers: rangeFrequencyMultipliers,
  })

  const audioContextRef = useRef<AudioContext | null>(null)
  const instrumentsRef = useRef<Partial<Record<string, ReturnType<typeof Soundfont>>>>({})
  const activeStopRef = useRef<(() => void) | null>(null)
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasAutoStartedRef = useRef(false)
  const [isPlayingByButtonId, setIsPlayingByButtonId] = useState<Record<string, boolean>>({})
  const [isPreparingInstrument, setIsPreparingInstrument] = useState(false)
  const [playbackError, setPlaybackError] = useState<string | null>(null)

  const unlockedToneStyleNames = unlockedToneStyles.map((toneStyleId) => {
    const soundfontId = TONE_STYLE_INSTRUMENT_VARIANTS[selectedInstrumentId][toneStyleId]
    return SOUNDFONT_INSTRUMENT_LABELS_DE[soundfontId] ?? soundfontId
  })

  const clearStopTimer = () => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current)
      stopTimerRef.current = null
    }
  }

  const stopAllTones = () => {
    activeStopRef.current?.()
    activeStopRef.current = null
    clearStopTimer()
    setIsPlayingByButtonId({})
  }

  const ensureAudioContext = async (shouldResume = true) => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new window.AudioContext()
    }

    const audioContext = audioContextRef.current
    if (shouldResume && audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    return audioContext
  }

  const ensureInstrument = async (
    instrumentId: InstrumentId,
    soundfontInstrument: string,
    forceReload = false,
    shouldResumeContext = false,
  ) => {
    const instrumentKey = `${instrumentId}:${soundfontInstrument}`
    const existingInstrument = instrumentsRef.current[instrumentKey]
    if (forceReload && existingInstrument) {
      existingInstrument.dispose()
      delete instrumentsRef.current[instrumentKey]
    }

    const activeInstrument = instrumentsRef.current[instrumentKey]
    if (activeInstrument) {
      await activeInstrument.ready
      return activeInstrument
    }

    const instrumentConfig = INSTRUMENTS[instrumentId]
    if (instrumentConfig.playbackEngine !== 'soundfont') {
      throw new Error(`Instrument ${instrumentId} does not support soundfont playback.`)
    }

    const audioContext = await ensureAudioContext(shouldResumeContext)
    const instrument = Soundfont(audioContext, {
      instrument: soundfontInstrument,
      volume: 100,
      velocity: 95,
    })

    instrumentsRef.current[instrumentKey] = instrument
    await instrument.ready
    return instrument
  }

  const startSoundfontTone = async (
    instrumentId: InstrumentId,
    note: string,
    toneStyleId: ToneStyleId,
  ) => {
    const soundfontInstrument =
      TONE_STYLE_INSTRUMENT_VARIANTS[instrumentId][toneStyleId] ??
      INSTRUMENTS[instrumentId].soundfontInstrument
    const instrument = await ensureInstrument(instrumentId, soundfontInstrument, false, true)

    try {
      return instrument.start({ note, duration: 1 })
    } catch {
      const refreshedInstrument = await ensureInstrument(
        instrumentId,
        soundfontInstrument,
        true,
        true,
      )
      return refreshedInstrument.start({ note, duration: 1 })
    }
  }

  const playTone = async (button: ToneButtonConfig) => {
    if (isPlayingByButtonId[button.id]) return

    stopAllTones()
    setPlaybackError(null)

    const trial =
      button.mode === 'start' ? startTrial() : getCurrentTrial()
    if (!trial) return

    // User interaction path: ensure context is running before triggering playback.
    await ensureAudioContext(true)

    setIsPreparingInstrument(true)

    let stop: (() => void) | null = null
    try {
      const note = toSmplrNoteName(trial.note, trial.frequencyMultiplier)
      stop = await startSoundfontTone(selectedInstrumentId, note, trial.toneStyle)
    } catch {
      setPlaybackError('Instrument konnte nicht gestartet werden. Bitte erneut versuchen.')
      setIsPreparingInstrument(false)
      return
    }

    setIsPreparingInstrument(false)

    setIsPlayingByButtonId((prev) => ({ ...prev, [button.id]: true }))
    activeStopRef.current = stop

    stopTimerRef.current = setTimeout(() => {
      activeStopRef.current?.()
      activeStopRef.current = null
      stopTimerRef.current = null
      setIsPlayingByButtonId((prev) => ({ ...prev, [button.id]: false }))
    }, 1000)
  }

  const playGuessOptionTone = async (
    noteName: NoteName,
    frequencyMultiplier: number,
    toneStyleId: ToneStyleId,
  ) => {
    stopAllTones()
    setPlaybackError(null)

    await ensureAudioContext(true)
    setIsPreparingInstrument(true)

    let stop: (() => void) | null = null
    try {
      const note = toSmplrNoteName(noteName, frequencyMultiplier)
      stop = await startSoundfontTone(selectedInstrumentId, note, toneStyleId)
    } catch {
      setPlaybackError('Instrument konnte nicht gestartet werden. Bitte erneut versuchen.')
      setIsPreparingInstrument(false)
      return
    }

    setIsPreparingInstrument(false)
    activeStopRef.current = stop

    stopTimerRef.current = setTimeout(() => {
      activeStopRef.current?.()
      activeStopRef.current = null
      stopTimerRef.current = null
    }, 1000)
  }

  useEffect(() => {
    if (!loaded || hasAutoStartedRef.current) return

    const trialButton = TONE_BUTTONS.find((entry) => entry.mode === 'start')
    if (!trialButton) return

    hasAutoStartedRef.current = true
    void playTone(trialButton)
  }, [loaded])

  useEffect(() => {
    return () => {
      stopAllTones()
      Object.values(instrumentsRef.current).forEach((instrument) => instrument?.dispose())
      void audioContextRef.current?.close()
      audioContextRef.current = null
      instrumentsRef.current = {}
      activeStopRef.current = null
    }
  }, [])

  return (
    <div className="ear-page">
      {!loaded ? (
        <div className="ear-loading-screen" role="status" aria-live="polite">
          <div className="ear-loading-card">
            <div className="ear-loading-spinner" aria-hidden="true" />
            <div className="ear-loading-title">Lade Fortschritt ...</div>
            <div className="ear-loading-copy">Bitte kurz warten, die Übung wird vorbereitet.</div>
          </div>
        </div>
      ) : (
        <div className="ear-shell">
          <button className="ear-back-button" onClick={onBackToCourse}>
            Zur Kursseite
          </button>

          <TrainerHeader rangeLabel={rangeLabel} rangeSubtitle={rangeSubtitle} />

          <div className="ear-panel ear-audio-panel">
            <div className="ear-audio-row">
              <label>Instrument</label>
              <div className="ear-samples-status">{INSTRUMENTS[selectedInstrumentId].label}</div>
            </div>

            <div className="ear-audio-row">
              <label htmlFor="ear-volume">Lautstärke</label>
              <div className="ear-volume-wrap">
                <input
                  id="ear-volume"
                  type="range"
                  min={0}
                  max={127}
                  step={1}
                  value={playbackVolume}
                  onChange={(event) => setPlaybackVolume(Number(event.target.value))}
                />
                <strong>{playbackVolume}</strong>
              </div>
            </div>
          </div>

          <ProgressPanel
            levelIdx={levelIdx}
            sectionIdx={sectionIdx}
            toneSet={toneSet}
            unlockedToneStyles={unlockedToneStyles}
            unlockedToneStyleNames={unlockedToneStyleNames}
            levelProgress={levelProgress}
            levelProgressTotal={levelProgressTotal}
            leveledUpToast={leveledUpToast}
          />

          <ActiveSession
            buttons={TONE_BUTTONS.map((button) => ({
              ...button,
              isPlaying: Boolean(isPlayingByButtonId[button.id]),
              isReady:
                !isPreparingInstrument &&
                (button.mode === 'start' ? !awaitingGuess : Boolean(getCurrentTrial())),
            }))}
            onPlayTone={(buttonId) => {
              const button = TONE_BUTTONS.find((entry) => entry.id === buttonId)
              if (!button) return
              void playTone(button)
            }}
          />

          {playbackError && (
            <div className="toast ear-feedback is-wrong" role="status" aria-live="polite">
              {playbackError}
            </div>
          )}

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
                  onClick={() => {
                    const activeTrial = getCurrentTrial()
                    const toneStyleId = activeTrial?.toneStyle ?? 'colorA'
                    void playGuessOptionTone(option.note, option.frequencyMultiplier, toneStyleId)
                    handleGuess(option.id)
                  }}
                  disabled={!awaitingGuess}
                  className={`ear-note-button ${stateClass}`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>

          {forcedTrial && (
            <div className="ear-retry">
              Wiederholung: gleicher Tonstil und gleicher Ton wie eben
            </div>
          )}

          {feedback && (
            <div className={`toast ear-feedback ${feedback.correct ? 'is-correct' : 'is-wrong'}`}>
              {feedback.correct
                ? `Richtig · ${feedback.actualLabel}`
                : `Gehört war ${feedback.actualLabel} · geraten: ${feedback.guessedLabel}`}
            </div>
          )}
        </div>
      )}
    </div>
  )
}