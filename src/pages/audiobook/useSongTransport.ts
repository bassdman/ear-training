import { useCallback, useEffect, useRef, useState } from 'react'

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

export function useSongTransport(tracks: PlaybackTrack[], duration: number, ready: boolean, trackKey: string) {
  const [position, setPosition] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const contextRef = useRef<AudioContext | null>(null)
  const sourcesRef = useRef<{ source: AudioBufferSourceNode, gain: GainNode }[]>([])
  const gainsRef = useRef(new Map<string, GainNode[]>())
  const positionRef = useRef(0)
  const startedAtRef = useRef(0)
  const playingRef = useRef(false)
  const generationRef = useRef(0)
  const frameRef = useRef<number | null>(null)
  const tracksRef = useRef(tracks)

  useEffect(() => {
    tracksRef.current = tracks
    for (const track of tracks) {
      const gains = gainsRef.current.get(track.trackId ?? track.id)
      if (gains) for (const gain of gains) gain.gain.value = track.muted ? 0 : track.volume
    }
  }, [tracks])

  const stopSources = useCallback(() => {
    for (const { source, gain } of sourcesRef.current) {
      source.stop()
      source.disconnect()
      gain.disconnect()
    }
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
    stopSources()
    setPlaying(false)
    setStarting(false)
  }, [duration, stopSources, updatePosition])

  const startSources = useCallback((context: AudioContext, offset: number) => {
    const sources: { source: AudioBufferSourceNode, gain: GainNode }[] = []
    const gains = new Map<string, GainNode[]>()
    try {
      const startTime = context.currentTime
      for (const { id, trackId, buffer, volume, muted, start = 0, sourceStart = 0, duration: clipDuration = buffer.duration - sourceStart } of tracksRef.current) {
        if (offset >= start + clipDuration) continue
        const source = context.createBufferSource()
        const gain = context.createGain()
        sources.push({ source, gain })
        const key = trackId ?? id
        gains.set(key, [...(gains.get(key) ?? []), gain])
        source.buffer = buffer
        gain.gain.value = muted ? 0 : volume
        source.connect(gain)
        gain.connect(context.destination)
        const elapsed = Math.max(0, offset - start)
        source.start(startTime + Math.max(0, start - offset), sourceStart + elapsed, clipDuration - elapsed)
      }
      sourcesRef.current = sources
      gainsRef.current = gains
      startedAtRef.current = startTime
      playingRef.current = true
      setPlaying(true)
      const tick = () => {
        const next = Math.min(duration, positionRef.current + context.currentTime - startedAtRef.current)
        setPosition(next)
        if (next >= duration) {
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
      for (const { source, gain } of sources) {
        try { source.stop() } catch { /* A source may not have started yet. */ }
        source.disconnect()
        gain.disconnect()
      }
      throw cause
    }
  }, [duration, stopSources])

  const play = useCallback(async () => {
    if (!ready || playingRef.current || starting) return
    const generation = ++generationRef.current
    setStarting(true)
    setError('')
    try {
      const context = contextRef.current ?? new AudioContext()
      contextRef.current = context
      if (context.state !== 'running') await context.resume()
      if (generation !== generationRef.current) return
      if (context.state !== 'running') throw new Error('AudioContext nicht aktiv')
      const offset = positionRef.current >= duration ? 0 : positionRef.current
      updatePosition(offset)
      startSources(context, offset)
    } catch {
      if (generation === generationRef.current) {
        setError('Die Wiedergabe konnte nicht gestartet werden. Bitte prüfe die Audioausgabe.')
      }
    } finally {
      if (generation === generationRef.current) setStarting(false)
    }
  }, [duration, ready, startSources, starting, updatePosition])

  const seek = useCallback((time: number) => {
    const next = Math.max(0, Math.min(duration, time))
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
    if (context) void context.close().catch((cause: unknown) => console.error('AudioContext konnte nicht geschlossen werden:', cause))
  }, [stopSources])

  useEffect(() => cleanup, [cleanup])

  const previousTrackKey = useRef(trackKey)
  useEffect(() => {
    if (previousTrackKey.current !== trackKey) {
      previousTrackKey.current = trackKey
      pause()
    }
  }, [trackKey, pause])

  return { position, playing, starting, error, play, pause, seek }
}
