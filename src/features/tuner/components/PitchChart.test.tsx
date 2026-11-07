import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PitchChart } from './PitchChart'
import { CHART_LEFT, CHART_PLOT_WIDTH } from '../chartGeometry'

describe('PitchChart', () => {
  it('beschriftet und betont nur Stammtöne, behält aber alle Halbtonlinien', () => {
    const { container } = render(<PitchChart points={[]} startMs={0} endMs={5000} center={66} span={12} />)
    const notes = [...container.querySelectorAll('.tuner-grid-note')]
    expect(notes).toHaveLength(13)
    expect(notes.filter((note) => note.classList.contains('is-natural')).map((note) => note.textContent))
      .toEqual(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'H4', 'C5'])
    expect(notes.filter((note) => !note.classList.contains('is-natural'))).toHaveLength(5)
    expect(notes.every((note) => note.querySelector('line'))).toBe(true)
    expect(notes.filter((note) => !note.classList.contains('is-natural')).every((note) => !note.querySelector('text')))
      .toBe(true)
  })

  it('erkennt Stammtöne auch bei negativen MIDI-Positionen', () => {
    const { container } = render(<PitchChart points={[]} startMs={0} endMs={5000} center={-6} span={12} />)
    expect([...container.querySelectorAll('.is-natural text')].map((note) => note.textContent))
      .toEqual(['C-2', 'D-2', 'E-2', 'F-2', 'G-2', 'A-2', 'H-2', 'C-1'])
  })

  it('zeichnet Raster und Verlauf bis zum rechten Rand des SVG', () => {
    const { container } = render(<PitchChart
      points={[{ timeMs: 0, frequency: 440 }, { timeMs: 5000, frequency: 440 }]}
      startMs={0} endMs={5000} center={69} span={18}
    />)
    expect(container.querySelector('.tuner-chart')).toHaveAttribute('viewBox', '0 0 400 564')
    expect(container.querySelector('.tuner-grid-note line')).toHaveAttribute('x2', '400')
    expect(container.querySelectorAll('.tuner-grid-time line')[5]).toHaveAttribute('x1', '400')
    expect(container.querySelector('clipPath rect')).toHaveAttribute('width', String(CHART_PLOT_WIDTH))
    expect(container.querySelector('.tuner-trace')).toHaveAttribute('d', `M${CHART_LEFT.toFixed(2)} 282.00 L400.00 282.00`)
  })
})
