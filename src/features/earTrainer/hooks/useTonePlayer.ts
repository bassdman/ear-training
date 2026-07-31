import { useCallback, useEffect, useRef, useState } from 'react'
import { Soundfont } from 'smplr'

import {
  INSTRUMENT_IDS,
  INSTRUMENTS,
  NOTE_FREQS,
  TONE_STYLES,
  getOctaveFromMultiplier,
  type InstrumentId,
  type NoteName,
  type ToneStyleId,
} from '../config'

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

type ToneStyleLoadState = {
  loaded: number
  total: number
  ready: boolean
  failed: boolean
}

const INITIAL_LOAD_STATE = INSTRUMENT_IDS.reduce((acc, instrumentId) => {
  acc[instrumentId] = { loaded: 0, total: 0, ready: false, failed: false }
  return acc
}, {} as Record<InstrumentId, ToneStyleLoadState>)

export function useTonePlayer() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPreloading, setIsPreloading] = useState(false)
  const [loadStateByInstrument, setLoadStateByInstrument] =
    useState<Record<InstrumentId, ToneStyleLoadState>>(INITIAL_LOAD_STATE)
  const audioContextRef = useRef<AudioContext | null>(null)
  const instrumentsRef = useRef<Partial<Record<InstrumentId, ReturnType<typeof Soundfont>>>>({})
  const readyPromisesRef = useRef<Partial<Record<InstrumentId, Promise<void>>>>({})
  const activeStopRef = useRef<(() => void) | null>(null)
  const playRequestIdRef = useRef(0)

  const cleanupAudioResources = useCallback(() => {
    readyPromisesRef.current = {}
    Object.values(instrumentsRef.current).forEach((instrument) => {
      instrument?.dispose()
    })
    void audioContextRef.current?.close()
    audioContextRef.current = null
    instrumentsRef.current = {}
  }, [])

  const fallbackPlayTone = (
    audioContext: AudioContext,
    note: NoteName,
    instrumentId: InstrumentId,
    toneStyle: ToneStyleId,
    frequencyMultiplier: number,
  ) => {
    const toneColor = TONE_STYLES[toneStyle]
    const instrument = INSTRUMENTS[instrumentId]
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    const now = audioContext.currentTime
    const sustainStart = now + toneColor.envelope.attack + toneColor.envelope.decay

    oscillator.type =
      instrument.playbackEngine === 'synth'
        ? toneColor.oscillatorType
        : instrument.oscillatorType
    oscillator.frequency.setValueAtTime(NOTE_FREQS[note] * frequencyMultiplier, now)
    gainNode.gain.setValueAtTime(0.0001, now)
    gainNode.gain.linearRampToValueAtTime(0.9, now + toneColor.envelope.attack)
    gainNode.gain.exponentialRampToValueAtTime(
      Math.max(toneColor.envelope.sustain, 0.04),
      now + toneColor.envelope.attack + toneColor.envelope.decay,
    )
    gainNode.gain.setValueAtTime(Math.max(toneColor.envelope.sustain, 0.04), sustainStart)

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    oscillator.start(now)

    return () => {
      const stopNow = audioContext.currentTime
      const stopAt = stopNow + toneColor.envelope.release
      gainNode.gain.cancelScheduledValues(stopNow)
      gainNode.gain.setValueAtTime(Math.max(gainNode.gain.value, 0.0001), stopNow)
      gainNode.gain.exponentialRampToValueAtTime(0.0001, stopAt)
      oscillator.stop(stopAt)
    }
  }

  const ensureAudioContext = async (shouldResume: boolean) => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new window.AudioContext()
    }

    const audioContext = audioContextRef.current
    if (shouldResume && audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    return audioContext
  }

  const ensureInstrument = async (audioContext: AudioContext, instrumentId: InstrumentId) => {
    const instrumentConfig = INSTRUMENTS[instrumentId]
    if (instrumentConfig.playbackEngine === 'synth') {
      throw new Error('Synth instrument does not use soundfont loading.')
    }

    let instrument = instrumentsRef.current[instrumentId]
    if (!instrument) {
      instrument = Soundfont(audioContext, {
        instrument: instrumentConfig.soundfontInstrument,
        volume: 100,
        velocity: 95,
        onLoadProgress: ({ loaded, total }) => {
          setLoadStateByInstrument((prev) => ({
            ...prev,
            [instrumentId]: {
              ...prev[instrumentId],
              loaded,
              total,
            },
          }))
        },
      })
      instrumentsRef.current[instrumentId] = instrument
    }

    let readyPromise = readyPromisesRef.current[instrumentId]
    if (!readyPromise) {
      readyPromise = instrument.ready
        .then(() => {
          setLoadStateByInstrument((prev) => ({
            ...prev,
            [instrumentId]: {
              ...prev[instrumentId],
              ready: true,
              failed: false,
              loaded: prev[instrumentId].total || prev[instrumentId].loaded,
            },
          }))
        })
        .catch((error) => {
          setLoadStateByInstrument((prev) => ({
            ...prev,
            [instrumentId]: {
              ...prev[instrumentId],
              failed: true,
            },
          }))
          throw error
        })

      readyPromisesRef.current[instrumentId] = readyPromise
    }

    await readyPromise
    return instrument
  }

  const preloadInstrument = useCallback(async (instrumentId: InstrumentId) => {
    if (!instrumentId) return

    setIsPreloading(true)

    try {
      const audioContext = await ensureAudioContext(false)

      if (INSTRUMENTS[instrumentId].playbackEngine === 'synth') {
        setLoadStateByInstrument((prev) => ({
          ...prev,
          [instrumentId]: {
            ...prev[instrumentId],
            loaded: 1,
            total: 1,
            ready: true,
            failed: false,
          },
        }))
        return
      }

      try {
        await ensureInstrument(audioContext, instrumentId)
      } catch {
        // Fallback handling happens during playback.
      }
    } finally {
      setIsPreloading(false)
    }
  }, [])

  useEffect(() => {
    return () => {
      activeStopRef.current?.()
      cleanupAudioResources()
    }
  }, [cleanupAudioResources])

  const stopTone = useCallback(() => {
    playRequestIdRef.current += 1
    activeStopRef.current?.()
    activeStopRef.current = null
    setIsPlaying(false)
  }, [])

  const startTone = async (
    note: NoteName,
    instrumentId: InstrumentId,
    toneStyle: ToneStyleId,
    frequencyMultiplier = 1,
    playbackVolume = 100,
  ) => {
    stopTone()
    const audioContext = await ensureAudioContext(true)
    const requestId = ++playRequestIdRef.current
    const toneColor = TONE_STYLES[toneStyle]

    setIsPlaying(true)

    if (INSTRUMENTS[instrumentId].playbackEngine === 'synth') {
      const stopSynth = fallbackPlayTone(
        audioContext,
        note,
        instrumentId,
        toneStyle,
        frequencyMultiplier,
      )
      if (requestId !== playRequestIdRef.current) {
        stopSynth()
        return
      }

      activeStopRef.current = stopSynth
      return
    }

    try {
      const instrument = await ensureInstrument(audioContext, instrumentId)
      if (requestId !== playRequestIdRef.current) {
        return
      }

      instrument.output.volume = Math.min(127, Math.max(0, playbackVolume))
      activeStopRef.current = instrument.start({
        note: toSmplrNoteName(note, frequencyMultiplier),
        velocity: toneColor.velocity,
        detune: toneColor.detuneCents,
      })
    } catch (error) {
      console.warn('smplr playback failed, using oscillator fallback', error)
      if (requestId !== playRequestIdRef.current) {
        return
      }

      activeStopRef.current = fallbackPlayTone(
        audioContext,
        note,
        instrumentId,
        toneStyle,
        frequencyMultiplier,
      )
    }
  }

  return {
    isPlaying,
    isPreloading,
    loadStateByInstrument,
    startTone,
    stopTone,
    preloadInstrument,
  }
}
