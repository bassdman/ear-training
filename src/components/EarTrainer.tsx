import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Soundfont } from 'smplr'

import { ActiveSession } from '../features/earTrainer/components/ActiveSession'
import { ProgressPanel } from '../features/earTrainer/components/ProgressPanel'
import { TrainerHeader } from '../features/earTrainer/components/TrainerHeader'
import {
  INSTRUMENTS,
  getOctaveFromMultiplier,
  type NoteName,
  type InstrumentId,
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
  const instrumentsRef = useRef<Partial<Record<InstrumentId, ReturnType<typeof Soundfont>>>>({})
  const activeStopRef = useRef<(() => void) | null>(null)
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isPlayingByButtonId, setIsPlayingByButtonId] = useState<Record<string, boolean>>({})

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

  const ensureInstrument = async (instrumentId: InstrumentId) => {
    const existingInstrument = instrumentsRef.current[instrumentId]
    if (existingInstrument) {
      await existingInstrument.ready
      return existingInstrument
    }

    const audioContext = await ensureAudioContext(false)
    const instrumentConfig = INSTRUMENTS[instrumentId]
    if (instrumentConfig.playbackEngine !== 'soundfont') {
      throw new Error(`Instrument ${instrumentId} uses no soundfont playback.`)
    }
    const instrument = Soundfont(audioContext, {
      instrument: instrumentConfig.soundfontInstrument,
      volume: 100,
      velocity: 95,
    })

    instrumentsRef.current[instrumentId] = instrument
    await instrument.ready
    return instrument
  }

  const instrumentQuery = useQuery({
    queryKey: ['ear-instrument', selectedInstrumentId],
    enabled: loaded,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    retry: 1,
    queryFn: async () => {
      await ensureInstrument(selectedInstrumentId)
      return true
    },
  })

  const isInstrumentReady = instrumentQuery.isSuccess

  const playTone = async (button: ToneButtonConfig) => {
    if (isPlayingByButtonId[button.id]) return

    stopAllTones()

    // User interaction path: ensure context is running before triggering playback.
    await ensureAudioContext(true)

    const trial =
      button.mode === 'start' ? startTrial() : getCurrentTrial()
    if (!trial) return

    const instrument = await ensureInstrument(selectedInstrumentId)
    const stop = instrument.start({
      note: toSmplrNoteName(trial.note, trial.frequencyMultiplier),
      duration: 1,
    })

    setIsPlayingByButtonId((prev) => ({ ...prev, [button.id]: true }))
    activeStopRef.current = stop

    stopTimerRef.current = setTimeout(() => {
      activeStopRef.current?.()
      activeStopRef.current = null
      stopTimerRef.current = null
      setIsPlayingByButtonId((prev) => ({ ...prev, [button.id]: false }))
    }, 1000)
  }

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
        instrumentQuery.isPending ? (
          <div className="ear-loading-screen" role="status" aria-live="polite" aria-busy="true">
            <div className="ear-loading-card">
              <div className="ear-loading-spinner" aria-hidden="true" />
              <div className="ear-loading-title">Instrument lädt...</div>
              <div className="ear-loading-copy">Das Klavier wird vorbereitet, bitte kurz warten.</div>
            </div>
          </div>
        ) : instrumentQuery.isError ? (
          <div className="ear-loading-screen" role="status" aria-live="polite" aria-busy="false">
            <div className="ear-loading-card">
              <div className="ear-loading-title">Instrument konnte nicht geladen werden</div>
              <div className="ear-loading-copy">Bitte erneut versuchen.</div>
              <button
                className="ear-button ear-button-primary"
                onClick={() => {
                  void instrumentQuery.refetch()
                }}
              >
                Erneut laden
              </button>
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
              levelProgress={levelProgress}
              levelProgressTotal={levelProgressTotal}
              leveledUpToast={leveledUpToast}
            />

            <ActiveSession
              buttons={TONE_BUTTONS.map((button) => ({
                ...button,
                isPlaying: Boolean(isPlayingByButtonId[button.id]),
                isReady:
                  isInstrumentReady &&
                  (button.mode === 'start' ? !awaitingGuess : Boolean(getCurrentTrial())),
              }))}
              onPlayTone={(buttonId) => {
                const button = TONE_BUTTONS.find((entry) => entry.id === buttonId)
                if (!button) return
                void playTone(button)
              }}
            />

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
                    onClick={() => handleGuess(option.id)}
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
                  ? `Richtig · ${feedback.actualLabel} (${feedback.toneStyle})`
                  : `Gehört war ${feedback.actualLabel} · geraten: ${feedback.guessedLabel}`}
              </div>
            )}
          </div>
        )
      )}
    </div>
  )
}