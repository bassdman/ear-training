import { useCallback, useEffect, useRef, useState } from 'react'

import {
  PITCH_HOLD_DURATION_MS,
  PITCH_MAX_RECORDING_DURATION_MS,
  PITCH_SILENCE_TIMEOUT_MS,
  REQUIRED_STABLE_SAMPLES,
} from '../config'
import { detectPitch, getMicrophoneErrorMessage, getPitchResult } from '../helpers/pitchUtils'
import type { ActiveNote, PitchResult } from '../types'

export function usePitchDetection() {
  const [listeningNote, setListeningNote] = useState<ActiveNote>(null)
  const [listeningPitch, setListeningPitch] = useState<string | null>(null)
  const [pitchResult, setPitchResult] = useState<{ noteId: string, result: PitchResult } | null>(null)
  const [pitchError, setPitchError] = useState<string | null>(null)

  const microphoneStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  const stopListening = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current)
    }
    microphoneStreamRef.current?.getTracks().forEach((track) => track.stop())
    void audioContextRef.current?.close()
    microphoneStreamRef.current = null
    audioContextRef.current = null
    animationFrameRef.current = null
    setListeningNote(null)
    setListeningPitch(null)
  }, [])

  const clearPitchResult = useCallback(() => {
    setPitchResult(null)
  }, [])

  const startListening = useCallback(async (noteId: string) => {
    stopListening()
    setPitchResult(null)
    setListeningPitch('---')

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setPitchError(getMicrophoneErrorMessage(null))
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const audioContext = new AudioContext()
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 2048
      audioContext.createMediaStreamSource(stream).connect(analyser)
      const samples = new Float32Array(analyser.fftSize)
      const stableFrequencies: number[] = []

      microphoneStreamRef.current = stream
      audioContextRef.current = audioContext
      setListeningNote(noteId)

      const startTime = performance.now()
      let lastAudibleTime = startTime
      let inTuneStartTime: number | null = null
      let lastDetectedResult: PitchResult | null = null

      const analyse = () => {
        const now = performance.now()
        analyser.getFloatTimeDomainData(samples)
        const frequency = detectPitch(samples, audioContext.sampleRate)

        if (frequency !== null) {
          lastAudibleTime = now
          stableFrequencies.push(frequency)
          if (stableFrequencies.length > REQUIRED_STABLE_SAMPLES) stableFrequencies.shift()
          const lowestFrequency = Math.min(...stableFrequencies)
          const highestFrequency = Math.max(...stableFrequencies)
          const spreadInCents = 1200 * Math.log2(highestFrequency / lowestFrequency)

          if (stableFrequencies.length >= 2 && spreadInCents < 50) {
            const averageFrequency = stableFrequencies.reduce((sum, value) => sum + value, 0) / stableFrequencies.length
            const result = getPitchResult(averageFrequency, noteId)
            if (result) {
              lastDetectedResult = result
              setListeningPitch(result.detectedNote)

              if (result.isInTune) {
                if (inTuneStartTime === null) {
                  inTuneStartTime = now
                } else if (now - inTuneStartTime >= PITCH_HOLD_DURATION_MS) {
                  setPitchResult({ noteId, result })
                  stopListening()
                  return
                }
              } else {
                inTuneStartTime = null
              }
            }
          }
        } else {
          stableFrequencies.length = 0
          inTuneStartTime = null
          setListeningPitch('---')

          if (now - lastAudibleTime >= PITCH_SILENCE_TIMEOUT_MS) {
            const result = lastDetectedResult ?? {
              detectedNote: '---',
              cents: 0,
              isInTune: false,
            }
            setPitchResult({ noteId, result })
            stopListening()
            return
          }
        }

        if (now - startTime >= PITCH_MAX_RECORDING_DURATION_MS) {
          const result = lastDetectedResult ?? {
            detectedNote: '---',
            cents: 0,
            isInTune: false,
          }
          setPitchResult({ noteId, result })
          stopListening()
          return
        }

        animationFrameRef.current = window.requestAnimationFrame(analyse)
      }

      animationFrameRef.current = window.requestAnimationFrame(analyse)
    } catch (error) {
      setPitchError(getMicrophoneErrorMessage(error))
      stopListening()
    }
  }, [stopListening])

  useEffect(() => () => {
    stopListening()
  }, [stopListening])

  return {
    listeningNote,
    listeningPitch,
    pitchResult,
    pitchError,
    setPitchError,
    clearPitchResult,
    startListening,
    stopListening,
  }
}
