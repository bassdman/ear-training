import { useEffect, useRef, useState } from 'react'
import { Soundfont } from 'smplr'

import { ActiveSession } from '../features/earTrainer/components/ActiveSession'
import { TrainerHeader } from '../features/earTrainer/components/TrainerHeader'
import {
  INSTRUMENTS,
  type InstrumentId,
} from '../features/earTrainer/config'
import '../features/earTrainer/earTrainer.css'

type ToneButtonConfig = {
  id: string
  label: string
  instrumentId: 'piano' | 'flute'
  note: string
}

const TONE_BUTTONS: ToneButtonConfig[] = [
  { id: 'piano-c4', label: 'Klavier C4', instrumentId: 'piano', note: 'C4' },
  { id: 'flute-g4', label: 'Flöte G4', instrumentId: 'flute', note: 'G4' },
]

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
  rangeLabel,
  rangeSubtitle,
  selectedInstrumentId,
  playbackVolume,
  setPlaybackVolume,
  onBackToCourse,
}: EarTrainerProps) {
  const audioContextRef = useRef<AudioContext | null>(null)
  const instrumentsRef = useRef<Partial<Record<InstrumentId, ReturnType<typeof Soundfont>>>>({})
  const activeStopsRef = useRef<Partial<Record<InstrumentId, (() => void) | null>>>({})
  const stopTimerRef = useRef<Partial<Record<InstrumentId, ReturnType<typeof setTimeout> | null>>>({})
  const [isPlayingByButtonId, setIsPlayingByButtonId] = useState<Record<string, boolean>>({})
  const [readyByInstrumentId, setReadyByInstrumentId] = useState<Record<InstrumentId, boolean>>({
    piano: false,
    guitar: false,
    flute: false,
    organ: false,
    synth: false,
  })

  const clearStopTimer = () => {
    Object.values(stopTimerRef.current).forEach((timer) => {
      if (timer) {
        clearTimeout(timer)
      }
    })
    stopTimerRef.current = {}
  }

  const stopAllTones = () => {
    Object.values(activeStopsRef.current).forEach((stop) => stop?.())
    activeStopsRef.current = {}
    clearStopTimer()
    setIsPlayingByButtonId({})
  }

  const ensureAudioContext = async () => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new window.AudioContext()
    }

    const audioContext = audioContextRef.current
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    return audioContext
  }

  const ensureInstrument = async (instrumentId: 'piano' | 'flute') => {
    const existingInstrument = instrumentsRef.current[instrumentId]
    if (existingInstrument) {
      return existingInstrument
    }

    const audioContext = await ensureAudioContext()
    const instrumentConfig = INSTRUMENTS[instrumentId]
    const instrument = Soundfont(audioContext, {
      instrument: instrumentConfig.soundfontInstrument,
      volume: 100,
      velocity: 95,
    })

    instrumentsRef.current[instrumentId] = instrument
    await instrument.ready
    setReadyByInstrumentId((prev) => ({ ...prev, [instrumentId]: true }))
    return instrument
  }

  useEffect(() => {
    if (!loaded) return

    void Promise.all(TONE_BUTTONS.map((button) => ensureInstrument(button.instrumentId)))
  }, [loaded])

  const playTone = async (button: ToneButtonConfig) => {
    if (isPlayingByButtonId[button.id]) return

    stopAllTones()

    const instrument = await ensureInstrument(button.instrumentId)
    const stop = instrument.start({ note: button.note, duration: 1 })

    setIsPlayingByButtonId((prev) => ({ ...prev, [button.id]: true }))
    activeStopsRef.current[button.instrumentId] = stop

    stopTimerRef.current[button.instrumentId] = setTimeout(() => {
      activeStopsRef.current[button.instrumentId]?.()
      activeStopsRef.current[button.instrumentId] = null
      stopTimerRef.current[button.instrumentId] = null
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
      activeStopsRef.current = {}
    }
  }, [])

  return (
    <div className="ear-page">
      {!loaded ? (
        <div className="ear-loading">Lade Fortschritt ...</div>
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

            <div className="ear-samples-status" role="status" aria-live="polite">
              {TONE_BUTTONS.every((button) => readyByInstrumentId[button.instrumentId])
                ? 'Klavier und Flöte bereit'
                : 'Klavier und Flöte laden...'}
            </div>
          </div>

          <ActiveSession
            buttons={TONE_BUTTONS.map((button) => ({
              ...button,
              isPlaying: Boolean(isPlayingByButtonId[button.id]),
              isReady: readyByInstrumentId[button.instrumentId],
            }))}
            onPlayTone={(buttonId) => {
              const button = TONE_BUTTONS.find((entry) => entry.id === buttonId)
              if (!button) return
              void playTone(button)
            }}
          />
        </div>
      )}
    </div>
  )
}