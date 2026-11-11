import { useEffect, useRef, useState } from 'react'

type PitchView = { center: number, span: number }

export const EXERCISE_MIN_PITCH_SPAN = 36
const PITCH_MARGIN = 3
const FOLLOW_TIME_MS = 500
const MAX_FRAME_MS = 100
const SETTLED_DISTANCE = 0.01

export function useSmoothPitchView(lowMidi: number | null, highMidi: number | null, paused: boolean): PitchView {
  const [view, setView] = useState<PitchView>(() => ({
    center: lowMidi !== null && highMidi !== null ? (lowMidi + highMidi) / 2 : 60,
    span: lowMidi !== null && highMidi !== null ? Math.max(EXERCISE_MIN_PITCH_SPAN, highMidi - lowMidi + 2 * PITCH_MARGIN) : EXERCISE_MIN_PITCH_SPAN,
  }))
  const viewRef = useRef(view)
  const targetRef = useRef<PitchView | null>(null)
  const initialized = useRef(lowMidi !== null && highMidi !== null)
  const frame = useRef<number | null>(null)
  const lastTime = useRef(0)

  useEffect(() => {
    if (paused || lowMidi === null || highMidi === null) {
      if (paused) initialized.current = true
      targetRef.current = null
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      frame.current = null
      return
    }

    const span = Math.max(EXERCISE_MIN_PITCH_SPAN, highMidi - lowMidi + 2 * PITCH_MARGIN)
    const radius = span / 2 - PITCH_MARGIN
    const center = initialized.current
      ? Math.max(highMidi - radius, Math.min(lowMidi + radius, viewRef.current.center))
      : (lowMidi + highMidi) / 2
    const target = { center, span }
    targetRef.current = target
    if (!initialized.current) {
      initialized.current = true
      viewRef.current = target
      setView(target)
      return
    }
    if (Math.abs(viewRef.current.center - target.center) < SETTLED_DISTANCE
      && Math.abs(viewRef.current.span - target.span) < SETTLED_DISTANCE) {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      frame.current = null
      return
    }
    if (frame.current !== null) return

    lastTime.current = performance.now()
    const tick = (time: number) => {
      frame.current = null
      const currentTarget = targetRef.current
      if (!currentTarget) return
      const delta = Math.max(0, Math.min(MAX_FRAME_MS, time - lastTime.current))
      lastTime.current = time
      const factor = 1 - Math.exp(-delta / FOLLOW_TIME_MS)
      const previous = viewRef.current
      const next = {
        center: previous.center + (currentTarget.center - previous.center) * factor,
        span: previous.span + (currentTarget.span - previous.span) * factor,
      }
      const settled = Math.abs(next.center - currentTarget.center) < SETTLED_DISTANCE
        && Math.abs(next.span - currentTarget.span) < SETTLED_DISTANCE
      viewRef.current = settled ? currentTarget : next
      setView(viewRef.current)
      if (!settled) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
  }, [lowMidi, highMidi, paused])

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
  }, [])

  return view
}
