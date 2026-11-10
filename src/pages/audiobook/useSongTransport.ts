import { useCallback, useEffect, useRef, useState } from 'react'

export function useSongTransport(buffers: AudioBuffer[], duration: number, ready: boolean, trackKey: string) {
  const [position, setPosition] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const contextRef = useRef<AudioContext | null>(null)
  const sourcesRef = useRef<AudioBufferSourceNode[]>([])
  const positionRef = useRef(0)
  const startedAtRef = useRef(0)
  const playingRef = useRef(false)
  const generationRef = useRef(0)
  const frameRef = useRef<number | null>(null)

  const stopSources = useCallback(() => {
    for (const source of sourcesRef.current) {
      source.stop()
      source.disconnect()
    }
    sourcesRef.current = []
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
    const sources: AudioBufferSourceNode[] = []
    try {
      const startTime = context.currentTime
      for (const buffer of buffers) {
        if (offset >= buffer.duration) continue
        const source = context.createBufferSource()
        sources.push(source)
        source.buffer = buffer
        source.connect(context.destination)
        source.start(startTime, offset)
      }
      sourcesRef.current = sources
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
      for (const source of sources) {
        try { source.stop() } catch { /* A source may not have started yet. */ }
        source.disconnect()
      }
      throw cause
    }
  }, [buffers, duration, stopSources])

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
