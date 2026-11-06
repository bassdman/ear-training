import { useCallback, useEffect, useRef, useState } from 'react'

import { ANALYSIS_FFT_SIZE, ANALYSIS_INTERVAL_MS } from '../config'
import { appendPoint } from '../history'
import { createPitchAnalyzer, type PitchPoint } from '../pitch'

type Status = 'idle' | 'starting' | 'listening' | 'error'
type State = { status: Status, error: string | null, points: PitchPoint[], timeMs: number }

const INITIAL_STATE: State = { status: 'idle', error: null, points: [], timeMs: 0 }

function microphoneError(error: unknown): string {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    return 'Das Mikrofon benötigt eine sichere Verbindung über HTTPS oder localhost.'
  }
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Der Mikrofonzugriff wurde verweigert. Erlaube ihn in den Browser-Einstellungen und versuche es erneut.'
  }
  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return 'Es wurde kein Mikrofon gefunden.'
  }
  return 'Das Mikrofon konnte nicht verwendet werden. Bitte versuche es erneut.'
}

export function useLiveTuner() {
  const [state, setState] = useState<State>(INITIAL_STATE)
  const streamRef = useRef<MediaStream | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const frameRef = useRef<number | null>(null)
  const generationRef = useRef(0)
  const originRef = useRef(0)
  const lastFrameRef = useRef(0)

  const release = useCallback(() => {
    generationRef.current += 1
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    streamRef.current?.getTracks().forEach((track) => {
      track.onended = null
      track.stop()
    })
    streamRef.current = null
    const context = contextRef.current
    contextRef.current = null
    if (context && context.state !== 'closed') {
      void context.close().catch((error: unknown) => console.error('AudioContext konnte nicht geschlossen werden:', error))
    }
  }, [])

  const stop = useCallback(() => {
    release()
    setState((current) => ({ ...current, status: 'idle', error: null }))
  }, [release])

  const clear = useCallback(() => {
    originRef.current = performance.now()
    lastFrameRef.current = 0
    setState((current) => ({ ...current, points: [], timeMs: 0 }))
  }, [])

  const start = useCallback(async () => {
    release()
    const generation = generationRef.current
    setState({ ...INITIAL_STATE, status: 'starting' })
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setState((current) => ({ ...current, status: 'error', error: microphoneError(null) }))
      return
    }

    try {
      const context = new AudioContext()
      contextRef.current = context
      const resumed = context.state === 'suspended'
        ? context.resume().then(() => ({ ok: true as const }), (error: unknown) => ({ ok: false as const, error }))
        : Promise.resolve({ ok: true as const })
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
      if (generation !== generationRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      if (stream.getAudioTracks().length === 0 || stream.getAudioTracks().every((track) => track.readyState === 'ended')) {
        throw new Error('Der Mikrofonstream enthält keine aktive Audiospur.')
      }
      const resumeResult = await resumed
      if (generation !== generationRef.current) return
      if (!resumeResult.ok) throw resumeResult.error
      if (context.state !== 'running') throw new Error('Der AudioContext konnte nicht gestartet werden.')

      const analyser = context.createAnalyser()
      analyser.fftSize = ANALYSIS_FFT_SIZE
      context.createMediaStreamSource(stream).connect(analyser)
      const samples = new Float32Array(analyser.fftSize)
      const analyzePitch = createPitchAnalyzer(samples.length)
      originRef.current = performance.now()
      lastFrameRef.current = 0
      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          if (generation !== generationRef.current) return
          release()
          setState((current) => ({
            ...current,
            status: 'error',
            error: 'Das Mikrofon wurde getrennt oder beendet. Bitte starte es erneut.',
          }))
        }
      })
      setState((current) => ({ ...current, status: 'listening' }))

      const analyze = () => {
        if (generation !== generationRef.current) return
        const now = performance.now()
        if (now - lastFrameRef.current >= ANALYSIS_INTERVAL_MS) {
          try {
            let frequency: number | null = null
            if (context.state === 'running') {
              analyser.getFloatTimeDomainData(samples)
              frequency = analyzePitch(samples, context.sampleRate)
            }
            const timeMs = Math.max(0, now - originRef.current)
            setState((current) => ({
              ...current,
              points: appendPoint(current.points, { timeMs, frequency }),
              timeMs,
            }))
            lastFrameRef.current = now
          } catch (error) {
            console.error('Die Tonhöhenanalyse ist fehlgeschlagen:', error)
            release()
            setState((current) => ({ ...current, status: 'error', error: 'Die Tonhöhenanalyse ist fehlgeschlagen. Bitte versuche es erneut.' }))
            return
          }
        }
        frameRef.current = requestAnimationFrame(analyze)
      }
      frameRef.current = requestAnimationFrame(analyze)
    } catch (error) {
      if (generation !== generationRef.current) return
      console.error('Mikrofonstart fehlgeschlagen:', error)
      release()
      setState((current) => ({ ...current, status: 'error', error: microphoneError(error) }))
    }
  }, [release])

  useEffect(() => release, [release])

  return { ...state, start, stop, clear }
}
