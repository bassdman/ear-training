import { useCallback, useEffect, useRef, useState } from 'react'

import {
  describePitch,
  INITIAL_SING_STATE,
  stableFrequency,
  stepSingState,
  type PitchReading,
  type SingOptions,
  type SingState,
} from '../../features/intonationPractice/singing'
import {
  PITCH_MAX_RECORDING_DURATION_MS,
  PITCH_SILENCE_TIMEOUT_MS,
  PITCH_TOLERANCE_CENTS,
} from '../intonation/config'
import { detectPitch, getMicrophoneErrorMessage } from '../intonation/helpers/pitchUtils'

// Stellschrauben der Erkennung beim Singen
export const SING_HOLD_MS = 2000
// Aussetzer bis zu dieser Dauer pausieren die Haltezeit nur
export const SING_GRACE_MS = 1500
export const SING_RELEASE_MS = 200
// Pegel- und Qualitätsschwelle der Tonhöhenerkennung (niedriger = empfindlicher)
export const SING_MIN_RMS = 0.008
export const SING_MIN_CORRELATION = 0.65
// Messungen der letzten SING_WINDOW_MS werden zu einem Wert zusammengefasst
export const SING_WINDOW_MS = 250
export const SING_STABLE = { minSamples: 3, maxDeviationCents: 50, minShare: 0.6 }
// So lange bleibt der zuletzt gehörte Ton in der Anzeige stehen
export const SING_DISPLAY_HOLD_MS = 600

// Entrauschen/Pegelregelung des Browsers würde gesungene Töne teils abschneiden
const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
}

const SING_OPTIONS: SingOptions = {
  holdMs: SING_HOLD_MS,
  toleranceCents: PITCH_TOLERANCE_CENTS,
  graceMs: SING_GRACE_MS,
  releaseMs: SING_RELEASE_MS,
}

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
        const stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS })
        const audioContext = new AudioContext()
        // iOS/Safari startet den Kontext nach dem await manchmal angehalten
        if (audioContext.state === 'suspended') await audioContext.resume()
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 2048
        audioContext.createMediaStreamSource(stream).connect(analyser)
        const samples = new Float32Array(analyser.fftSize)
        const recent: { frequency: number; time: number }[] = []

        streamRef.current = stream
        audioContextRef.current = audioContext
        keyRef.current = key
        setListeningKey(key)
        setProgress({ noteIndex: 0, total: targets.length, target: targets[0], hold: 0, detected: null })

        const startTime = performance.now()
        const maxDuration = PITCH_MAX_RECORDING_DURATION_MS * targets.length
        let lastAudibleTime = startTime
        let lastReading: { reading: PitchReading; time: number } | null = null
        let state: SingState = INITIAL_SING_STATE

        const analyse = () => {
          const now = performance.now()
          analyser.getFloatTimeDomainData(samples)
          const frequency = detectPitch(samples, audioContext.sampleRate, {
            minRms: SING_MIN_RMS,
            minCorrelation: SING_MIN_CORRELATION,
          })

          if (frequency !== null) {
            lastAudibleTime = now
            recent.push({ frequency, time: now })
          }
          while (recent.length > 0 && now - recent[0].time > SING_WINDOW_MS) recent.shift()

          const stable = stableFrequency(
            recent.map((entry) => entry.frequency),
            SING_STABLE,
          )
          if (stable !== null) lastReading = { reading: describePitch(stable), time: now }

          const result = stepSingState(state, targets, stable, now, SING_OPTIONS)
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
            detected:
              lastReading && now - lastReading.time < SING_DISPLAY_HOLD_MS ? lastReading.reading : null,
          })

          if (now - lastAudibleTime >= PITCH_SILENCE_TIMEOUT_MS || now - startTime >= maxDuration) {
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
