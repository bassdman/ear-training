import { buildPitchPath } from '../history'
import { formatMidi, type PitchPoint } from '../pitch'

type Props = {
  points: readonly PitchPoint[]
  startMs: number
  endMs: number
  center: number
  span: number
}

export function PitchChart({ points, startMs, endMs, center, span }: Props) {
  const clipId = useId()
  const top = 12
  const height = 540
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
      viewBox="0 0 400 580"
      preserveAspectRatio="none"
      role="img"
      aria-label="Tonhöhenverlauf: Zeit von links nach rechts, Tonhöhe nach oben"
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="46" y={top} width="344" height={height} />
        </clipPath>
      </defs>
      {notes.map((midi) => {
        const y = top + ((maxMidi - midi) / span) * height
        return (
          <g key={midi} className={midi % 12 === 0 ? 'tuner-grid-note is-c' : 'tuner-grid-note'}>
            <line x1="46" x2="390" y1={y} y2={y} />
            <text x="40" y={y} textAnchor="end" dominantBaseline="middle">{formatMidi(midi)}</text>
          </g>
        )
      })}
      {Array.from({ length: 6 }, (_, index) => {
        const x = 46 + index * 344 / 5
        return (
          <g className="tuner-grid-time" key={index}>
            <line x1={x} x2={x} y1={top} y2={top + height} />
            <text x={x} y="574" textAnchor={index === 0 ? 'start' : index === 5 ? 'end' : 'middle'}>
              {index === 5 ? 'jetzt' : `${index - 5} s`}
            </text>
          </g>
        )
      })}
      <g clipPath={`url(#${clipId})`}>
        <path className="tuner-trace" d={path} />
      </g>
    </svg>
  )
}
import { useId } from 'react'
