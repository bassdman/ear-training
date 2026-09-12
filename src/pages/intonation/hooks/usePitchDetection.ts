import { useCallback, useEffect, useRef, useState } from 'react'

import { REQUIRED_STABLE_SAMPLES } from '../config'
import { detectPitch, getMicrophoneErrorMessage, getPitchResult } from '../helpers/pitchUtils'
import type { ActiveNote, PitchResult } from '../types'

export function usePitchDetection() {
  const [listeningNote, setListeningNote] = useState<ActiveNote>(null)
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
  }, [])

  const clearPitchResult = useCallback(() => {
    setPitchResult(null)
  }, [])

  const startListening = useCallback(async (noteId: string) => {
    stopListening()
    setPitchResult(null)

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

      const analyse = () => {
        analyser.getFloatTimeDomainData(samples)
        const frequency = detectPitch(samples, audioContext.sampleRate)
        if (frequency !== null) {
          stableFrequencies.push(frequency)
          if (stableFrequencies.length > REQUIRED_STABLE_SAMPLES) stableFrequencies.shift()
          const lowestFrequency = Math.min(...stableFrequencies)
          const highestFrequency = Math.max(...stableFrequencies)
          const spreadInCents = 1200 * Math.log2(highestFrequency / lowestFrequency)

          if (stableFrequencies.length === REQUIRED_STABLE_SAMPLES && spreadInCents < 15) {
            const averageFrequency = stableFrequencies.reduce((sum, value) => sum + value, 0) / stableFrequencies.length
            const result = getPitchResult(averageFrequency, noteId)
            if (result) setPitchResult({ noteId, result })
            stopListening()
            return
          }
        } else {
          stableFrequencies.length = 0
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
    pitchResult,
    pitchError,
    setPitchError,
    clearPitchResult,
    startListening,
    stopListening,
  }
}
