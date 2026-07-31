import { useCallback, useEffect, useRef, useState } from 'react'
import { Soundfont } from 'smplr'

import {
  NOTE_FREQS,
  TONE_STYLE_IDS,
  TONE_STYLES,
  getOctaveFromMultiplier,
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

const INITIAL_LOAD_STATE = TONE_STYLE_IDS.reduce((acc, styleId) => {
  acc[styleId] = { loaded: 0, total: 0, ready: false, failed: false }
  return acc
}, {} as Record<ToneStyleId, ToneStyleLoadState>)

export function useTonePlayer() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPreloading, setIsPreloading] = useState(false)
  const [loadStateByStyle, setLoadStateByStyle] =
    useState<Record<ToneStyleId, ToneStyleLoadState>>(INITIAL_LOAD_STATE)
  const audioContextRef = useRef<AudioContext | null>(null)
  const instrumentsRef = useRef<Partial<Record<ToneStyleId, ReturnType<typeof Soundfont>>>>({})
  const readyPromisesRef = useRef<Partial<Record<ToneStyleId, Promise<void>>>>({})
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
    toneStyle: ToneStyleId,
    frequencyMultiplier: number,
  ) => {
    const style = TONE_STYLES[toneStyle]
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    const now = audioContext.currentTime
    const sustainStart = now + style.envelope.attack + style.envelope.decay

    oscillator.type = style.oscillatorType
    oscillator.frequency.setValueAtTime(NOTE_FREQS[note] * frequencyMultiplier, now)
    gainNode.gain.setValueAtTime(0.0001, now)
    gainNode.gain.linearRampToValueAtTime(0.9, now + style.envelope.attack)
    gainNode.gain.exponentialRampToValueAtTime(
      Math.max(style.envelope.sustain, 0.04),
      now + style.envelope.attack + style.envelope.decay,
    )
    gainNode.gain.setValueAtTime(Math.max(style.envelope.sustain, 0.04), sustainStart)

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    oscillator.start(now)

    return () => {
      const stopNow = audioContext.currentTime
      const stopAt = stopNow + style.envelope.release
      gainNode.gain.cancelScheduledValues(stopNow)
      gainNode.gain.setValueAtTime(Math.max(gainNode.gain.value, 0.0001), stopNow)
      gainNode.gain.exponentialRampToValueAtTime(0.0001, stopAt)
      oscillator.stop(stopAt)
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

  const ensureInstrument = async (audioContext: AudioContext, toneStyle: ToneStyleId) => {
    if (TONE_STYLES[toneStyle].playbackEngine === 'synth') {
      throw new Error('Synth tone styles do not use soundfont loading.')
    }

    let instrument = instrumentsRef.current[toneStyle]
    if (!instrument) {
      instrument = Soundfont(audioContext, {
        instrument: TONE_STYLES[toneStyle].soundfontInstrument,
        volume: 100,
        velocity: 95,
        onLoadProgress: ({ loaded, total }) => {
          setLoadStateByStyle((prev) => ({
            ...prev,
            [toneStyle]: {
              ...prev[toneStyle],
              loaded,
              total,
            },
          }))
        },
      })
      instrumentsRef.current[toneStyle] = instrument
    }

    let readyPromise = readyPromisesRef.current[toneStyle]
    if (!readyPromise) {
      readyPromise = instrument.ready
        .then(() => {
          setLoadStateByStyle((prev) => ({
            ...prev,
            [toneStyle]: {
              ...prev[toneStyle],
              ready: true,
              failed: false,
              loaded: prev[toneStyle].total || prev[toneStyle].loaded,
            },
          }))
        })
        .catch((error) => {
          setLoadStateByStyle((prev) => ({
            ...prev,
            [toneStyle]: {
              ...prev[toneStyle],
              failed: true,
            },
          }))
          throw error
        })

      readyPromisesRef.current[toneStyle] = readyPromise
    }

    await readyPromise
    return instrument
  }

  const preloadToneStyles = useCallback(async (toneStyles: ToneStyleId[]) => {
    if (toneStyles.length === 0) return

    setIsPreloading(true)

    try {
      const audioContext = await ensureAudioContext()
      const uniqueToneStyles = [...new Set(toneStyles)]

      await Promise.all(
        uniqueToneStyles.map(async (toneStyle) => {
          if (TONE_STYLES[toneStyle].playbackEngine === 'synth') {
            setLoadStateByStyle((prev) => ({
              ...prev,
              [toneStyle]: {
                ...prev[toneStyle],
                loaded: 1,
                total: 1,
                ready: true,
                failed: false,
              },
            }))
            return
          }

          try {
            await ensureInstrument(audioContext, toneStyle)
          } catch {
            // Fallback handling happens during playback.
          }
        }),
      )
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
    toneStyle: ToneStyleId,
    frequencyMultiplier = 1,
    playbackVolume = 100,
  ) => {
    stopTone()
    const audioContext = await ensureAudioContext()
    const requestId = ++playRequestIdRef.current

    setIsPlaying(true)

    if (TONE_STYLES[toneStyle].playbackEngine === 'synth') {
      const stopSynth = fallbackPlayTone(audioContext, note, toneStyle, frequencyMultiplier)
      if (requestId !== playRequestIdRef.current) {
        stopSynth()
        return
      }

      activeStopRef.current = stopSynth
      return
    }

    try {
      const instrument = await ensureInstrument(audioContext, toneStyle)
      if (requestId !== playRequestIdRef.current) {
        return
      }

      instrument.output.volume = Math.min(127, Math.max(0, playbackVolume))
      activeStopRef.current = instrument.start({
        note: toSmplrNoteName(note, frequencyMultiplier),
        velocity: 95,
      })
    } catch (error) {
      console.warn('smplr playback failed, using oscillator fallback', error)
      if (requestId !== playRequestIdRef.current) {
        return
      }

      activeStopRef.current = fallbackPlayTone(
        audioContext,
        note,
        toneStyle,
        frequencyMultiplier,
      )
    }
  }

  const overallLoad = TONE_STYLE_IDS.reduce(
    (acc, style) => {
      const state = loadStateByStyle[style]
      acc.loaded += state.loaded
      acc.total += state.total
      return acc
    },
    { loaded: 0, total: 0 },
  )

  return {
    isPlaying,
    isPreloading,
    loadStateByStyle,
    overallLoad,
    startTone,
    stopTone,
    preloadToneStyles,
  }
}
