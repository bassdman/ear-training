import { useCallback, useEffect, useRef, useState } from 'react'
import { Soundfont } from 'smplr'

import { INSTRUMENTS, type InstrumentId } from '../../../features/earTrainer/config'
import { ASSETS_URL, noteLabels, noteNames, REFERENCE_TONE_DURATION_MS } from '../config'
import { getNoteConfig } from '../helpers/pitchUtils'
import type { ActiveNote, IntonationInstrumentId } from '../types'
import { useAudioPlayer } from './useAudioPlayer'

export function useIntonationAudio(
  selectedInstrumentId: IntonationInstrumentId,
  microphoneEnabled: boolean,
  startListening: (noteId: string, microphoneRequest?: Promise<MediaStream>) => void,
) {
  const [activeNote, setActiveNote] = useState<ActiveNote>(null)
  const [audioError, setAudioError] = useState<string | null>(null)

  const activeTimerRef = useRef<number | null>(null)
  const referenceAudioTimerRef = useRef<number | null>(null)
  const microphoneTimerRef = useRef<number | null>(null)
  const instrumentAudioContextRef = useRef<AudioContext | null>(null)
  const instrumentsRef = useRef<Partial<Record<InstrumentId, ReturnType<typeof Soundfont>>>>({})
  const activeInstrumentStopRef = useRef<(() => void) | null>(null)

  const referenceAudioPlayer = useAudioPlayer()
  const chillAudioPlayer = useAudioPlayer()

  const getReferenceInstrumentId = useCallback((): InstrumentId | null => {
    if (selectedInstrumentId === 'none') return null
    if (selectedInstrumentId !== 'random') return selectedInstrumentId

    const instrumentIds = Object.keys(INSTRUMENTS) as InstrumentId[]
    return instrumentIds[Math.floor(Math.random() * instrumentIds.length)]
  }, [selectedInstrumentId])

  const playNote = useCallback(async (noteId: string) => {
    const noteConfig = getNoteConfig(noteId)
    if (noteConfig.disabled) return

    referenceAudioPlayer.stop()
    activeInstrumentStopRef.current?.()
    if (activeTimerRef.current !== null) window.clearTimeout(activeTimerRef.current)
    if (referenceAudioTimerRef.current !== null) window.clearTimeout(referenceAudioTimerRef.current)
    if (microphoneTimerRef.current !== null) window.clearTimeout(microphoneTimerRef.current)

    const referenceInstrumentId = getReferenceInstrumentId()
    const noteIndex = noteNames.indexOf(noteConfig.note)
    const audioPath = `${ASSETS_URL}/sounds/${noteConfig.octave}${noteConfig.note}.mp3`
    const audio = referenceAudioPlayer.prepare(audioPath, {
      onError: () => {
        setAudioError(`Die Audiodatei ${audioPath} konnte nicht geladen werden.`)
        setActiveNote(null)
      },
    })

    const microphoneRequest = microphoneEnabled && window.isSecureContext && navigator.mediaDevices?.getUserMedia
      ? navigator.mediaDevices.getUserMedia({ audio: true })
      : undefined

    setAudioError(null)
    setActiveNote(noteId)

    if (referenceInstrumentId) {
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
        audio.currentTime = 0
        audio.volume = 1
      }, REFERENCE_TONE_DURATION_MS)
    } else {
      audio.currentTime = 0
      void audio.play().catch(() => {
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
  }, [getReferenceInstrumentId, microphoneEnabled, referenceAudioPlayer, startListening])

  const playChillTrack = useCallback(() => {
    const audio = chillAudioPlayer.prepare(`${ASSETS_URL}/sounds/chillen.mp3`, {
      onError: () => setAudioError('Der Titel konnte nicht geladen werden.'),
    })
    setAudioError(null)
    void audio.play().catch(() => {
      setAudioError('Der Titel kann in diesem Browser nicht abgespielt werden.')
    })
  }, [chillAudioPlayer])

  const referenceAudioPlayerRef = useRef(referenceAudioPlayer)
  referenceAudioPlayerRef.current = referenceAudioPlayer
  const chillAudioPlayerRef = useRef(chillAudioPlayer)
  chillAudioPlayerRef.current = chillAudioPlayer

  useEffect(() => () => {
    referenceAudioPlayerRef.current.stop()
    activeInstrumentStopRef.current?.()
    chillAudioPlayerRef.current.stop()
    Object.values(instrumentsRef.current).forEach((instrument) => instrument?.dispose())
    void instrumentAudioContextRef.current?.close()
    if (activeTimerRef.current !== null) window.clearTimeout(activeTimerRef.current)
    if (referenceAudioTimerRef.current !== null) window.clearTimeout(referenceAudioTimerRef.current)
    if (microphoneTimerRef.current !== null) window.clearTimeout(microphoneTimerRef.current)
  }, [])

  return {
    activeNote,
    audioError,
    setAudioError,
    playNote,
    playChillTrack,
  }
}
