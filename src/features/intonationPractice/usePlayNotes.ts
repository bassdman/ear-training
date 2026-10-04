import { useCallback, useEffect, useRef, useState } from 'react'
import { Soundfont } from 'smplr'

export const NOTE_DURATION_S = 0.9

export function usePlayNotes() {
  const [error, setError] = useState<string | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const instrumentRef = useRef<ReturnType<typeof Soundfont> | null>(null)

  const play = useCallback(
    async (notes: readonly (number | null)[], options: { noteDurationS?: number } = {}) => {
      const noteDurationS = options.noteDurationS ?? NOTE_DURATION_S
      setError(null)
      try {
        if (!contextRef.current || contextRef.current.state === 'closed') {
          contextRef.current = new AudioContext()
          instrumentRef.current = null
        }
        const context = contextRef.current
        if (context.state === 'suspended') await context.resume()

        if (!instrumentRef.current) {
          instrumentRef.current = Soundfont(context, {
            instrument: 'acoustic_grand_piano',
            volume: 100,
            velocity: 95,
          })
        }
        const instrument = instrumentRef.current
        await instrument.ready

        instrument.stop()
        const startTime = context.currentTime + 0.05
        notes.forEach((note, index) => {
          if (note === null) return
          instrument.start({
            note,
            time: startTime + index * noteDurationS,
            duration: noteDurationS,
          })
        })
      } catch {
        setError('Der Ton konnte nicht abgespielt werden.')
      }
    },
    [],
  )

  useEffect(
    () => () => {
      instrumentRef.current?.dispose()
      void contextRef.current?.close()
    },
    [],
  )

  return { play, error }
}
