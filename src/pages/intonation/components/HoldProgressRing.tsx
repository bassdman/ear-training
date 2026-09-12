type HoldProgressRingProps = {
  holdProgress: number
  radius?: number
}

export function HoldProgressRing({ holdProgress, radius = 14 }: HoldProgressRingProps) {
  const ringCircumference = 2 * Math.PI * radius
  const clampedProgress = Math.max(0, Math.min(1, holdProgress))
  const ringOffset = ringCircumference * (1 - clampedProgress)

  return (
    <svg className="intonation-hold-ring" viewBox="0 0 36 36" aria-hidden="true">
      <circle className="intonation-hold-ring-bg" cx="18" cy="18" r={radius} />
      <circle
        className={`intonation-hold-ring-progress ${holdProgress > 0 ? 'is-active' : ''}`}
        cx="18"
        cy="18"
        r={radius}
        strokeDasharray={ringCircumference}
        strokeDashoffset={ringOffset}
      />
    </svg>
  )
}
