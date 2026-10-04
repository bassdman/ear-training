import { useCallback, useEffect, useRef, useState } from 'react'

import {
  describePitch,
  INITIAL_SING_STATE,
  stepSingState,
  type PitchReading,
  type SingState,
} from '../../features/intonationPractice/singing'
import {
  PITCH_MAX_RECORDING_DURATION_MS,
  PITCH_SILENCE_TIMEOUT_MS,
  PITCH_TOLERANCE_CENTS,
  REQUIRED_STABLE_SAMPLES,
} from '../intonation/config'
import { detectPitch, getMicrophoneErrorMessage } from '../intonation/helpers/pitchUtils'

export const SING_HOLD_MS = 2000

export type SingProgress = {
  noteIndex: number
  total: number
  target: number
  hold: number
  // null: gerade kein Ton erkannt
  detected: PitchReading | null
}

// Nimmt über das Mikrofon auf und meldet Erfolg, wenn jeder Ton der Reihe nach SING_HOLD_MS lang trifft.
export function useSingStep() {
  const [listeningKey, setListeningKey] = useState<string | null>(null)
  const [progress, setProgress] = useState<SingProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  const keyRef = useRef<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const frameRef = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    void audioContextRef.current?.close()
    frameRef.current = null
    streamRef.current = null
    audioContextRef.current = null
    keyRef.current = null
    setListeningKey(null)
    setProgress(null)
  }, [])

  const stopOwned = useCallback(
    (keyPrefix: string) => {
      if (keyRef.current?.startsWith(keyPrefix)) stop()
    },
    [stop],
  )

  const start = useCallback(
    async (key: string, notes: readonly (number | null)[], onSuccess: () => void) => {
      stop()
      setError(null)
      const targets = notes.filter((note): note is number => note !== null)
      if (targets.length === 0) return

      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError(getMicrophoneErrorMessage(null))
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const audioContext = new AudioContext()
        // iOS/Safari startet den Kontext nach dem await manchmal angehalten
        if (audioContext.state === 'suspended') await audioContext.resume()
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 2048
        audioContext.createMediaStreamSource(stream).connect(analyser)
        const samples = new Float32Array(analyser.fftSize)
        const stableFrequencies: number[] = []

        streamRef.current = stream
        audioContextRef.current = audioContext
        keyRef.current = key
        setListeningKey(key)
        setProgress({ noteIndex: 0, total: targets.length, target: targets[0], hold: 0, detected: null })

        const startTime = performance.now()
        const maxDuration = PITCH_MAX_RECORDING_DURATION_MS * targets.length
        let lastAudibleTime = startTime
        let state: SingState = INITIAL_SING_STATE

        const analyse = () => {
          const now = performance.now()
          analyser.getFloatTimeDomainData(samples)
          const frequency = detectPitch(samples, audioContext.sampleRate)
          const options = { holdMs: SING_HOLD_MS, toleranceCents: PITCH_TOLERANCE_CENTS }

          if (frequency === null) {
            stableFrequencies.length = 0
            state = stepSingState(state, targets, null, now, options).state
            setProgress({
              noteIndex: state.index,
              total: targets.length,
              target: targets[state.index],
              hold: 0,
              detected: null,
            })
            if (now - lastAudibleTime >= PITCH_SILENCE_TIMEOUT_MS) {
              stop()
              return
            }
          } else {
            lastAudibleTime = now
            stableFrequencies.push(frequency)
            if (stableFrequencies.length > REQUIRED_STABLE_SAMPLES) stableFrequencies.shift()
            const spreadInCents =
              1200 * Math.log2(Math.max(...stableFrequencies) / Math.min(...stableFrequencies))

            if (stableFrequencies.length >= 2 && spreadInCents < 50) {
              const average =
                stableFrequencies.reduce((sum, value) => sum + value, 0) / stableFrequencies.length
              const result = stepSingState(state, targets, average, now, options)
              state = result.state
              if (result.done) {
                stop()
                onSuccess()
                return
              }
              setProgress({
                noteIndex: state.index,
                total: targets.length,
                target: targets[state.index],
                hold: result.holdProgress,
                detected: describePitch(average),
              })
            }
          }

          if (now - startTime >= maxDuration) {
            stop()
            return
          }
          frameRef.current = window.requestAnimationFrame(analyse)
        }

        frameRef.current = window.requestAnimationFrame(analyse)
      } catch (caught) {
        setError(getMicrophoneErrorMessage(caught))
        stop()
      }
    },
    [stop],
  )

  useEffect(() => stop, [stop])

  return { listeningKey, progress, error, start, stop, stopOwned }
}

export type SingController = ReturnType<typeof useSingStep>
