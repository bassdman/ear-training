import { useEffect, useRef, useState } from 'react'

type PitchView = { center: number, span: number }

const FOLLOW_TIME_MS = 500
const MAX_FRAME_MS = 100
const SETTLED_DISTANCE = 0.01

export function useSmoothPitchView(targetCenter: number | null, targetSpan: number, paused: boolean): PitchView {
  const [view, setView] = useState<PitchView>(() => ({ center: targetCenter ?? 60, span: targetSpan }))
  const viewRef = useRef(view)
  const targetRef = useRef<PitchView | null>(null)
  const initialized = useRef(targetCenter !== null)
  const frame = useRef<number | null>(null)
  const lastTime = useRef(0)

  useEffect(() => {
    if (paused || targetCenter === null) {
      if (paused) initialized.current = true
      targetRef.current = null
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      frame.current = null
      return
    }

    const target = { center: targetCenter, span: targetSpan }
    targetRef.current = target
    if (!initialized.current) {
      initialized.current = true
      viewRef.current = target
      setView(target)
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
  }, [targetCenter, targetSpan, paused])

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
  }, [])

  return view
}
