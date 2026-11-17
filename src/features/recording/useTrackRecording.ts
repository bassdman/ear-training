import { useCallback, useEffect, useRef, useState } from 'react'

import type { AudioClip, AudioTrack } from '../../pages/audiobook/audioStorage'
import { createProjectId } from '../../pages/audiobook/storage'
import type { PlaybackTrack } from '../../pages/audiobook/useSongTransport'
import { prepareRecording } from './prepareRecording'
import type { PlaybackDiagnostics } from '../../pages/audiobook/playbackDiagnostics'
import { startPlaybackLevels } from '../../pages/audiobook/playbackLevels'

type Phase = 'idle' | 'preparing' | 'recording' | 'saving'
type AudioSession = { type: string }
type SessionOverride = { session: AudioSession, previous: string, lastSet: string }

function setSessionType(override: SessionOverride, type: string) {
  try {
    override.session.type = type
    override.lastSet = type
  } catch (cause) {
    console.warn('Audiositzung konnte nicht umgestellt werden:', cause)
  }
}

function recordingFileName(type: string): string {
  if (type.includes('mp4')) return 'aufnahme.m4a'
  if (type.includes('ogg')) return 'aufnahme.ogg'
  if (type.includes('wav')) return 'aufnahme.wav'
  return 'aufnahme.webm'
}

