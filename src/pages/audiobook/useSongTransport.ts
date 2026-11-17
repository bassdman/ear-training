import { useCallback, useEffect, useRef, useState } from 'react'
import type { PlaybackDiagnostics } from './playbackDiagnostics'
import { startPlaybackLevels } from './playbackLevels'

export type PlaybackTrack = {
  id: string
  buffer: AudioBuffer
  volume: number
  muted: boolean
  start?: number
  trackId?: string
  sourceStart?: number
  duration?: number
}

export function useSongTransport(tracks: PlaybackTrack[], duration: number, ready: boolean, trackKey: string, diagnostics?: PlaybackDiagnostics | null) {
  const [position, setPosition] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [starting, setStarting] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState('')
  const contextRef = useRef<AudioContext | null>(null)
  const resettingRef = useRef(false)
  const mountedRef = useRef(true)
  const sourcesRef = useRef<AudioBufferSourceNode[]>([])
  const gainsRef = useRef(new Map<string, GainNode>())
  const positionRef = useRef(0)
  const startedAtRef = useRef(0)
  const playingRef = useRef(false)
  const generationRef = useRef(0)
  const frameRef = useRef<number | null>(null)
  const tracksRef = useRef(tracks)
  const diagnosticsRef = useRef(diagnostics)
  const stopLevelsRef = useRef<(() => void) | null>(null)
  diagnosticsRef.current = diagnostics

  useEffect(() => {
    stopLevelsRef.current?.()
    stopLevelsRef.current = null
    if (!diagnostics) return
    const context = contextRef.current
    diagnostics.event('transport-snapshot', {
      playing: playingRef.current,
      position: playingRef.current && context ? positionRef.current + context.currentTime - startedAtRef.current : positionRef.current,
      clips: tracksRef.current.length,
      sources: sourcesRef.current.length, gains: gainsRef.current.size,
      state: context?.state ?? 'not-created', sampleRate: context?.sampleRate ?? null,
      baseLatency: context?.baseLatency ?? null, outputLatency: context?.outputLatency ?? null,
    })
    if (context && playingRef.current) {
      stopLevelsRef.current = startPlaybackLevels(context, gainsRef.current, diagnostics, 'playback',
        () => positionRef.current + context.currentTime - startedAtRef.current)
    }
    return () => {
      stopLevelsRef.current?.()
      stopLevelsRef.current = null
    }
  }, [diagnostics])

  useEffect(() => {
    tracksRef.current = tracks
    const updated = new Set<string>()
    for (const track of tracks) {
      const key = track.trackId ?? track.id
      if (updated.has(key)) continue
      updated.add(key)
      const gain = gainsRef.current.get(key)
      const value = track.muted ? 0 : track.volume
      if (gain && gain.gain.value !== value) gain.gain.value = value
    }
  }, [tracks])

  const stopSources = useCallback(() => {
    stopLevelsRef.current?.()
    stopLevelsRef.current = null
    for (const source of sourcesRef.current) {
      source.stop()
      source.disconnect()
    }
    for (const gain of gainsRef.current.values()) gain.disconnect()
    sourcesRef.current = []
    gainsRef.current.clear()
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
  }, [])

  const updatePosition = useCallback((value: number) => {
    positionRef.current = value
    setPosition(value)
  }, [])

  const pause = useCallback(() => {
    generationRef.current++
    if (playingRef.current && contextRef.current) {
      updatePosition(Math.min(duration, positionRef.current + contextRef.current.currentTime - startedAtRef.current))
    }
    playingRef.current = false
    diagnosticsRef.current?.event('pause', { position: positionRef.current, sources: sourcesRef.current.length })
    stopSources()
    setPlaying(false)
    setStarting(false)
    return positionRef.current
  }, [duration, stopSources, updatePosition])

  const resetAudioContext = useCallback(async () => {
    if (resettingRef.current) return
    pause()
    const context = contextRef.current
    if (!context) return
    resettingRef.current = true
    setResetting(true)
    contextRef.current = null
    context.onstatechange = null
    diagnosticsRef.current?.event('audio-context-reset-start')
    try {
      if (context.state !== 'closed') await context.close()
      diagnosticsRef.current?.event('audio-context-reset-complete')
    } catch (cause) {
      console.error('Wiedergabe-AudioContext konnte nicht geschlossen werden:', cause)
      diagnosticsRef.current?.event('audio-context-reset-error', { error: cause instanceof Error ? cause.name : 'unknown' })
      if (mountedRef.current) setError('Die Audioausgabe konnte nicht zurückgesetzt werden. Bitte lade die Seite neu.')
    } finally {
      resettingRef.current = false
      if (mountedRef.current) setResetting(false)
    }
  }, [pause])

  const startSources = useCallback((context: AudioContext, offset: number) => {
    const sources: AudioBufferSourceNode[] = []
    const gains = new Map<string, GainNode>()
    try {
      const schedulingStarted = performance.now()
      const startTime = context.currentTime
      for (const { id, trackId, buffer, volume, muted, start = 0, sourceStart = 0, duration: clipDuration = buffer.duration - sourceStart } of tracksRef.current) {
        if (offset >= start + clipDuration) continue
        const source = context.createBufferSource()
        sources.push(source)
        const key = trackId ?? id
        let gain = gains.get(key)
        if (!gain) {
          gain = context.createGain()
          gains.set(key, gain)
          gain.gain.value = muted ? 0 : volume
          gain.connect(context.destination)
        }
        source.buffer = buffer
        source.connect(gain)
        const elapsed = Math.max(0, offset - start)
        source.start(startTime + Math.max(0, start - offset), sourceStart + elapsed, clipDuration - elapsed)
      }
      sourcesRef.current = sources
      gainsRef.current = gains
      startedAtRef.current = startTime
      if (diagnosticsRef.current) {
        stopLevelsRef.current = startPlaybackLevels(context, gains, diagnosticsRef.current, 'playback',
          () => positionRef.current + context.currentTime - startedAtRef.current)
      }
      diagnosticsRef.current?.event('sources-started', {
        offset, sources: sources.length, gains: gains.size, schedulingMs: performance.now() - schedulingStarted,
        sampleRate: context.sampleRate, baseLatency: context.baseLatency ?? null,
        outputLatency: context.outputLatency ?? null, state: context.state,
      })
      let lastWall = performance.now()
      let lastAudio = context.currentTime
      let wasMeasuring = Boolean(diagnosticsRef.current)
      playingRef.current = true
      setPlaying(true)
      const tick = () => {
        if (diagnosticsRef.current) {
          const wall = performance.now()
          const audio = context.currentTime
          if (wasMeasuring) {
            diagnosticsRef.current.measure('frameIntervalMs', wall - lastWall)
            diagnosticsRef.current.measure('audioAdvanceMs', (audio - lastAudio) * 1000)
            diagnosticsRef.current.measure('audioWallDriftMs', (wall - lastWall) - (audio - lastAudio) * 1000)
          }
          lastWall = wall
          lastAudio = audio
          wasMeasuring = true
        } else {
          wasMeasuring = false
        }
        const next = Math.min(duration, positionRef.current + context.currentTime - startedAtRef.current)
        setPosition(next)
        if (next >= duration) {
          diagnosticsRef.current?.event('playback-ended', { position: next })
          positionRef.current = duration
          playingRef.current = false
          stopSources()
          setPlaying(false)
          return
        }
        frameRef.current = requestAnimationFrame(tick)
      }
      frameRef.current = requestAnimationFrame(tick)
    } catch (cause) {
      diagnosticsRef.current?.event('source-start-error', { error: cause instanceof Error ? cause.name : 'unknown' })
      for (const source of sources) {
        try { source.stop() } catch { /* A source may not have started yet. */ }
        source.disconnect()
      }
      for (const gain of gains.values()) gain.disconnect()
      throw cause
    }
  }, [duration, stopSources])

  const play = useCallback(async () => {
    if (!ready || playingRef.current || starting || resettingRef.current) return
    const generation = ++generationRef.current
    setStarting(true)
    setError('')
    diagnosticsRef.current?.event('play-request', { position: positionRef.current, clips: tracksRef.current.length })
    try {
      const context = contextRef.current ?? new AudioContext()
      contextRef.current = context
      context.onstatechange = () => diagnosticsRef.current?.event('audio-context-state', { state: context.state })
      if (context.state !== 'running') await context.resume()
      if (generation !== generationRef.current) return
      if (context.state !== 'running') throw new Error('AudioContext nicht aktiv')
      const offset = positionRef.current >= duration ? 0 : positionRef.current
      updatePosition(offset)
      startSources(context, offset)
    } catch (cause) {
      diagnosticsRef.current?.event('play-error', { error: cause instanceof Error ? cause.name : 'unknown' })
      if (generation === generationRef.current) {
        setError('Die Wiedergabe konnte nicht gestartet werden. Bitte prüfe die Audioausgabe.')
      }
    } finally {
      if (generation === generationRef.current) setStarting(false)
    }
  }, [duration, ready, startSources, starting, updatePosition])

  const seek = useCallback((time: number, origin = 'control') => {
    const next = Math.max(0, Math.min(duration, time))
    diagnosticsRef.current?.event('seek', { origin, from: positionRef.current, to: next, playing: playingRef.current })
    generationRef.current++
    setStarting(false)
    const wasPlaying = playingRef.current
    stopSources()
    playingRef.current = false
    setPlaying(false)
    updatePosition(next)
    if (wasPlaying && next < duration && contextRef.current) {
      try {
        startSources(contextRef.current, next)
      } catch {
        setError('Die Wiedergabe konnte an dieser Position nicht fortgesetzt werden.')
      }
    }
  }, [duration, startSources, stopSources, updatePosition])

  const cleanup = useCallback(() => {
    generationRef.current++
    playingRef.current = false
    stopSources()
    const context = contextRef.current
    contextRef.current = null
    if (context) {
      context.onstatechange = null
      void context.close().catch((cause: unknown) => console.error('AudioContext konnte nicht geschlossen werden:', cause))
    }
  }, [stopSources])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      cleanup()
    }
  }, [cleanup])

  const previousTrackKey = useRef(trackKey)
  useEffect(() => {
    if (previousTrackKey.current !== trackKey) {
      previousTrackKey.current = trackKey
      pause()
    }
  }, [trackKey, pause])

  return { position, playing, starting, resetting, error, play, pause, seek, resetAudioContext }
}
