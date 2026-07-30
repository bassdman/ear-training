import { useEffect, useRef, useState } from 'react'

import { NOTE_FREQS, TONE_STYLES, type NoteName, type ToneStyleId } from '../config'

export function useTonePlayer() {
  const [isPlaying, setIsPlaying] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const playbackTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (playbackTimeoutRef.current !== null) {
        window.clearTimeout(playbackTimeoutRef.current)
      }
      void audioContextRef.current?.close()
    }
  }, [])

  const playTone = async (note: NoteName, toneStyle: ToneStyleId) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new window.AudioContext()
    }

    const audioContext = audioContextRef.current
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    const style = TONE_STYLES[toneStyle]
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    const now = audioContext.currentTime
    const sustainUntil = now + 0.45
    const stopAt = sustainUntil + style.envelope.release

    oscillator.type = style.oscillatorType
    oscillator.frequency.setValueAtTime(NOTE_FREQS[note], now)
    gainNode.gain.setValueAtTime(0.0001, now)
    gainNode.gain.linearRampToValueAtTime(0.9, now + style.envelope.attack)
    gainNode.gain.exponentialRampToValueAtTime(
      Math.max(style.envelope.sustain, 0.04),
      now + style.envelope.attack + style.envelope.decay,
    )
    gainNode.gain.setValueAtTime(Math.max(style.envelope.sustain, 0.04), sustainUntil)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, stopAt)

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    setIsPlaying(true)
    oscillator.start(now)
    oscillator.stop(stopAt)

    if (playbackTimeoutRef.current !== null) {
      window.clearTimeout(playbackTimeoutRef.current)
    }
    playbackTimeoutRef.current = window.setTimeout(() => setIsPlaying(false), 1000)
  }

  return { isPlaying, playTone }
}
