import { useEffect, useState } from 'react'

import { WINDOW_MS } from '../config'
import { nextPitchCenter } from '../history'
import { describePitch, frequencyToMidi, type PitchPoint } from '../pitch'
import { PitchChart } from './PitchChart'

type Props = {
  points: readonly PitchPoint[]
  timeMs: number
  active: boolean
  span: number
}

export function TunerDisplay({ points, timeMs, active, span }: Props) {
  const [center, setCenter] = useState<number | null>(null)
  const latest = points.at(-1)
  const frequency = active ? latest?.frequency ?? null : null

  useEffect(() => {
    if (points.length === 0) {
      setCenter(null)
    } else if (latest?.frequency != null) {
      const currentFrequency = latest.frequency
      setCenter((previous) => {
        const target = nextPitchCenter(previous, currentFrequency, span)
        if (previous === null) return target
        const midi = frequencyToMidi(currentFrequency)
        const eased = previous + (target - previous) * 0.25
        const visibleRadius = span / 2 - 0.1
        return Math.max(midi - visibleRadius, Math.min(midi + visibleRadius, eased))
      })
    }
  }, [latest, points.length, span])

  const reading = frequency === null ? null : describePitch(frequency)
  return (
    <section className="tuner-display" aria-label="Tonhöhenanzeige">
      <div className="tuner-reading" aria-label="Aktuelle Tonhöhe">
        <strong>{reading?.note ?? '–'}</strong>
        <span>{reading ? `${reading.cents > 0 ? '+' : ''}${reading.cents} ct` : '– ct'}</span>
        <span>{frequency === null ? '– Hz' : `${frequency.toFixed(1)} Hz`}</span>
      </div>
      <PitchChart
        points={points}
        startMs={timeMs - WINDOW_MS}
        endMs={timeMs}
        center={center ?? 60}
        span={span}
      />
    </section>
  )
}
