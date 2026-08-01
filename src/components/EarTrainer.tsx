import { useEffect, useRef, useState } from 'react'
import { Soundfont } from 'smplr'

import { ActiveSession } from '../features/earTrainer/components/ActiveSession'
import { TrainerHeader } from '../features/earTrainer/components/TrainerHeader'
import {
  INSTRUMENTS,
  type InstrumentId,
} from '../features/earTrainer/config'
import '../features/earTrainer/earTrainer.css'

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
  const pianoRef = useRef<ReturnType<typeof Soundfont> | null>(null)
  const activeStopRef = useRef<(() => void) | null>(null)
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPianoReady, setIsPianoReady] = useState(false)

  const clearStopTimer = () => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current)
      stopTimerRef.current = null
    }
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

  const ensurePiano = async () => {
    if (pianoRef.current) {
      return pianoRef.current
    }

    const audioContext = await ensureAudioContext()
    const piano = Soundfont(audioContext, {
      instrument: 'acoustic_grand_piano',
      volume: 100,
      velocity: 95,
    })

    pianoRef.current = piano
    await piano.ready
    setIsPianoReady(true)
    return piano
  }

  const playTone = async () => {
    if (isPlaying) return

    clearStopTimer()
    activeStopRef.current?.()
    activeStopRef.current = null

    const piano = await ensurePiano()
    const note = 'C4'
    const stop = piano.start({ note, duration: 1 })

    setIsPlaying(true)
    activeStopRef.current = stop

    stopTimerRef.current = setTimeout(() => {
      activeStopRef.current?.()
      activeStopRef.current = null
      stopTimerRef.current = null
      setIsPlaying(false)
    }, 1000)
  }

  useEffect(() => {
    return () => {
      clearStopTimer()
      activeStopRef.current?.()
      pianoRef.current?.dispose()
      void audioContextRef.current?.close()
      audioContextRef.current = null
      pianoRef.current = null
      activeStopRef.current = null
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
              {isPianoReady ? 'Klavier bereit' : 'Klavier lädt...'}
            </div>
          </div>

          <ActiveSession
            isPlaying={isPlaying}
            onPlayTone={() => {
              void playTone()
            }}
          />
        </div>
      )}
    </div>
  )
}