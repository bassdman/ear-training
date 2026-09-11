import { useCallback, useEffect, useMemo, useRef } from 'react'

type AudioPlayerOptions = {
  onError: () => void
}

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stop = useCallback(() => {
    audioRef.current?.pause()
  }, [])

  const prepare = useCallback((src: string, { onError }: AudioPlayerOptions) => {
    const audio = audioRef.current ?? new Audio()
    audio.pause()
    audio.src = src
    audio.preload = 'auto'
    audio.onerror = onError
    audio.load()
    audioRef.current = audio
    return audio
  }, [])

  useEffect(() => stop, [stop])

  return useMemo(() => ({ prepare, stop }), [prepare, stop])
}