import { useId } from 'react'

import { CHART_LEFT, CHART_PLOT_HEIGHT, CHART_PLOT_WIDTH, CHART_RIGHT, CHART_TOP, CHART_WIDTH } from '../chartGeometry'
import { buildPitchPath } from '../history'
import { formatMidi, type PitchPoint } from '../pitch'

type Props = {
  points: readonly PitchPoint[]
  startMs: number
  endMs: number
  center: number
  span: number
  referencePoints?: readonly PitchPoint[]
  showPlayhead?: boolean
  timeTicksMs?: readonly number[]
}

export function PitchChart({ points, startMs, endMs, center, span, referencePoints, showPlayhead = false, timeTicksMs }: Props) {
  const clipId = useId()
  const minMidi = center - span / 2
  const maxMidi = center + span / 2
  const notes = Array.from(
    { length: Math.floor(maxMidi) - Math.ceil(minMidi) + 1 },
    (_, index) => Math.ceil(minMidi) + index,
  )
  const path = buildPitchPath(points, startMs, endMs, center, span)

  return (
    <svg
      className="tuner-chart"
      viewBox={`0 0 ${CHART_WIDTH} 564`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Tonhöhenverlauf: Zeit von links nach rechts, Tonhöhe nach oben"
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={CHART_LEFT} y={CHART_TOP} width={CHART_PLOT_WIDTH} height={CHART_PLOT_HEIGHT} />
        </clipPath>
      </defs>
      {notes.map((midi) => {
        const y = CHART_TOP + ((maxMidi - midi) / span) * CHART_PLOT_HEIGHT
        const natural = [0, 2, 4, 5, 7, 9, 11].includes(((midi % 12) + 12) % 12)
        return (
          <g key={midi} className={natural ? 'tuner-grid-note is-natural' : 'tuner-grid-note'}>
            <line x1={CHART_LEFT} x2={CHART_RIGHT} y1={y} y2={y} />
            {natural && <text x="18" y={y} textAnchor="end" dominantBaseline="middle">{formatMidi(midi)}</text>}
          </g>
        )
      })}
      {(timeTicksMs ?? Array.from({ length: 6 }, (_, index) => startMs + index * (endMs - startMs) / 5)).map((time, index) => {
        const x = CHART_LEFT + (time - startMs) / (endMs - startMs) * CHART_PLOT_WIDTH
        return (
          <g className="tuner-grid-time" key={index}>
            <line x1={x} x2={x} y1={CHART_TOP} y2={CHART_TOP + CHART_PLOT_HEIGHT} />
          </g>
        )
      })}
      <g clipPath={`url(#${clipId})`}>
        {referencePoints && <path className="tuner-reference-trace" d={buildPitchPath(referencePoints, startMs, endMs, center, span)} />}
        <path className="tuner-trace" d={path} />
      </g>
      {showPlayhead && <line className="tuner-playhead" x1={CHART_LEFT + CHART_PLOT_WIDTH / 2} x2={CHART_LEFT + CHART_PLOT_WIDTH / 2} y1={CHART_TOP} y2={CHART_TOP + CHART_PLOT_HEIGHT} />}
    </svg>
  )
}