export function useTrackRecording(
  save: (track: AudioTrack, clip: AudioClip, durations: Record<string, number>) => Promise<void>,
  onBusyChange?: (busy: boolean) => void,
  diagnostics?: PlaybackDiagnostics | null,
  enabled = true,
  onRecordingReleased?: () => void,
) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [position, setPosition] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [recovery, setRecovery] = useState<{ url: string, name: string } | null>(null)
  const active = useRef(false)
  const mounted = useRef(true)
  const generation = useRef(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const sourcesRef = useRef<AudioBufferSourceNode[]>([])
  const frameRef = useRef<number | null>(null)
  const recoveryRef = useRef<string | null>(null)
  const diagnosticsRef = useRef(diagnostics)
  diagnosticsRef.current = diagnostics
  const gainsRef = useRef(new Map<string, GainNode>())
  const recordingStartRef = useRef<{ position: number, time: number } | null>(null)
  const stopLevelsRef = useRef<(() => void) | null>(null)
  const sessionOverrideRef = useRef<SessionOverride | null>(null)

  useEffect(() => {
    return () => {
      const override = sessionOverrideRef.current
      sessionOverrideRef.current = null
      if (override && override.session.type === override.lastSet) setSessionType(override, override.previous)
    }
  }, [enabled])

  const release = useCallback(() => {
    stopLevelsRef.current?.()
    stopLevelsRef.current = null
    gainsRef.current.clear()
    recordingStartRef.current = null
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    for (const source of sourcesRef.current) {
      try { source.stop() } catch { /* A source may already have stopped. */ }
      source.disconnect()
    }
    sourcesRef.current = []
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    const override = sessionOverrideRef.current
    if (override && override.session.type === override.lastSet) setSessionType(override, 'playback')
    const context = contextRef.current
    contextRef.current = null
    if (context) void context.close().catch((cause: unknown) => console.error('AudioContext konnte nicht geschlossen werden:', cause))
  }, [])

  useEffect(() => {
    stopLevelsRef.current?.()
    stopLevelsRef.current = null
    const context = contextRef.current
    const start = recordingStartRef.current
    if (diagnostics && context && start) {
      stopLevelsRef.current = startPlaybackLevels(context, gainsRef.current, diagnostics, 'recording',
        () => start.position + context.currentTime - start.time)
    }
    return () => {
      stopLevelsRef.current?.()
      stopLevelsRef.current = null
    }
  }, [diagnostics])

  useEffect(() => {
    mounted.current = true
    const currentGeneration = generation
    return () => {
      mounted.current = false
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') recorder.stop()
      else currentGeneration.current++
      release()
      if (recoveryRef.current) URL.revokeObjectURL(recoveryRef.current)
    }
  }, [release])

  useEffect(() => {
    if (phase === 'idle' && !recovery) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    const guardLinks = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element) || !target.closest('a[href]:not([download])')) return
      if (!window.confirm('Die Aufnahme ist noch nicht gespeichert. Seite trotzdem verlassen?')) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', warn)
    document.addEventListener('click', guardLinks, true)
    return () => {
      window.removeEventListener('beforeunload', warn)
      document.removeEventListener('click', guardLinks, true)
    }
  }, [phase, recovery])

  const finish = useCallback(() => {
    active.current = false
    recorderRef.current = null
    release()
    if (mounted.current) {
      setPhase('idle')
      setPosition(null)
      onBusyChange?.(false)
    }
  }, [onBusyChange, release])

  const start = useCallback(async (target: AudioTrack, startPosition: number, tracks: PlaybackTrack[], durations: Record<string, number>) => {
    if (active.current) return
    active.current = true
    const currentGeneration = ++generation.current
    setPhase('preparing')
    onBusyChange?.(true)
    setError('')
    if (recoveryRef.current) URL.revokeObjectURL(recoveryRef.current)
    recoveryRef.current = null
    setRecovery(null)
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error('Mikrofonaufnahmen werden von diesem Browser nicht unterstützt. Verwende HTTPS oder localhost.')
      }
      const session = (navigator as Navigator & { audioSession?: AudioSession }).audioSession
      if (session) {
        const override = sessionOverrideRef.current ?? { session, previous: session.type, lastSet: session.type }
        sessionOverrideRef.current = override
        setSessionType(override, 'play-and-record')
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (currentGeneration !== generation.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      const context = new AudioContext()
      contextRef.current = context
      if (context.state !== 'running') await context.resume()
      if (currentGeneration !== generation.current) return
      if (context.state !== 'running') throw new Error('Die Audioausgabe konnte nicht gestartet werden.')
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      const chunks: Blob[] = []
      let failed = false
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
      recorder.onerror = () => { failed = true }
      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          failed = true
          if (recorder.state !== 'inactive') recorder.stop()
        }
      })
      recorder.onstart = () => {
        if (currentGeneration !== generation.current) return
        try {
          const startedAt = context.currentTime
          const gains = new Map<string, GainNode>()
          for (const clip of tracks) {
            if (clip.trackId === target.id) continue
            const clipStart = clip.start ?? 0
            const sourceStart = clip.sourceStart ?? 0
            const length = clip.duration ?? clip.buffer.duration - sourceStart
            if (startPosition >= clipStart + length) continue
            const source = context.createBufferSource()
            sourcesRef.current.push(source)
            const key = clip.trackId ?? clip.id
            let gain = gains.get(key)
            if (!gain) {
              gain = context.createGain()
              gain.gain.value = clip.muted ? 0 : clip.volume
              gain.connect(context.destination)
              gains.set(key, gain)
            }
            source.buffer = clip.buffer
            source.connect(gain)
            const elapsed = Math.max(0, startPosition - clipStart)
            source.start(startedAt + Math.max(0, clipStart - startPosition), sourceStart + elapsed, length - elapsed)
          }
          gainsRef.current = gains
          recordingStartRef.current = { position: startPosition, time: startedAt }
          if (diagnosticsRef.current) {
            diagnosticsRef.current.event('recording-start', { position: startPosition, targetTrack: diagnosticsRef.current.trackNumber(target.id) })
            stopLevelsRef.current = startPlaybackLevels(context, gains, diagnosticsRef.current, 'recording',
              () => startPosition + context.currentTime - startedAt)
          }
          setPhase('recording')
          const tick = () => {
            setPosition(startPosition + context.currentTime - startedAt)
            frameRef.current = requestAnimationFrame(tick)
          }
          tick()
        } catch (cause) {
          console.error('Begleitung konnte nicht gestartet werden:', cause)
          failed = true
          if (recorder.state !== 'inactive') recorder.stop()
        }
      }
      recorder.onstop = () => {
        release()
        if (mounted.current) onRecordingReleased?.()
        if (currentGeneration !== generation.current) return
        if (mounted.current) setPhase('saving')
        void (async () => {
          const blob = new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type || 'audio/webm' })
          try {
            if (failed) throw new Error('Die Aufnahme wurde durch einen Mikrofon- oder Wiedergabefehler unterbrochen.')
            if (!blob.size) throw new Error('Das Mikrofon hat keine Audiodaten geliefert.')
            const { audio, duration } = await prepareRecording(blob)
            await save(target, { id: createProjectId(), name: 'Mikrofonaufnahme', audio, start: startPosition, duration }, durations)
          } catch (cause) {
            if (!mounted.current) {
              console.error('Die Aufnahme konnte nach dem Verlassen nicht gespeichert werden:', cause)
              if (blob.size) {
                const url = URL.createObjectURL(blob)
                const link = document.createElement('a')
                link.href = url
                link.download = recordingFileName(blob.type)
                link.click()
                setTimeout(() => URL.revokeObjectURL(url), 60_000)
              }
              return
            }
            setError(cause instanceof Error ? `Aufnahme nicht gespeichert: ${cause.message}` : 'Die Aufnahme konnte nicht gespeichert werden.')
            if (blob.size) {
              const url = URL.createObjectURL(blob)
              recoveryRef.current = url
              setRecovery({ url, name: recordingFileName(blob.type) })
            }
          } finally {
            finish()
          }
        })()
      }
      recorder.start()
    } catch (cause) {
      if (currentGeneration !== generation.current) return
      const message = cause instanceof DOMException && cause.name === 'NotAllowedError'
        ? 'Der Zugriff auf das Mikrofon wurde verweigert.'
        : cause instanceof DOMException && cause.name === 'NotFoundError'
          ? 'Es wurde kein Mikrofon gefunden.'
          : cause instanceof Error ? cause.message : 'Das Mikrofon konnte nicht gestartet werden.'
      setError(message)
      finish()
    }
  }, [finish, onBusyChange, onRecordingReleased, release, save])

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    else if (active.current && !recorder) {
      generation.current++
      finish()
    }
  }, [finish])

  const discardRecovery = useCallback(() => {
    if (recoveryRef.current) URL.revokeObjectURL(recoveryRef.current)
    recoveryRef.current = null
    setRecovery(null)
    setError('')
  }, [])

  return { phase, position, error, recovery, start, stop, discardRecovery }
}
